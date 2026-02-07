# DeployX — Command Reference

Quick-reference for every CLI command you may need while running DeployX.

---

## Bootstrap

```bash
# Clone and start (fresh VPS)
git clone https://github.com/<org>/deployx.git
cd deployx/project
sudo ./quick-start.sh

# Verify installation
./verify.sh
```

---

## Docker Compose — Lifecycle

```bash
# Start all services (foreground)
docker compose up

# Start all services (background)
docker compose up -d

# Start including the Cloudflare tunnel
docker compose --profile tunnel up -d

# Rebuild images then start
docker compose up -d --build

# Stop all services
docker compose down

# Stop all services and remove volumes (DESTRUCTIVE)
docker compose --profile tunnel down -v

# Restart a single service
docker compose restart backend

# View running containers
docker compose ps

# Follow logs for all services
docker compose logs -f

# Follow logs for one service
docker compose logs -f backend
```

---

## Docker Compose — Build

```bash
# Build all images
docker compose build

# Build with no cache
docker compose build --no-cache

# Build a single service
docker compose build frontend
```

---

## Backend (FastAPI)

```bash
# Shell into the backend container
docker compose exec backend bash

# Run database migrations (if using Alembic)
docker compose exec backend alembic upgrade head

# Check API health
curl http://localhost:3000/api/health

# Check platform status
curl http://localhost:3000/api/platform/status

# Register a user (first user = admin)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","username":"admin","password":"StrongPass1!"}'

# Login and get JWT
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=StrongPass1!"

# Use the token (replace <TOKEN>)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <TOKEN>"

# List projects
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer <TOKEN>"

# Create a project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","description":"My application","repository_url":"https://github.com/org/repo"}'

# View audit logs
curl http://localhost:3000/api/audit-logs \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Frontend (Next.js)

```bash
# Shell into the frontend container
docker compose exec frontend sh

# Local development (outside Docker)
cd frontend
npm install
npm run dev          # http://localhost:3000

# Production build
npm run build
npm start
```

---

## PostgreSQL

```bash
# Interactive psql session
docker compose exec postgres psql -U deployx deployx

# Run a query directly
docker compose exec postgres psql -U deployx deployx -c "SELECT * FROM users;"

# Backup
docker compose exec postgres pg_dump -U deployx deployx > backup.sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U deployx deployx

# List tables
docker compose exec postgres psql -U deployx deployx -c "\dt"

# Show table structure
docker compose exec postgres psql -U deployx deployx -c "\d users"
```

---

## Traefik

```bash
# View Traefik dashboard
open http://localhost:8080

# Check Traefik logs
docker compose logs -f traefik

# Validate config
docker compose exec traefik traefik healthcheck
```

---

## Cloudflare Tunnel

```bash
# Start tunnel (after TUNNEL_TOKEN is set in .env)
docker compose --profile tunnel up -d cloudflared

# Stop tunnel only
docker compose stop cloudflared

# Check tunnel status
docker compose logs -f cloudflared

# Manually set tunnel token
echo 'TUNNEL_TOKEN=eyJh...' >> .env
docker compose --profile tunnel up -d cloudflared
```

---

## Environment & Secrets

```bash
# Generate a new secret key
openssl rand -hex 32

# Generate a new database password
openssl rand -base64 24

# View current env (careful — contains secrets)
cat .env

# Rebuild .env from example
cp .env.example .env
# Then edit manually or re-run quick-start.sh
```

---

## CI/CD (GitHub Actions)

```bash
# Run backend tests locally (matching CI)
cd backend
pip install -r requirements.txt
pip install pytest httpx
pytest

# Run frontend build locally (matching CI)
cd frontend
npm ci
npm run build

# Trigger a deployment (push to main)
git add -A
git commit -m "deploy: update"
git push origin main
```

---

## Debugging

```bash
# Check which ports are bound
docker compose ps --format "table {{.Name}}\t{{.Ports}}"

# Inspect a container
docker inspect deployx-backend-1

# Check container resource usage
docker stats --no-stream

# Check Docker networks
docker network ls
docker network inspect project_deployx-internal

# Remove all stopped containers and dangling images
docker system prune -f

# Full cleanup (DESTRUCTIVE)
docker system prune -af --volumes
```
