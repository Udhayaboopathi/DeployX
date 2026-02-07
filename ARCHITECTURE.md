# DeployX — Architecture Document

## 1. System Overview

DeployX is a **self-hosted DevOps deployment platform** composed of five containerised services orchestrated by Docker Compose. A single `quick-start.sh` script provisions the entire stack on a fresh VPS in under five minutes.

### Core Principles

| Principle             | Implementation                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------- |
| One-command bootstrap | `quick-start.sh` detects/installs Docker, generates secrets, builds & starts all containers |
| Containerisation      | Every service runs inside an isolated Docker container                                      |
| Service orchestration | Docker Compose manages lifecycle, dependencies, health checks                               |
| Secure ingress        | Cloudflare Tunnel (zero-trust) — no ports exposed to the internet                           |
| Reverse proxy         | Traefik auto-discovers containers and routes traffic internally                             |
| CI/CD readiness       | GitHub Actions pipeline: test → build → push → deploy                                       |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          INTERNET                                │
└─────────────────────────────┬────────────────────────────────────┘
                              │  HTTPS (Cloudflare Edge)
                              ▼
                   ┌──────────────────────┐
                   │  Cloudflare Tunnel   │  ← cloudflared container
                   │  (Zero-Trust Ingress)│
                   └──────────┬───────────┘
                              │  HTTP :80
                              ▼
                   ┌──────────────────────┐
                   │      Traefik v2      │  ← Reverse proxy
                   │   (Routing & LB)     │     /api  → backend
                   └────┬────────────┬────┘     /     → frontend
                        │            │
             ┌──────────┘            └──────────┐
             ▼                                  ▼
  ┌──────────────────┐               ┌──────────────────┐
  │   Next.js 14     │               │   FastAPI 0.109  │
  │   Frontend       │               │   Backend API    │
  │   (Port 3000)    │               │   (Port 8000)    │
  └──────────────────┘               └────────┬─────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │  PostgreSQL 15   │
                                   │  (Port 5432)     │
                                   └──────────────────┘
```

---

## 3. Service Matrix

| Service         | Technology                         | Internal Port |   Host Port   | Purpose                                      |
| --------------- | ---------------------------------- | :-----------: | :-----------: | -------------------------------------------- |
| **frontend**    | Next.js 14, React 18, Tailwind CSS |     3000      |     3000      | Dashboard UI, onboarding wizard              |
| **backend**     | FastAPI, SQLAlchemy, Uvicorn       |     8000      | — (internal)  | REST API, Cloudflare automation, JWT auth    |
| **postgres**    | PostgreSQL 15 Alpine               |     5432      | — (internal)  | Persistent data (users, configs, audit logs) |
| **traefik**     | Traefik v2.10                      |    80/443     | 80, 443, 8080 | Reverse proxy, Docker provider               |
| **cloudflared** | cloudflare/cloudflared             |       —       |       —       | Secure tunnel to Cloudflare edge             |

> **Security note:** The backend and database have **no host-port bindings**. They are reachable only within the `deployx-internal` Docker bridge network.

---

## 4. Network Topology

All containers are attached to a single Docker bridge network `deployx-internal`.

**Before tunnel configuration:**

- User accesses `http://<server-ip>:3000` directly.
- Frontend calls backend at the host IP via `NEXT_PUBLIC_API_URL`.

**After tunnel configuration:**

- All public traffic flows: `CF Edge → cloudflared → traefik:80 → frontend/backend`.
- Host ports can optionally be removed; only internal traffic remains.
- HTTPS is terminated at Cloudflare Edge — zero certificate management required.

---

## 5. Data Flow — First-Time Onboarding

```
User opens http://<ip>:3000
        │
        ▼
  GET /api/platform/status  ──→  { has_admin: false }
        │
        ▼  redirect to /auth/register
  POST /api/auth/register   ──→  first user = admin (is_superuser)
        │
        ▼  redirect to /auth/login
  POST /api/auth/token      ──→  JWT issued
        │
        ▼  redirect to /dashboard (onboarding banner shown)
  POST /api/cloudflare/setup
        │   ├─ Validate CF API token
        │   ├─ Create tunnel via CF API
        │   ├─ Add DNS CNAME record
        │   ├─ Configure tunnel routing → traefik:80
        │   └─ Persist token to .env + DB
        ▼
  Redirect to https://subdomain.domain.com
```

---

## 6. Database Schema (ERD)

```
users
  id              UUID PK
  email           VARCHAR UNIQUE
  username        VARCHAR UNIQUE
  hashed_password VARCHAR
  is_superuser    BOOLEAN
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

cloudflare_configs
  id              UUID PK
  user_id         UUID FK → users.id  UNIQUE
  api_token       TEXT
  zone_id         VARCHAR
  domain          VARCHAR
  subdomain       VARCHAR
  tunnel_id       VARCHAR
  tunnel_token    TEXT
  is_active       BOOLEAN

projects
  id              UUID PK
  user_id         UUID FK → users.id
  name            VARCHAR
  description     TEXT
  repository_url  VARCHAR
  status          VARCHAR

deployments
  id              UUID PK
  project_id      UUID FK → projects.id
  user_id         UUID FK → users.id
  status          VARCHAR
  commit_sha      VARCHAR(40)
  duration_seconds INTEGER

audit_logs
  id              UUID PK
  user_id         UUID FK → users.id
  action          VARCHAR
  resource_type   VARCHAR
  details         JSONB
  ip_address      VARCHAR
  created_at      TIMESTAMPTZ
```

---

## 7. API Surface

| Method | Endpoint                      | Auth | Description                                        |
| ------ | ----------------------------- | :--: | -------------------------------------------------- |
| GET    | `/api/health`                 |  —   | Deep health check (API + DB)                       |
| GET    | `/api/platform/status`        |  —   | Onboarding state (has_admin, has_tunnel, services) |
| POST   | `/api/auth/register`          |  —   | Create user (first = admin)                        |
| POST   | `/api/auth/token`             |  —   | Login, return JWT                                  |
| GET    | `/api/auth/me`                | JWT  | Current user info                                  |
| POST   | `/api/cloudflare/setup`       | JWT  | Provision tunnel + DNS                             |
| GET    | `/api/cloudflare/config`      | JWT  | Current tunnel config                              |
| DELETE | `/api/cloudflare/tunnel/{id}` | JWT  | Tear down tunnel                                   |
| POST   | `/api/projects`               | JWT  | Create project                                     |
| GET    | `/api/projects`               | JWT  | List projects                                      |
| GET    | `/api/projects/{id}`          | JWT  | Get project                                        |
| DELETE | `/api/projects/{id}`          | JWT  | Delete project                                     |
| GET    | `/api/audit-logs`             | JWT  | Recent audit entries                               |

---

## 8. CI/CD Pipeline

```
push to main
      │
      ├─ test-backend  (Python 3.11 + Postgres service container)
      ├─ test-frontend  (Node 18, npm ci, npm run build)
      │
      ▼  (on success)
  build-and-push  →  GHCR (ghcr.io/<owner>/deployx-backend, -frontend)
      │
      ▼
  security-scan   (Trivy file-system scan)
      │
      ▼
  deploy          (SSH → pull → docker compose up -d)
```

---

## 9. Directory Layout

```
project/
├── backend/                    # FastAPI service
│   ├── main.py                 # All API routes
│   ├── models.py               # SQLAlchemy ORM
│   ├── schemas.py              # Pydantic models
│   ├── auth.py                 # JWT + bcrypt
│   ├── crud.py                 # DB operations
│   ├── cloudflare_service.py   # CF API client
│   ├── database.py             # Engine, session, Base
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # Next.js 14 dashboard
│   ├── src/app/                # App Router pages
│   ├── src/lib/                # API client, Zustand store
│   ├── package.json
│   └── Dockerfile
├── database/
│   └── init.sql                # DDL (auto-runs on first start)
├── traefik/
│   └── traefik.yml             # Static config
├── .github/workflows/
│   └── ci-cd.yml               # GitHub Actions
├── docker-compose.yml
├── quick-start.sh              # One-command bootstrap
├── .env.example
├── verify.sh                   # Post-install verification
└── README.md
```

---

## 10. Security Considerations

| Area              | Measure                                               |
| ----------------- | ----------------------------------------------------- |
| Passwords         | bcrypt hashing via passlib                            |
| Auth tokens       | Short-lived JWT (HS256, 30 min)                       |
| Network isolation | Backend + DB on internal-only Docker network          |
| Public ingress    | Cloudflare Tunnel (no open ports)                     |
| Secrets           | `.env` excluded from git; auto-generated by bootstrap |
| Container runtime | Minimal Alpine / slim images; Trivy scanning in CI    |
| Docker socket     | Mounted read-only into Traefik only                   |
