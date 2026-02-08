from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func, text
from datetime import timedelta, datetime, timezone
from typing import List
import os, json, logging

from database import engine, Base, get_db
from models import User, CloudflareConfig, AuditLog, Project, Deployment
from schemas import (
    UserCreate, UserResponse, Token,
    CloudflareConfigCreate, CloudflareConfigResponse,
    TunnelSetupRequest, TunnelSetupResponse,
    ProjectCreate, ProjectResponse,
    PlatformStatus, ServiceStatus, AuditLogResponse,
)
from auth import (
    authenticate_user, create_access_token, get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from password import get_password_hash
from cloudflare_service import CloudflareService
from crud import create_user, get_user_by_email, get_user_by_username

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deployx")

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DeployX API",
    description="Self-hosted DevOps Deployment Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS — allow the frontend origin (covers both local and tunnel access)
# ---------------------------------------------------------------------------
cors_raw = os.getenv("BACKEND_CORS_ORIGINS", '["http://localhost:3000"]')
try:
    cors_origins = json.loads(cors_raw)
except Exception:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# ========================  HEALTH / STATUS  ================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "service": "DeployX API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """Deep health check including database connectivity"""
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"
    return {"api": "healthy", "database": db_status}


@app.get("/api/platform/status", response_model=PlatformStatus)
async def platform_status(db: Session = Depends(get_db)):
    """
    Public endpoint — returns onboarding state so the frontend can decide
    whether to show register, tunnel-setup, or the full dashboard.
    """
    user_count = db.query(sql_func.count(User.id)).scalar() or 0
    has_admin = user_count > 0

    tunnel_cfg = db.query(CloudflareConfig).filter(CloudflareConfig.is_active == True).first()
    has_tunnel = tunnel_cfg is not None
    public_url = f"https://{tunnel_cfg.subdomain}.{tunnel_cfg.domain}" if tunnel_cfg and tunnel_cfg.domain else None

    services = [
        ServiceStatus(name="Frontend (Next.js)", status="healthy", port=3000),
        ServiceStatus(name="Backend (FastAPI)", status="healthy", port=3001),
        ServiceStatus(name="Database (PostgreSQL)", status="healthy", port=3002),
        ServiceStatus(name="Reverse Proxy (Traefik)", status="healthy", port=80),
        ServiceStatus(
            name="Cloudflare Tunnel",
            status="healthy" if has_tunnel else "not configured",
        ),
    ]

    return PlatformStatus(
        platform="DeployX",
        version="1.0.0",
        has_admin=has_admin,
        has_tunnel=has_tunnel,
        services=services,
        public_url=public_url,
    )


# ========================  AUTH  ===========================================

@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register a new user (first user becomes superuser/admin)."""
    db_user = get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    # First registered user is the admin
    user_count = db.query(sql_func.count(User.id)).scalar() or 0
    new_user = create_user(db, user, is_superuser=(user_count == 0))

    db.add(AuditLog(
        user_id=new_user.id, action="user_registered",
        resource_type="user", resource_id=str(new_user.id),
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()
    return new_user


@app.post("/api/auth/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and receive a JWT access token."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    db.add(AuditLog(user_id=user.id, action="user_login", resource_type="user", resource_id=str(user.id)))
    db.commit()
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user details."""
    return current_user


# ========================  CLOUDFLARE TUNNEL  ==============================

@app.post("/api/cloudflare/setup", response_model=TunnelSetupResponse)
async def setup_cloudflare_tunnel(
    config: TunnelSetupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Automates Cloudflare Tunnel provisioning:
    1. Validates API token  2. Creates tunnel  3. Adds DNS CNAME
    4. Configures tunnel routing → Traefik  5. Persists to DB
    """
    cf = CloudflareService(config.api_token)

    try:
        # Validate token & get zone
        zone_id = await cf.get_zone_id(config.domain)
        if not zone_id:
            raise HTTPException(status_code=400, detail=f"Zone not found for {config.domain}")

        tunnel_name = f"deployx-{current_user.username}"
        tunnel_id, tunnel_token = await cf.create_tunnel(tunnel_name, zone_id)

        full_domain = f"{config.subdomain}.{config.domain}"
        await cf.create_dns_record(zone_id, config.subdomain, tunnel_id)

        # Get account id for routing
        account_id = await cf.get_account_id()
        if account_id:
            await cf.configure_tunnel_routing(account_id, tunnel_id, full_domain)

        # Upsert config in DB
        cfg = db.query(CloudflareConfig).filter(CloudflareConfig.user_id == current_user.id).first()
        values = dict(
            api_token=config.api_token, zone_id=zone_id, domain=config.domain,
            subdomain=config.subdomain, tunnel_id=tunnel_id,
            tunnel_name=tunnel_name, tunnel_token=tunnel_token, is_active=True,
        )
        if cfg:
            for k, v in values.items():
                setattr(cfg, k, v)
        else:
            cfg = CloudflareConfig(user_id=current_user.id, **values)
            db.add(cfg)

        db.commit()
        db.refresh(cfg)

        # Persist tunnel token to .env so cloudflared container can pick it up
        await cf.update_env_file(tunnel_token)

        db.add(AuditLog(
            user_id=current_user.id, action="tunnel_created",
            resource_type="tunnel", resource_id=tunnel_id,
            details={"subdomain": config.subdomain, "domain": config.domain},
            ip_address=request.client.host if request.client else None,
        ))
        db.commit()

        return TunnelSetupResponse(
            success=True, message="Cloudflare tunnel configured successfully",
            tunnel_id=tunnel_id, subdomain=full_domain,
            public_url=f"https://{full_domain}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Tunnel setup failed")
        raise HTTPException(status_code=500, detail=f"Tunnel setup failed: {e}")


@app.get("/api/cloudflare/config", response_model=CloudflareConfigResponse)
async def get_cloudflare_config(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the current Cloudflare configuration."""
    cfg = db.query(CloudflareConfig).filter(CloudflareConfig.user_id == current_user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Cloudflare configuration not found")
    return cfg


@app.delete("/api/cloudflare/tunnel/{tunnel_id}")
async def delete_tunnel(
    tunnel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a Cloudflare tunnel and mark config inactive."""
    cfg = db.query(CloudflareConfig).filter(
        CloudflareConfig.user_id == current_user.id,
        CloudflareConfig.tunnel_id == tunnel_id,
    ).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Tunnel not found")

    cf = CloudflareService(cfg.api_token)
    try:
        await cf.delete_tunnel(tunnel_id)
    except Exception as e:
        logger.warning("Remote tunnel deletion failed: %s", e)

    cfg.is_active = False
    db.add(AuditLog(user_id=current_user.id, action="tunnel_deleted", resource_type="tunnel", resource_id=tunnel_id))
    db.commit()
    return {"message": "Tunnel deleted successfully"}


# ========================  PROJECTS  =======================================

@app.post("/api/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project."""
    p = Project(user_id=current_user.id, **project.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.get("/api/projects", response_model=List[ProjectResponse])
async def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all projects for the current user."""
    return db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).all()


@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a single project by id."""
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@app.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a project."""
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()


# ========================  AUDIT LOG  ======================================

@app.get("/api/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return recent audit log entries for the current user."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )


# ========================  ENTRY POINT  ====================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
