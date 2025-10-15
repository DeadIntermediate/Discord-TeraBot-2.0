#!/bin/bash

# Discord Bot Prerequisites Installation Script
# This script installs Node.js and PostgreSQL for TeraBot 2.0

set -e  # Exit on any error

echo "=========================================="
echo "TeraBot 2.0 Prerequisites Installer"
echo "Node.js Discord Bot"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root or with sudo${NC}"
    echo "The script will ask for sudo password when needed"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing Node.js 20.x (LTS)...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js is already installed: $NODE_VERSION"
    read -p "Do you want to reinstall/update Node.js? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Verify Node.js installation
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
    echo -e "${GREEN}✓ npm installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js installation failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: PostgreSQL Database Setup${NC}"
echo "Do you want to install PostgreSQL locally?"
echo "(If you're using Neon cloud database, you can skip this)"
read -p "Install PostgreSQL? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    
    # Start and enable PostgreSQL
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    echo -e "${GREEN}✓ PostgreSQL installed${NC}"
    
    # Database setup
    echo ""
    echo -e "${YELLOW}Setting up database...${NC}"
    read -p "Enter database name (default: discord_bot): " DB_NAME
    DB_NAME=${DB_NAME:-discord_bot}
    
    read -p "Enter database user (default: botuser): " DB_USER
    DB_USER=${DB_USER:-botuser}
    
    read -sp "Enter database password: " DB_PASS
    echo
    
    # Create database and user
    sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOF
    
    echo -e "${GREEN}✓ Database '$DB_NAME' created${NC}"
    echo -e "${GREEN}✓ User '$DB_USER' created with full privileges${NC}"
    echo ""
    echo "Your DATABASE_URL will be:"
    echo "postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
else
    echo -e "${YELLOW}Skipping PostgreSQL installation${NC}"
    echo "Remember to use your Neon database URL in .env"
fi
echo ""

echo -e "${YELLOW}Step 4: Installing additional dependencies...${NC}"
sudo apt install -y build-essential git curl wget

echo -e "${GREEN}✓ Build tools installed${NC}"
echo ""

echo -e "${YELLOW}Step 5: System optimization...${NC}"

# Increase swap space for better performance
CURRENT_SWAP=$(free -m | awk '/Swap:/ {print $2}')
if [ "$CURRENT_SWAP" -lt 1024 ]; then
    read -p "Current swap is ${CURRENT_SWAP}MB. Increase to 2GB? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo dphys-swapfile swapoff
        sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
        sudo dphys-swapfile setup
        sudo dphys-swapfile swapon
        echo -e "${GREEN}✓ Swap increased to 2GB${NC}"
    fi
fi
echo ""

echo "=========================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=========================================="
echo ""
echo "Installed components:"
echo "✓ Node.js: $(node --version)"
echo "✓ npm: $(npm --version)"

if command -v psql &> /dev/null; then
    echo "✓ PostgreSQL: $(psql --version | head -n 1)"
fi

echo ""
echo "Next steps:"
echo "1. Navigate to your bot directory"
echo "2. Copy .env.example to .env and configure your settings"
echo "3. Install Node dependencies: npm install"
echo "4. Run database migrations: npm run db:push"
echo "5. Start the bot: npm run dev (or ./start_bot.sh)"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
echo ""
