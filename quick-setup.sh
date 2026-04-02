#!/bin/bash

# TeraBot 2.0 One-Command Setup
# Run this and you're done!

set -e

echo "🚀 TeraBot 2.0 - One Command Setup"
echo "=================================="

# Install Node.js if missing
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install/start PostgreSQL if missing
if ! sudo systemctl is-active --quiet postgresql 2>/dev/null; then
    echo "🗄️ Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Run the quick setup
echo "⚙️ Running setup..."
chmod +x setup.sh
./setup.sh

echo ""
echo "🎉 All done! Edit .env and run 'npm run dev'"