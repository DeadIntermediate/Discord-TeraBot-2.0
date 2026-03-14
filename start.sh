#!/usr/bin/env bash
# TeraBot 2.0 — Self-healing startup script
# Designed for Debian 12/13. Run with: bash start.sh

set -uo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
success() { echo -e "${CYAN}[OK]${NC}    $*"; }
section() { echo -e "\n${BLUE}━━━━  $*  ━━━━${NC}"; }

# ── Working directory ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Privilege helpers ─────────────────────────────────────────────────────────
if [ "$(id -u)" -eq 0 ]; then
  AS_ROOT() { "$@"; }
  AS_POSTGRES() { su -s /bin/bash -c "$1" postgres; }
else
  if ! command -v sudo &>/dev/null; then
    error "This script needs sudo or must be run as root."
    exit 1
  fi
  AS_ROOT() { sudo "$@"; }
  AS_POSTGRES() { sudo -u postgres bash -c "$1"; }
fi

# ── apt helper (update once, install quietly) ─────────────────────────────────
APT_UPDATED=false
apt_install() {
  if [ "$APT_UPDATED" = false ]; then
    info "Updating apt package list..."
    AS_ROOT apt-get update -qq
    APT_UPDATED=true
  fi
  info "Installing: $*"
  AS_ROOT apt-get install -y -qq "$@"
}

# ── .env helpers ──────────────────────────────────────────────────────────────
env_get() {
  local val
  val=$(grep -E "^${1}=" .env 2>/dev/null | head -1 | cut -d'=' -f2-)
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  echo "$val"
}

env_set() {
  if grep -q "^${1}=" .env 2>/dev/null; then
    sed -i "s|^${1}=.*|${1}=${2}|" .env
  else
    echo "${1}=${2}" >> .env
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Ensure .env exists before anything else
# ═════════════════════════════════════════════════════════════════════════════
section ".env file"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    warn ".env not found — creating from .env.example."
    cp .env.example .env
    info ".env created. Database credentials will be filled in automatically."
    info "You will need to set DISCORD_BOT_TOKEN manually after this run."
  else
    warn ".env not found — creating a fresh one."
    cat > .env << 'EOF'
# Discord Bot Configuration
DISCORD_BOT_TOKEN=

# PostgreSQL Database Configuration (auto-filled by start.sh)
DATABASE_URL=
PGHOST=localhost
PGPORT=5432
PGUSER=
PGPASSWORD=
PGDATABASE=discord_bot

# Node Environment
NODE_ENV=production
EOF
    info ".env created. Database credentials will be filled in automatically."
    info "You will still need to set DISCORD_BOT_TOKEN manually."
  fi
fi

success ".env file present"

# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — System dependencies
# ═════════════════════════════════════════════════════════════════════════════
section "Node.js (v20 LTS)"

NODE_MIN=20
install_node() {
  info "Installing Node.js v${NODE_MIN} via NodeSource..."
  apt_install curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN}.x | AS_ROOT bash - >/dev/null 2>&1
  apt_install nodejs
}

if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if [ "$NODE_VER" -ge "$NODE_MIN" ]; then
    success "Node.js $(node --version)"
  else
    warn "Node.js $(node --version) is too old (need v${NODE_MIN}+). Upgrading..."
    install_node
  fi
else
  warn "Node.js not found."
  install_node
fi

section "ffmpeg  (required for TTS voice)"

if command -v ffmpeg &>/dev/null; then
  success "ffmpeg $(ffmpeg -version 2>&1 | awk 'NR==1{print $3}')"
else
  warn "ffmpeg not found. Installing..."
  apt_install ffmpeg
fi

section "Build tools  (required for @discordjs/opus)"

MISSING_BUILD=()
command -v gcc     &>/dev/null || MISSING_BUILD+=(build-essential)
command -v python3 &>/dev/null || MISSING_BUILD+=(python3)

if [ ${#MISSING_BUILD[@]} -eq 0 ]; then
  success "Build tools (gcc, make, python3)"
else
  warn "Missing build tools. Installing..."
  apt_install $(echo "${MISSING_BUILD[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' ')
fi

section "PostgreSQL client"

if command -v psql &>/dev/null; then
  success "psql $(psql --version | awk '{print $3}')"
else
  warn "PostgreSQL client not found. Installing..."
  apt_install postgresql-client
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 3 — Database setup (writes credentials into .env automatically)
# ═════════════════════════════════════════════════════════════════════════════
section "PostgreSQL database"

setup_local_db() {
  local DB_USER="terabot"
  local DB_NAME="discord_bot"
  local DB_HOST="localhost"
  local DB_PORT="5432"
  local DB_PASS
  DB_PASS=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)

  info "Creating PostgreSQL user '${DB_USER}' and database '${DB_NAME}'..."

  # Create or update the role
  AS_POSTGRES "psql -c \"DO \\\$\\\$ BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      ALTER USER \\\"${DB_USER}\\\" WITH PASSWORD '${DB_PASS}';
    ELSE
      CREATE USER \\\"${DB_USER}\\\" WITH PASSWORD '${DB_PASS}';
    END IF;
  END \\\$\\\$;\""

  # Create database if it doesn't exist
  AS_POSTGRES "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\" | grep -q 1 || \
    psql -c \"CREATE DATABASE \\\"${DB_NAME}\\\" OWNER \\\"${DB_USER}\\\";\""

  AS_POSTGRES "psql -c \"GRANT ALL PRIVILEGES ON DATABASE \\\"${DB_NAME}\\\" TO \\\"${DB_USER}\\\";\""

  local NEW_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

  # ── Write credentials into .env ───────────────────────────────────────────
  info "Writing database credentials into .env..."
  env_set "DATABASE_URL" "${NEW_URL}"
  env_set "PGHOST"       "${DB_HOST}"
  env_set "PGPORT"       "${DB_PORT}"
  env_set "PGUSER"       "${DB_USER}"
  env_set "PGPASSWORD"   "${DB_PASS}"
  env_set "PGDATABASE"   "${DB_NAME}"

  # ── Save credentials file ─────────────────────────────────────────────────
  cat > db_credentials.txt << EOF
TeraBot — PostgreSQL Credentials
Generated : $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Host      : ${DB_HOST}
Port      : ${DB_PORT}
Database  : ${DB_NAME}
Username  : ${DB_USER}
Password  : ${DB_PASS}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connection URL:
${NEW_URL}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keep this file safe. Do NOT commit it to git.
EOF

  # ── Print credentials to console ──────────────────────────────────────────
  echo ""
  echo -e "${CYAN}┌──────────────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}│          Database credentials created                │${NC}"
  echo -e "${CYAN}├──────────────────────────────────────────────────────┤${NC}"
  printf "${CYAN}│${NC}  %-10s %s\n" "Host:"     "${DB_HOST}    ${CYAN}│${NC}"
  printf "${CYAN}│${NC}  %-10s %s\n" "Port:"     "${DB_PORT}    ${CYAN}│${NC}"
  printf "${CYAN}│${NC}  %-10s %s\n" "Database:" "${DB_NAME} ${CYAN}│${NC}"
  printf "${CYAN}│${NC}  %-10s %s\n" "Username:" "${DB_USER} ${CYAN}│${NC}"
  printf "${CYAN}│${NC}  %-10s %s\n" "Password:" "${DB_PASS} ${CYAN}│${NC}"
  echo -e "${CYAN}├──────────────────────────────────────────────────────┤${NC}"
  echo -e "${CYAN}│${NC}  Credentials written to .env and db_credentials.txt  ${CYAN}│${NC}"
  echo -e "${CYAN}└──────────────────────────────────────────────────────┘${NC}"
  echo ""

  DB_URL="$NEW_URL"
}

ensure_postgres_running() {
  if systemctl list-units --type=service 2>/dev/null | grep -q postgresql; then
    info "Starting PostgreSQL service..."
    AS_ROOT systemctl start postgresql
    sleep 2
  fi
}

DB_URL=$(env_get "DATABASE_URL")
check_db() { [ -n "$DB_URL" ] && psql "$DB_URL" -c '\q' >/dev/null 2>&1; }

if [ -z "$DB_URL" ]; then
  warn "No DATABASE_URL in .env — setting up local database automatically..."
  ensure_postgres_running
  setup_local_db
elif ! check_db; then
  warn "Cannot connect to: $DB_URL"
  ensure_postgres_running
  if check_db; then
    success "Database connection (after service start)"
  else
    warn "Still cannot connect — recreating local database..."
    setup_local_db
    if ! check_db; then
      error "Database setup failed."
      error "Ensure PostgreSQL is installed, or set DATABASE_URL manually in .env."
      exit 1
    fi
  fi
else
  success "Database connection"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 4 — Validate .env has everything the bot needs
# ═════════════════════════════════════════════════════════════════════════════
section "Validating configuration"

# Prompt for any missing Discord credentials
DISCORD_MISSING=false
[ -z "$(env_get "DISCORD_CLIENT_ID")" ]  && DISCORD_MISSING=true
[ -z "$(env_get "DISCORD_BOT_TOKEN")" ]  && DISCORD_MISSING=true

if [ "$DISCORD_MISSING" = true ]; then
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  Missing Discord credentials.${NC}"
  echo -e "${YELLOW}  Find both at: discord.com/developers/applications${NC}"
  echo -e "${YELLOW}    → General Information → Application ID  (Client ID)${NC}"
  echo -e "${YELLOW}    → Bot → Token                           (Bot Token)${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Prompt for Client ID if missing
  if [ -z "$(env_get "DISCORD_CLIENT_ID")" ]; then
    while true; do
      read -rp "  Paste your Client ID (Application ID): " INPUT_CLIENT_ID
      INPUT_CLIENT_ID="${INPUT_CLIENT_ID// /}"
      if [ -z "$INPUT_CLIENT_ID" ]; then
        warn "No Client ID entered. Please paste your Client ID."
      elif ! [[ "$INPUT_CLIENT_ID" =~ ^[0-9]{17,20}$ ]]; then
        warn "That doesn't look like a valid Client ID (should be 17-20 digits). Try again."
      else
        env_set "DISCORD_CLIENT_ID" "$INPUT_CLIENT_ID"
        success "Client ID saved to .env"
        break
      fi
    done
    echo ""
  fi

  # Prompt for Bot Token if missing
  if [ -z "$(env_get "DISCORD_BOT_TOKEN")" ]; then
    while true; do
      read -rp "  Paste your Bot Token: " INPUT_TOKEN
      INPUT_TOKEN="${INPUT_TOKEN// /}"
      if [ -z "$INPUT_TOKEN" ]; then
        warn "No token entered. Please paste your Bot Token."
      elif [ ${#INPUT_TOKEN} -lt 50 ]; then
        warn "That doesn't look like a valid token (too short). Try again."
      else
        env_set "DISCORD_BOT_TOKEN" "$INPUT_TOKEN"
        success "Bot Token saved to .env"
        break
      fi
    done
    echo ""
  fi
fi

# Check remaining required vars
MISSING_VARS=()
for VAR in DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE; do
  [ -z "$(env_get "$VAR")" ] && MISSING_VARS+=("$VAR")
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  error "The following variables are still missing in .env:"
  for V in "${MISSING_VARS[@]}"; do error "  • $V"; done
  exit 1
fi

success "All required environment variables are set"

# ═════════════════════════════════════════════════════════════════════════════
# STEP 5 — npm dependencies
# ═════════════════════════════════════════════════════════════════════════════
section "npm dependencies"

if [ ! -d "node_modules" ]; then
  warn "node_modules not found. Running npm install..."
  npm install
elif [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
  warn "package.json changed since last install. Running npm install..."
  npm install
else
  success "npm dependencies up to date"
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 6 — Apply database schema
# ═════════════════════════════════════════════════════════════════════════════
section "Database schema"

info "Applying any pending schema changes..."
npm run db:push

# ═════════════════════════════════════════════════════════════════════════════
# STEP 7 — Launch
# ═════════════════════════════════════════════════════════════════════════════
section "Starting TeraBot 2.0"

info "All checks passed. Launching bot..."
echo ""
exec npm run dev
