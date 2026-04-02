#!/bin/bash

# TeraBot 2.0 Development Starter
# Loads environment variables and starts the bot in development mode

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${BLUE}→${NC} No .env file found. Copy .env.example to .env and fill in your values."
  exit 1
fi

# Load environment variables from .env
echo -e "${BLUE}→${NC} Loading environment from .env..."
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

# Start the bot
echo -e "${GREEN}✓${NC} Environment loaded. Starting bot..."
NODE_ENV=development tsx server/index.ts

