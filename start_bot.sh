#!/bin/bash

# Discord Bot Startup Script
# This script starts the Node.js Discord bot with web dashboard

echo "Starting TeraBot 2.0..."

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

# Load environment variables from .env
echo "Loading environment variables..."
export $(cat .env | grep -v '^#' | xargs)

# Start the application
echo "Starting application on port 5000..."
npm run dev
