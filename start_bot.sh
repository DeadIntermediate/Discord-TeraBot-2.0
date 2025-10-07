#!/bin/bash

# Discord Bot Startup Script for Raspberry Pi
# This script starts both the Node.js web dashboard and Python Discord bot

echo "Starting Discord Bot with Web Dashboard..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure your settings."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Create Python virtual environment if it doesn't exist
if [ ! -d venv ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate Python virtual environment
echo "Activating Python virtual environment..."
source venv/bin/activate

# Check if Python dependencies are installed
if ! python3 -c "import discord" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip install -r python_requirements.txt
fi

# Start the application
echo "Starting application on port 5000..."
npm run dev
