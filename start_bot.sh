#!/bin/bash

################################################################################
# TeraBot 2.0 Startup Script
# 
# Features:
# - Environment validation
# - Dependency checks
# - Database connectivity verification
# - Process management (kills old instances)
# - Colorful output for better visibility
# - Optional background mode
#
# Usage: 
#   ./start_bot.sh              # Start in foreground
#   ./start_bot.sh --background # Start in background with PM2/nohup
#   ./start_bot.sh --production # Start in production mode
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKGROUND_MODE=false
PRODUCTION_MODE=false
SKIP_DB_CHECK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --background|-b)
      BACKGROUND_MODE=true
      shift
      ;;
    --production|-p)
      PRODUCTION_MODE=true
      shift
      ;;
    --skip-db-check)
      SKIP_DB_CHECK=true
      shift
      ;;
    --help|-h)
      echo "TeraBot 2.0 Startup Script"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -b, --background      Run bot in background"
      echo "  -p, --production      Run in production mode"
      echo "  --skip-db-check       Skip database connectivity check"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Print header
echo -e "${CYAN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🤖 TeraBot 2.0 - Startup Script 🚀"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# Check if .env file exists
echo -ne "${BLUE}[1/7]${NC} Checking environment file... "
if [ ! -f .env ]; then
    echo -e "${RED}FAILED${NC}"
    echo -e "${RED}ERROR: .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure your settings:"
    echo "  cp .env.example .env"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Validate critical environment variables
echo -ne "${BLUE}[2/7]${NC} Validating environment variables... "

# Load environment variables from .env file (handle both export and non-export formats)
set -a  # automatically export all variables
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^export //g')
set +a

MISSING_VARS=()
[ -z "$DISCORD_BOT_TOKEN" ] && MISSING_VARS+=("DISCORD_BOT_TOKEN")
[ -z "$DATABASE_URL" ] && MISSING_VARS+=("DATABASE_URL")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}FAILED${NC}"
    echo -e "${RED}ERROR: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo "Please configure these in your .env file"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Check Node.js installation
echo -ne "${BLUE}[3/7]${NC} Checking Node.js installation... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo -e "${RED}ERROR: Node.js is not installed!${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}WARNING${NC}"
    echo -e "${YELLOW}Node.js version 18+ is recommended (you have v$(node -v))${NC}"
else
    echo -e "${GREEN}OK${NC} ($(node -v))"
fi

# Check if node_modules exists
echo -ne "${BLUE}[4/7]${NC} Checking dependencies... "
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}NOT FOUND${NC}"
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# Check for existing bot processes
echo -ne "${BLUE}[5/7]${NC} Checking for running instances... "
BOT_PIDS=$(pgrep -f "tsx server/index.ts" 2>/dev/null || true)
if [ ! -z "$BOT_PIDS" ]; then
    echo -e "${YELLOW}FOUND${NC}"
    echo -e "${YELLOW}Stopping existing bot processes: $BOT_PIDS${NC}"
    pkill -f "tsx server/index.ts" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}Stopped${NC}"
else
    echo -e "${GREEN}None${NC}"
fi

# Test database connection (optional)
if [ "$SKIP_DB_CHECK" = false ]; then
    echo -ne "${BLUE}[6/7]${NC} Testing database connection... "
    
    # Create a simple test script
    cat > /tmp/db_test.js << 'EOF'
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

try {
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
  console.log('OK');
  process.exit(0);
} catch (err) {
  console.error('FAILED');
  process.exit(1);
}
EOF

    if timeout 5 node /tmp/db_test.js > /tmp/db_test_output.txt 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "${YELLOW}Warning: Could not connect to database${NC}"
        echo "The bot will attempt to connect on startup"
    fi
    rm -f /tmp/db_test.js /tmp/db_test_output.txt
else
    echo -e "${BLUE}[6/7]${NC} Database check ${YELLOW}SKIPPED${NC}"
fi

# Start the bot
echo -e "${BLUE}[7/7]${NC} Starting TeraBot..."
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$PRODUCTION_MODE" = true ]; then
    export NODE_ENV=production
    echo -e "${GREEN}Mode: Production${NC}"
    
    if [ "$BACKGROUND_MODE" = true ]; then
        echo -e "${GREEN}Running in background mode...${NC}"
        
        # Try PM2 first, fallback to nohup
        if command -v pm2 &> /dev/null; then
            pm2 delete terabot 2>/dev/null || true
            pm2 start npm --name terabot -- run start
            pm2 save
            echo -e "${GREEN}✓ Bot started with PM2${NC}"
            echo "  View logs: pm2 logs terabot"
            echo "  Stop bot:  pm2 stop terabot"
        else
            nohup npm run start > bot.log 2>&1 &
            echo -e "${GREEN}✓ Bot started in background (PID: $!)${NC}"
            echo "  View logs: tail -f bot.log"
            echo "  Stop bot:  pkill -f 'node dist/index.js'"
        fi
    else
        echo -e "${GREEN}Starting in foreground...${NC}"
        npm run start
    fi
else
    export NODE_ENV=development
    echo -e "${GREEN}Mode: Development${NC}"
    
    if [ "$BACKGROUND_MODE" = true ]; then
        echo -e "${GREEN}Running in background mode...${NC}"
        
        if command -v pm2 &> /dev/null; then
            pm2 delete terabot-dev 2>/dev/null || true
            pm2 start npm --name terabot-dev -- run dev
            pm2 save
            echo -e "${GREEN}✓ Bot started with PM2${NC}"
            echo "  View logs: pm2 logs terabot-dev"
            echo "  Stop bot:  pm2 stop terabot-dev"
        else
            nohup npm run dev > bot.log 2>&1 &
            echo -e "${GREEN}✓ Bot started in background (PID: $!)${NC}"
            echo "  View logs: tail -f bot.log"
            echo "  Stop bot:  pkill -f 'tsx server/index.js'"
        fi
    else
        echo -e "${GREEN}Starting in foreground...${NC}"
        npm run dev
    fi
fi
