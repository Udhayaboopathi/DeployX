# DeployX - Self-Hosted DevOps Platform

<div align="center">

![DeployX Logo](https://via.placeholder.com/150x150.png?text=DeployX)

**A Production-Ready, Self-Hosted DevOps Platform as a Service (PaaS)**

[![CI/CD](https://github.com/yourusername/deployx/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/yourusername/deployx/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Security](#security)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

**DeployX** is a comprehensive, self-hosted DevOps platform that demonstrates modern infrastructure management and deployment automation principles. Designed as a Final Year DevOps Project, it showcases real-world implementation of:

- **Containerization** with Docker
- **Service Orchestration** with Docker Compose
- **Reverse Proxy & Load Balancing** with Traefik
- **Secure Public Access** via Cloudflare Tunnel (without static IP)
- **Authentication & Authorization**
- **Database Management** with PostgreSQL
- **Modern Web Stack** (Next.js + FastAPI)
- **CI/CD Automation** with GitHub Actions

## ✨ Features

### Core Functionality

- 🚀 **One-Command Deployment**: Deploy entire stack with `docker compose up -d`
- 🔐 **User Authentication**: Secure registration and login system
- ☁️ **Cloudflare Integration**: Automatic tunnel creation and DNS configuration
- 🌐 **Public Access**: HTTPS-enabled public URL without exposing ports
- 📊 **Dashboard**: Modern, responsive web interface
- 🔒 **Security First**: JWT authentication, password hashing, isolated networks

### Infrastructure

- 🐳 **Containerized Services**: All components run in isolated Docker containers
- 🔄 **Reverse Proxy**: Traefik handles internal routing and load balancing
- 🗄️ **PostgreSQL Database**: Persistent data storage with automatic initialization
- 🌉 **Cloudflare Tunnel**: Secure ingress without port forwarding
- 📡 **Internal Networking**: Services communicate on private Docker network

### DevOps Practices

- ✅ **CI/CD Pipeline**: Automated testing, building, and deployment
- 🧪 **Quality Assurance**: Linting, testing, security scanning
- 📦 **Container Registry**: GitHub Container Registry integration
- 🔍 **Monitoring Ready**: Structured logging and health checks
- 📝 **Documentation**: Comprehensive guides and inline comments

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          INTERNET                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
                   ┌──────────────────────┐
                   │  Cloudflare Tunnel   │
                   │   (cloudflared)      │
                   └──────────────────────┘
                              │
                              │ HTTP
                              ▼
                   ┌──────────────────────┐
                   │      Traefik         │
                   │  (Reverse Proxy)     │
                   └──────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
     ┌──────────────────┐        ┌──────────────────┐
     │   Next.js        │        │    FastAPI       │
     │   Frontend       │◄──────►│    Backend       │
     │   (Port 3000)    │        │   (internal)     │
     └──────────────────┘        └──────────────────┘
                                           │
                                           ▼
                                ┌──────────────────┐
                                │   PostgreSQL     │
                                │    Database      │
                                │   (internal)     │
                                └──────────────────┘

          All services on internal Docker bridge network
```

### Technology Stack

#### Frontend

- **Next.js 14**: React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **React Hook Form**: Form validation
- **Zustand**: State management

#### Backend

- **FastAPI**: High-performance Python API framework
- **SQLAlchemy**: ORM for database operations
- **PostgreSQL**: Relational database
- **JWT**: Secure authentication
- **Pydantic**: Data validation

#### Infrastructure

- **Docker**: Containerization platform
- **Docker Compose**: Multi-container orchestration
- **Traefik**: Modern reverse proxy and load balancer
- **Cloudflare Tunnel**: Secure ingress solution
- **GitHub Actions**: CI/CD automation

## 📦 Prerequisites

Before deploying DeployX, ensure you have:

### Required Software

- **Docker** (v24.0 or later)
- **Docker Compose** (v2.20 or later)
- **Git** (for cloning the repository)

### Cloudflare Account Setup

1. A Cloudflare account with a domain added
2. Cloudflare API Token with the following permissions:
   - Zone:Read
   - DNS:Edit
   - Account:Read
   - Argo Tunnel:Edit

### System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB+ recommended
- **Storage**: 10GB+ free space
- **OS**: Linux, macOS, or Windows with WSL2

## 🚀 Quick Start

### Option A — Automated Bootstrap (Recommended)

```bash
git clone https://github.com/yourusername/deployx.git
cd deployx/project
sudo ./quick-start.sh
```

The script installs Docker (if needed), generates secrets, builds images, and starts all services.

### Option B — Manual Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/deployx.git
cd deployx/project
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your preferred editor
nano .env
```

Update the following critical values:

```env
POSTGRES_PASSWORD=your_secure_password_here
SECRET_KEY=your_super_secret_key_minimum_32_characters
```

### 3. Deploy the Platform

```bash
# Start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Access the Platform

1. Open your browser and navigate to:

   ```
   http://<your-server-ip>:3000
   ```

2. **Register** a new account (first-time setup)

3. **Login** with your credentials

4. **Configure Cloudflare Tunnel**:
   - Enter your Cloudflare API token
   - Specify your domain (e.g., `example.com`)
   - Choose a subdomain (e.g., `deployx`)
   - Click "Configure Tunnel"

5. **Access via Public URL**:
   - After configuration, you'll be redirected to your public URL
   - Access your platform at: `https://deployx.example.com`

## ⚙️ Configuration

### Environment Variables

| Variable                      | Description                       | Default                     |
| ----------------------------- | --------------------------------- | --------------------------- |
| `POSTGRES_DB`                 | Database name                     | `deployx`                   |
| `POSTGRES_USER`               | Database user                     | `deployx_user`              |
| `POSTGRES_PASSWORD`           | Database password                 | ⚠️ Change this!             |
| `SECRET_KEY`                  | JWT secret key                    | ⚠️ Change this!             |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration                  | `30`                        |
| `BACKEND_CORS_ORIGINS`        | Allowed CORS origins (JSON array) | `["http://localhost:3000"]` |

### Port Configuration

| Service    | Internal Port | Exposed Port  |
| ---------- | ------------- | ------------- |
| Frontend   | 3000          | 3000          |
| Backend    | 8000          | — (internal)  |
| PostgreSQL | 5432          | — (internal)  |
| Traefik    | 80 / 443      | 80, 443, 8080 |

### Docker Compose Profiles

The Cloudflare Tunnel service uses a Docker Compose profile and only starts after configuration:

```bash
# Start without tunnel (initial setup)
docker compose up -d

# After configuring tunnel, restart to activate it
docker compose --profile tunnel up -d
```

## 💡 Usage

### User Registration

1. Navigate to the registration page
2. Provide:
   - Username (min 3 characters)
   - Email address
   - Password (min 8 characters)
3. Click "Create Account"

### Cloudflare Tunnel Setup

**Prerequisites**:

- Active Cloudflare account
- Domain added to Cloudflare
- API token with appropriate permissions

**Steps**:

1. Log in to your DeployX dashboard
2. Navigate to Cloudflare configuration
3. Enter:
   - API Token
   - Domain (e.g., `example.com`)
   - Subdomain (e.g., `deployx`)
4. Submit and wait for automatic configuration
5. Access via the generated public URL

### API Documentation

FastAPI provides automatic API documentation (accessible via the Next.js proxy):

- **Health**: `http://localhost:3000/api/health`
- **Platform status**: `http://localhost:3000/api/platform/status`

> **Note**: The backend is not directly exposed. All `/api/*` requests are proxied through Next.js rewrites.

### Database Access

Connect to PostgreSQL directly:

```bash
# Using Docker exec
docker compose exec postgres psql -U deployx_user -d deployx
```

### Traefik Dashboard

Monitor routing and services:

```
http://localhost:8080/dashboard/
```

## 🔒 Security

### Best Practices Implemented

1. **Environment Variables**: Sensitive data stored in `.env` file
2. **Password Hashing**: Bcrypt for secure password storage
3. **JWT Tokens**: Stateless authentication with expiration
4. **Network Isolation**: Services on private Docker network
5. **HTTPS**: Cloudflare provides SSL/TLS encryption
6. **CORS**: Configured for specific origins
7. **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries

### Security Recommendations

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate a strong password
openssl rand -base64 32
```

### Production Checklist

- [ ] Change default passwords
- [ ] Update SECRET_KEY
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up firewall rules
- [ ] Regular backups
- [ ] Update dependencies
- [ ] Monitor logs
- [ ] Implement rate limiting
- [ ] Set up monitoring/alerting

## 🔄 CI/CD

### GitHub Actions Workflow

The project includes a comprehensive CI/CD pipeline:

```yaml
Workflow Steps:
1. Test Backend → Run Python tests
2. Test Frontend → Lint and build
3. Build Images → Push to GitHub Container Registry
4. Security Scan → Trivy vulnerability scanning
5. Deploy → Automated deployment (production)
```

### Setting Up CI/CD

1. **Enable GitHub Actions** in your repository

2. **Configure Secrets**:
   - Go to Settings → Secrets and Variables → Actions
   - Add required secrets (if deploying to VPS)

3. **Push to Main Branch**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

### Manual Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker compose down
docker compose build --no-cache
docker compose up -d

# Clean up old images
docker system prune -f
```

## 🐛 Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f [service-name]

# Restart services
docker compose restart
```

#### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection
docker exec -it deployx-postgres pg_isready
```

#### Cloudflare Tunnel Not Working

```bash
# Check cloudflared logs
docker compose logs cloudflared

# Verify tunnel token
cat .env | grep TUNNEL_TOKEN

# Restart cloudflared
docker compose restart cloudflared
```

#### Frontend Can't Connect to Backend

```bash
# The frontend proxies /api/* to the backend via Next.js rewrites.
# Check backend is running:
docker compose ps backend

# Check backend health via proxy:
curl http://localhost:3000/api/health

# Verify internal network:
docker network inspect project_deployx-internal
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker compose down -v

# Remove all images
docker rmi $(docker images -q deployx*)

# Start fresh
docker compose up -d
```

## 📚 Project Structure

```
project/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions workflow
├── backend/
│   ├── auth.py                # Authentication logic
│   ├── cloudflare_service.py  # Cloudflare API integration
│   ├── crud.py                # Database CRUD operations
│   ├── database.py            # Database configuration
│   ├── main.py                # FastAPI application
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic schemas
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Backend container image
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app directory
│   │   │   ├── auth/          # Authentication pages
│   │   │   ├── dashboard/     # Dashboard page
│   │   │   ├── globals.css    # Global styles
│   │   │   ├── layout.tsx     # Root layout
│   │   │   └── page.tsx       # Home page
│   │   └── lib/               # Utilities
│   │       ├── api.ts         # API client
│   │       └── store.ts       # State management
│   ├── package.json           # Node dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── tailwind.config.js     # Tailwind config
│   ├── next.config.js         # Next.js config
│   └── Dockerfile             # Frontend container image
├── database/
│   └── init.sql               # Database initialization
├── traefik/
│   └── traefik.yml            # Traefik configuration
├── docker-compose.yml         # Service orchestration
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🎓 Academic Context

This project demonstrates key DevOps concepts suitable for academic evaluation:

### Learning Objectives Covered

1. **Containerization**: Docker multi-stage builds, optimization
2. **Orchestration**: Docker Compose, service dependencies, health checks
3. **Networking**: Internal networks, reverse proxy, ingress
4. **Security**: Authentication, authorization, secrets management
5. **Automation**: CI/CD pipelines, infrastructure as code
6. **Modern Architecture**: Microservices, API-first design
7. **Cloud Integration**: Cloudflare API, tunneling, DNS automation

### Evaluation Criteria Addressed

- ✅ Real-world problem solving
- ✅ Modern technology stack
- ✅ Production-ready code quality
- ✅ Comprehensive documentation
- ✅ Security best practices
- ✅ Scalable architecture
- ✅ Automated deployment
- ✅ Monitoring and logging ready

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) for the amazing Python framework
- [Next.js](https://nextjs.org/) for the React framework
- [Traefik](https://traefik.io/) for the reverse proxy
- [Cloudflare](https://www.cloudflare.com/) for tunnel technology
- [Docker](https://www.docker.com/) for containerization

## 📞 Support

For issues, questions, or contributions:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/deployx/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/deployx/wiki)
- **Email**: your.email@example.com

---

<div align="center">

**Built with ❤️ for DevOps Excellence**

[⬆ Back to Top](#deployx---self-hosted-devops-platform)

</div>
