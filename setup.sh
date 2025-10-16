#!/bin/bash

# TeraBot 2.0 Automated Setup Script for Linux/macOS
# Author: Josh (DeadIntermediate)
# Version: 2.1.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script arguments
SKIP_DEPS=false
REPAIR_MODE=false
CLOUD_DATABASE=false
DATABASE_URL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-dependencies)
            SKIP_DEPS=true
            shift
            ;;
        --repair)
            REPAIR_MODE=true
            shift
            ;;
        --cloud-database)
            CLOUD_DATABASE=true
            shift
            ;;
        --database-url)
            DATABASE_URL="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists "apt-get"; then
            echo "ubuntu"
        elif command_exists "yum"; then
            echo "centos"
        elif command_exists "pacman"; then
            echo "arch"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Function to install Node.js
install_nodejs() {
    print_status "🔧 Installing Node.js..." "$BLUE"
    
    local os=$(detect_os)
    
    case $os in
        ubuntu)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        centos)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        arch)
            sudo pacman -S nodejs npm
            ;;
        macos)
            if command_exists "brew"; then
                brew install node
            else
                print_status "❌ Homebrew not found. Please install Node.js manually from https://nodejs.org" "$RED"
                return 1
            fi
            ;;
        *)
            print_status "❌ Unsupported OS. Please install Node.js manually from https://nodejs.org" "$RED"
            return 1
            ;;
    esac
    
    print_status "✅ Node.js installed successfully!" "$GREEN"
    return 0
}

# Function to install PostgreSQL
install_postgresql() {
    print_status "🗄️ Installing PostgreSQL..." "$BLUE"
    
    local os=$(detect_os)
    
    case $os in
        ubuntu)
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        centos)
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        arch)
            sudo pacman -S postgresql
            sudo -u postgres initdb -D /var/lib/postgres/data
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        macos)
            if command_exists "brew"; then
                brew install postgresql
                brew services start postgresql
            else
                print_status "❌ Homebrew not found. Please install PostgreSQL manually" "$RED"
                return 1
            fi
            ;;
        *)
            print_status "❌ Unsupported OS. Please install PostgreSQL manually" "$RED"
            return 1
            ;;
    esac
    
    print_status "✅ PostgreSQL installed successfully!" "$GREEN"
    return 0
}

# Function to setup database
setup_database() {
    print_status "🗄️ Setting up database..." "$BLUE"
    
    if [[ "$CLOUD_DATABASE" == true ]] || [[ -n "$DATABASE_URL" ]]; then
        print_status "☁️ Using cloud database configuration..." "$BLUE"
        return 0
    fi
    
    # Check if PostgreSQL is running
    if command_exists "systemctl"; then
        if systemctl is-active --quiet postgresql; then
            print_status "✅ PostgreSQL service is running!" "$GREEN"
            return 0
        else
            print_status "⚠️ PostgreSQL service not running. Attempting to start..." "$YELLOW"
            sudo systemctl start postgresql || {
                print_status "❌ Failed to start PostgreSQL service" "$RED"
                return 1
            }
        fi
    elif [[ "$(detect_os)" == "macos" ]]; then
        if brew services list | grep postgresql | grep started >/dev/null; then
            print_status "✅ PostgreSQL service is running!" "$GREEN"
            return 0
        else
            print_status "⚠️ Starting PostgreSQL service..." "$YELLOW"
            brew services start postgresql
        fi
    fi
    
    return 0
}

# Function to setup environment
setup_environment() {
    print_status "🔧 Setting up environment configuration..." "$BLUE"
    
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp ".env.example" ".env"
            print_status "✅ Created .env file from .env.example" "$GREEN"
        else
            print_status "⚠️ Creating basic .env file..." "$YELLOW"
            cat > .env << 'EOF'
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/discord_bot

# Individual PostgreSQL credentials
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=discord_bot

# Environment
NODE_ENV=development
EOF
            print_status "✅ Created basic .env file" "$GREEN"
        fi
        
        print_status "⚠️ Please edit .env file with your Discord bot token and database credentials!" "$YELLOW"
        print_status "📖 Instructions: https://discord.com/developers/applications" "$BLUE"
    else
        print_status "✅ .env file already exists" "$GREEN"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "📦 Installing Node.js dependencies..." "$BLUE"
    
    if [[ ! -f "package.json" ]]; then
        print_status "❌ package.json not found! Are you in the correct directory?" "$RED"
        return 1
    fi
    
    npm install && {
        print_status "✅ Node.js dependencies installed successfully!" "$GREEN"
        return 0
    } || {
        print_status "❌ Failed to install dependencies" "$RED"
        return 1
    }
}

# Function to run database migration
run_database_migration() {
    print_status "🗄️ Running database migration..." "$BLUE"
    
    npm run db:push && {
        print_status "✅ Database migration completed successfully!" "$GREEN"
        return 0
    } || {
        print_status "❌ Database migration failed" "$RED"
        print_status "💡 This might be due to database connection issues." "$YELLOW"
        print_status "💡 Check your .env file and ensure PostgreSQL is running." "$YELLOW"
        return 1
    }
}

# Function to test bot setup
test_bot_setup() {
    print_status "🧪 Testing bot setup..." "$BLUE"
    
    local required_files=("package.json" ".env" "server/index.ts" "shared/schema.ts")
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        print_status "❌ Missing required files:" "$RED"
        for file in "${missing_files[@]}"; do
            print_status "   - $file" "$RED"
        done
        return 1
    fi
    
    print_status "✅ All required files present!" "$GREEN"
    return 0
}

# Function to repair installation
repair_installation() {
    print_status "🔧 Repair mode activated..." "$YELLOW"
    
    # Remove node_modules and package-lock.json
    if [[ -d "node_modules" ]]; then
        print_status "🗑️ Removing node_modules..." "$BLUE"
        rm -rf node_modules
    fi
    
    if [[ -f "package-lock.json" ]]; then
        print_status "🗑️ Removing package-lock.json..." "$BLUE"
        rm -f package-lock.json
    fi
    
    # Clear npm cache
    print_status "🧹 Clearing npm cache..." "$BLUE"
    npm cache clean --force
    
    # Reinstall dependencies
    install_dependencies
}

# Function to show post-install instructions
show_post_install_instructions() {
    print_status "\n🎉 TeraBot 2.0 Setup Complete!" "$GREEN"
    print_status "===========================================" "$GREEN"
    echo ""
    print_status "📝 Next Steps:" "$BLUE"
    print_status "1. Edit .env file with your Discord bot token" "$YELLOW"
    print_status "2. Configure your database settings in .env" "$YELLOW"
    print_status "3. Run: npm run dev (to start in development mode)" "$YELLOW"
    print_status "4. Or run: npm start (to start in production mode)" "$YELLOW"
    echo ""
    print_status "🎮 Cards Against Humanity Setup:" "$BLUE"
    print_status "1. Use /cahadmin cards seed to initialize cards" "$YELLOW"
    print_status "2. Use /cahadmin settings family-mode to configure content" "$YELLOW"
    print_status "3. Use /cah create to start your first game!" "$YELLOW"
    echo ""
    print_status "📚 Documentation:" "$BLUE"
    print_status "- README.md - General bot information" "$YELLOW"
    print_status "- DEPLOYMENT.md - Deployment instructions" "$YELLOW"
    print_status "- CARDS_AGAINST_HUMANITY.md - CAH game documentation" "$YELLOW"
    echo ""
    print_status "❓ Need help? Check the troubleshooting section in README.md" "$BLUE"
}

# Main execution
print_status "🤖 TeraBot 2.0 Setup Script" "$BLUE"
print_status "============================" "$BLUE"
echo ""

# Check if running in correct directory
if [[ ! -f "package.json" ]]; then
    print_status "❌ Error: package.json not found!" "$RED"
    print_status "Please run this script from the TeraBot 2.0 root directory." "$YELLOW"
    exit 1
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_status "❌ Please do not run this script as root or with sudo" "$RED"
    print_status "The script will ask for sudo password when needed" "$YELLOW"
    exit 1
fi

# Repair mode
if [[ "$REPAIR_MODE" == true ]]; then
    repair_installation
    exit 0
fi

# Check dependencies
if [[ "$SKIP_DEPS" != true ]]; then
    print_status "🔍 Checking system dependencies..." "$BLUE"
    
    # Check Node.js
    if ! command_exists "node"; then
        print_status "❌ Node.js not found. Installing..." "$YELLOW"
        install_nodejs || exit 1
    else
        node_version=$(node --version)
        print_status "✅ Node.js found: $node_version" "$GREEN"
    fi
    
    # Check npm
    if ! command_exists "npm"; then
        print_status "❌ npm not found. This should be installed with Node.js!" "$RED"
        exit 1
    else
        npm_version=$(npm --version)
        print_status "✅ npm found: $npm_version" "$GREEN"
    fi
fi

# Setup database
if [[ "$CLOUD_DATABASE" != true ]]; then
    setup_database
fi

# Setup environment
setup_environment

# Install Node.js dependencies
install_dependencies || {
    print_status "❌ Failed to install dependencies. Try running with --repair" "$RED"
    exit 1
}

# Test setup
test_bot_setup || {
    print_status "❌ Setup verification failed!" "$RED"
    exit 1
}

# Run database migration
if [[ "$SKIP_DEPS" != true ]]; then
    run_database_migration
fi

# Show completion message
show_post_install_instructions

print_status "✅ Setup completed successfully!" "$GREEN"