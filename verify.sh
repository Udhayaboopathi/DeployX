#!/bin/bash

# DeployX - System Verification Script
# This script verifies that all components are correctly set up

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  DeployX System Verification${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# Function to check status
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# Track errors
ERRORS=0

# 1. Check Docker
echo -e "${BOLD}1. Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    docker --version
    check_status "Docker is installed" || ((ERRORS++))
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    ((ERRORS++))
fi
echo ""

# 2. Check Docker Compose
echo -e "${BOLD}2. Checking Docker Compose...${NC}"
if docker compose version &> /dev/null; then
    docker compose version
    check_status "Docker Compose is installed" || ((ERRORS++))
else
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    ((ERRORS++))
fi
echo ""

# 3. Check if .env exists
echo -e "${BOLD}3. Checking Environment Configuration...${NC}"
if [ -f .env ]; then
    check_status ".env file exists" || ((ERRORS++))
    
    # Check for default passwords
    if grep -q "change_this_password" .env; then
        echo -e "${YELLOW}⚠${NC} Warning: Default database password detected"
        echo -e "  Please update POSTGRES_PASSWORD in .env"
    fi
    
    if grep -q "your-secret-key-change" .env; then
        echo -e "${YELLOW}⚠${NC} Warning: Default SECRET_KEY detected"
        echo -e "  Please update SECRET_KEY in .env"
    fi
else
    echo -e "${RED}✗ .env file not found${NC}"
    echo -e "  Run: ${BOLD}cp .env.example .env${NC}"
    ((ERRORS++))
fi
echo ""

# 4. Check project structure
echo -e "${BOLD}4. Checking Project Structure...${NC}"
REQUIRED_DIRS=("backend" "frontend" "database" "traefik" ".github/workflows")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        check_status "Directory exists: $dir" || ((ERRORS++))
    else
        echo -e "${RED}✗ Missing directory: $dir${NC}"
        ((ERRORS++))
    fi
done
echo ""

# 5. Check required files
echo -e "${BOLD}5. Checking Required Files...${NC}"
REQUIRED_FILES=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "backend/requirements.txt"
    "backend/main.py"
    "frontend/Dockerfile"
    "frontend/package.json"
    "database/init.sql"
    "traefik/traefik.yml"
)
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_status "File exists: $file" || ((ERRORS++))
    else
        echo -e "${RED}✗ Missing file: $file${NC}"
        ((ERRORS++))
    fi
done
echo ""

# 6. Check running services
echo -e "${BOLD}6. Checking Running Services...${NC}"
if docker compose ps &> /dev/null; then
    SERVICES=$(docker compose ps --services --filter "status=running" 2>/dev/null)
    if [ -n "$SERVICES" ]; then
        echo -e "${GREEN}Running services:${NC}"
        docker compose ps
        check_status "Services are running" || ((ERRORS++))
    else
        echo -e "${YELLOW}⚠ No services are currently running${NC}"
        echo -e "  Start services with: ${BOLD}docker compose up -d${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Unable to check service status${NC}"
fi
echo ""

# 7. Check ports
echo -e "${BOLD}7. Checking Port Availability...${NC}"
PORTS=(3000 80 8080)
for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        check_status "Port $port is in use" || true
    else
        echo -e "${YELLOW}⚠${NC} Port $port is available (service may not be running)"
    fi
done
echo ""

# 8. Test connectivity (if services are running)
echo -e "${BOLD}8. Testing Service Connectivity...${NC}"
if docker compose ps | grep -q "Up"; then
    # Test backend (via Next.js proxy)
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        check_status "Backend API is accessible (via /api proxy)" || ((ERRORS++))
    else
        echo -e "${YELLOW}⚠ Backend API is not accessible${NC}"
    fi
    
    # Test frontend
    if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
        check_status "Frontend is accessible" || ((ERRORS++))
    else
        echo -e "${YELLOW}⚠ Frontend is not accessible${NC}"
    fi
    
    # Test database
    if docker exec deployx-postgres pg_isready -U deployx_user > /dev/null 2>&1; then
        check_status "Database is ready" || ((ERRORS++))
    else
        echo -e "${YELLOW}⚠ Database is not ready${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Services are not running, skipping connectivity tests${NC}"
fi
echo ""

# 9. Check Docker resources
echo -e "${BOLD}9. Checking Docker Resources...${NC}"
if docker info > /dev/null 2>&1; then
    CONTAINERS=$(docker ps -q | wc -l)
    IMAGES=$(docker images -q | wc -l)
    VOLUMES=$(docker volume ls -q | wc -l)
    NETWORKS=$(docker network ls -q | wc -l)
    
    echo -e "  Containers: $CONTAINERS"
    echo -e "  Images: $IMAGES"
    echo -e "  Volumes: $VOLUMES"
    echo -e "  Networks: $NETWORKS"
    check_status "Docker daemon is running" || ((ERRORS++))
else
    echo -e "${RED}✗ Unable to connect to Docker daemon${NC}"
    ((ERRORS++))
fi
echo ""

# 10. Check disk space
echo -e "${BOLD}10. Checking Disk Space...${NC}"
AVAILABLE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "  Available space: $AVAILABLE"
check_status "Disk space checked" || true
echo ""

# Summary
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Verification Summary${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo -e "  Your DeployX installation is ready to use."
    echo ""
    echo -e "Next steps:"
    echo -e "  1. Start services: ${BOLD}docker compose up -d${NC}"
    echo -e "  2. View logs: ${BOLD}docker compose logs -f${NC}"
    echo -e "  3. Access frontend: ${BOLD}http://localhost:3000${NC}"
    echo ""
else
    echo -e "${RED}✗ Found $ERRORS issue(s)${NC}"
    echo -e "  Please review the errors above and fix them."
    echo -e "  Refer to DEPLOYMENT.md for detailed instructions."
    echo ""
fi

# System information
echo -e "${BOLD}System Information:${NC}"
echo -e "  OS: $(uname -s)"
echo -e "  Kernel: $(uname -r)"
echo -e "  Architecture: $(uname -m)"
if command -v docker &> /dev/null; then
    echo -e "  Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi
if docker compose version &> /dev/null; then
    echo -e "  Docker Compose: $(docker compose version --short)"
fi
echo ""

# Access URLs
if docker compose ps | grep -q "Up"; then
    echo -e "${BOLD}Access URLs:${NC}"
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo -e "  Dashboard:       ${GREEN}http://localhost:3000${NC}"
    echo -e "  API (proxied):   ${GREEN}http://localhost:3000/api/health${NC}"
    echo -e "  Traefik:         ${GREEN}http://localhost:8080/dashboard/${NC}"
    if [ -n "$SERVER_IP" ]; then
        echo -e "  External Access: ${GREEN}http://$SERVER_IP:3000${NC}"
    fi
    echo ""
fi

echo -e "${BOLD}For help, run:${NC} cat README.md"
echo -e "${BOLD}Quick reference:${NC} cat COMMANDS.md"
echo ""

exit $ERRORS
