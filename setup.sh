#!/bin/bash

# TeraBot 2.0 Quick Setup Script
# Author: Josh (DeadIntermediate)
# Version: 3.0.0 - Simplified

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Simple status function
status() { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Check if command exists
has() { command -v "$1" >/dev/null 2>&1; }

# Detect OS (simplified)
detect_os() {
    case "$(uname -s)" in
        Linux) echo "linux" ;;
        Darwin) echo "macos" ;;
        *) echo "unknown" ;;
    esac
}

# Quick dependency check
check_deps() {
    status "Checking system requirements..."

    if ! has node; then
        error "Node.js not found!"
        warning "Install Node.js from https://nodejs.org or run:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        exit 1
    fi

    if ! has npm; then
        error "npm not found!"
        exit 1
    fi

    success "Node.js $(node --version) and npm $(npm --version) found"
}

# Quick database check
check_database() {
    status "Checking database..."

    # Try to connect to database
    if timeout 5 bash -c "</dev/tcp/localhost/5432" 2>/dev/null; then
        success "PostgreSQL is running on localhost:5432"
        return 0
    fi

    warning "PostgreSQL not detected on localhost:5432"
    warning "Make sure PostgreSQL is running, or use a cloud database"
    warning "For local PostgreSQL, run:"
    echo "  sudo systemctl start postgresql  # Linux"
    echo "  brew services start postgresql  # macOS"
}

# Setup environment file
setup_env() {
    if [[ -f ".env" ]]; then
        success ".env file already exists"
        return 0
    fi

    status "Creating .env file..."

    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        success "Created .env from .env.example"
    else
        # Create minimal .env
        cat > .env << 'EOF'
# Discord Bot Token (get from https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=your_bot_token_here

# Database URL (use your own PostgreSQL or cloud database)
DATABASE_URL=postgresql://postgres:password@localhost:5432/discord_bot

# Environment
NODE_ENV=development
EOF
        success "Created basic .env file"
    fi

    warning "Edit .env file with your Discord bot token and database URL!"
}

# Install dependencies
install_deps() {
    status "Installing dependencies..."

    if [[ ! -d "node_modules" ]]; then
        NODE_OPTIONS="--max-old-space-size=4096" npm install --omit=optional
        success "Dependencies installed"
    else
        success "Dependencies already installed"
    fi
}

# Setup database
setup_db() {
    status "Setting up database..."

    if npm run db:push 2>/dev/null; then
        success "Database schema created"
    else
        warning "Database setup failed - check your .env DATABASE_URL"
        warning "Make sure PostgreSQL is running and credentials are correct"
    fi
}

# Main setup
main() {
    echo -e "${BLUE}🤖 TeraBot 2.0 Quick Setup${NC}"
    echo -e "${BLUE}=========================${NC}"
    echo ""

    # Basic checks
    check_deps
    check_database
    echo ""

    # Setup
    setup_env
    echo ""
    install_deps
    echo ""
    setup_db
    echo ""

    # Success message
    success "Setup complete!"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Edit .env with your Discord bot token"
    echo "2. Configure your database URL if needed"
    echo "3. Run: npm run dev"
    echo ""
    echo -e "${BLUE}Need help? Check README.md${NC}"
}

# Run main function
main "$@"

print_status "✅ Setup completed successfully!" "$GREEN"