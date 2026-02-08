#!/usr/bin/env bash
# ============================================================
#  DeployX  —  One-Command Bootstrap Script
#  Clone → run this script → platform is live.
# ============================================================
set -euo pipefail

# ---------- colours ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

banner() {
  echo ""
  echo -e "${BLUE}${BOLD}=====================================================${NC}"
  echo -e "${BLUE}${BOLD}   DeployX — Self-Hosted DevOps Deployment Platform   ${NC}"
  echo -e "${BLUE}${BOLD}=====================================================${NC}"
  echo ""
}

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERR]${NC}   $*"; }
step()    { echo -e "\n${BOLD}▸ $*${NC}"; }

banner

# ---------- 0. root guard ----------
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  err "Please run as a regular user (not root). The script uses sudo where needed."
  exit 1
fi

# ---------- 1. detect & install docker ----------
step "Step 1/6 — Checking Docker"

if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  warn "Docker not found — installing …"

  # Detect distro info
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
  fi

  # Kali, Parrot, and other Debian derivatives are not recognised by
  # get.docker.com, so we install Docker manually with a known-good
  # Debian codename (bookworm).
  _ID="${ID:-}"
  _ID_LIKE="${ID_LIKE:-}"

  if [[ "$_ID" == "kali" ]] || [[ "$_ID" == "parrot" ]] || \
     { [[ "$_ID_LIKE" == *"debian"* ]] && ! [[ "$_ID" =~ ^(debian|ubuntu|raspbian)$ ]]; }; then
    warn "Detected $_ID (Debian derivative) — using manual Docker install with bookworm repo"

    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg >/dev/null

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
      | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/debian bookworm stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -qq
    sudo apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin >/dev/null
  else
    # Standard distros (Debian, Ubuntu, etc.) — use the convenience script
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
  fi

  sudo usermod -aG docker "$USER"
  info "Docker installed. You may need to log out & back in for group changes."
  info "Re-run this script after re-login if Docker commands fail."
fi

if ! docker compose version &>/dev/null; then
  err "docker compose (v2 plugin) not found."
  err "Install: https://docs.docker.com/compose/install/"
  exit 1
fi
info "Docker Compose OK: $(docker compose version --short)"

# ---------- 2. prepare .env ----------
step "Step 2/6 — Preparing environment variables"

if [[ ! -f .env ]]; then
  cp .env.example .env

  # Generate secure random secrets
  DB_PASS=$(openssl rand -base64 32 | tr -d '=+/' | head -c 28)
  SECRET=$(openssl rand -base64 48 | tr -d '=+/' | head -c 50)

  # Portable sed (macOS & Linux)
  if sed --version &>/dev/null 2>&1; then
    SED_INPLACE="sed -i"
  else
    SED_INPLACE="sed -i ''"
  fi

  $SED_INPLACE "s|change_this_password_in_production|${DB_PASS}|g" .env
  $SED_INPLACE "s|your-super-secret-key-change-this-in-production-min-32-chars|${SECRET}|g" .env

  info ".env created with secure random credentials"
else
  warn ".env already exists — skipping generation"
fi

# ---------- 3. pull base images ----------
step "Step 3/6 — Pulling Docker images"
docker compose pull 2>/dev/null || true

# ---------- 4. build application images ----------
step "Step 4/6 — Building application images"
docker compose build

# ---------- 5. start services ----------
step "Step 5/6 — Starting services"
docker compose up -d

# ---------- 6. health wait ----------
step "Step 6/6 — Waiting for services to become healthy"

MAX_WAIT=60; ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if docker compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  printf "."
done
echo ""

# ---------- summary ----------
echo ""
info "Service status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}${BOLD}======================================${NC}"
echo -e "${GREEN}${BOLD}   DeployX is running!${NC}"
echo -e "${GREEN}${BOLD}======================================${NC}"
echo ""
echo -e "  Dashboard →  ${BOLD}http://${SERVER_IP}:3000${NC}"
echo -e "  API       →  ${BOLD}http://${SERVER_IP}:3000/api${NC}  (proxied)"
echo -e "  Traefik   →  ${BOLD}http://${SERVER_IP}:8080${NC}  (dashboard)"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo "    1. Open http://${SERVER_IP}:3000 in your browser"
echo "    2. Register the admin account"
echo "    3. Configure Cloudflare Tunnel for public HTTPS access"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo "    View logs         docker compose logs -f"
echo "    Stop              docker compose down"
echo "    Restart           docker compose restart"
echo "    Start tunnel      docker compose --profile tunnel up -d"
echo ""
