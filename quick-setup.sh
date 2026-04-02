#!/bin/bash

# TeraBot 2.0 One-Command Setup
# Run this and you're done!

set -e

echo "🚀 TeraBot 2.0 - One Command Setup"
echo "=================================="

# Install Node.js if missing
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    if command -v sudo &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "❌ sudo not available. Please install Node.js manually:"
        echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | bash"
        echo "   apt-get install -y nodejs"
        exit 1
    fi
fi

# Check PostgreSQL
if command -v psql &> /dev/null && pg_isready -h localhost -p 5432 &> /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️ PostgreSQL not detected or not running"
    if command -v sudo &> /dev/null; then
        echo "🗄️ Installing PostgreSQL..."
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    else
        echo "❌ sudo not available. Please ensure PostgreSQL is installed and running:"
        echo "   apt-get install -y postgresql postgresql-contrib"
        echo "   systemctl start postgresql"
        echo "   systemctl enable postgresql"
        echo ""
        echo "Or use a cloud database (recommended for containers)"
    fi
fi

# Run the quick setup
echo "⚙️ Running setup..."
chmod +x setup.sh
./setup.sh

echo ""
echo "🎉 All done! Edit .env and run 'npm run dev'"