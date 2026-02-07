from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid


# ---------- User Schemas ----------
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Token Schemas ----------
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# ---------- Cloudflare Schemas ----------
class CloudflareConfigCreate(BaseModel):
    api_token: str
    subdomain: str


class CloudflareConfigResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    subdomain: str
    domain: Optional[str] = None
    tunnel_id: Optional[str] = None
    tunnel_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TunnelSetupRequest(BaseModel):
    api_token: str
    domain: str
    subdomain: str


class TunnelSetupResponse(BaseModel):
    success: bool
    message: str
    tunnel_id: str
    subdomain: str
    public_url: str


# ---------- Project Schemas ----------
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None
    status: str
    last_deployed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Deployment Schemas ----------
class DeploymentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    status: str
    commit_sha: Optional[str] = None
    duration_seconds: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Platform / System Schemas ----------
class ServiceStatus(BaseModel):
    name: str
    status: str  # healthy, unhealthy, unknown
    port: Optional[int] = None
    uptime: Optional[str] = None


class PlatformStatus(BaseModel):
    platform: str
    version: str
    has_admin: bool
    has_tunnel: bool
    services: List[ServiceStatus]
    public_url: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
    description: Optional[str]
    repository_url: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
