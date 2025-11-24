#!/bin/bash

################################################################################
# TeraBot 2.0 Restart Script
# 
# Safely stops and restarts the bot
# Supports both tmux sessions and regular processes
################################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           🔄 TeraBot 2.0 - Restart Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# Check if tmux session exists
if tmux has-session -t terabot 2>/dev/null; then
    echo -e "${YELLOW}Found tmux session 'terabot'${NC}"
    echo -ne "${BLUE}[1/3]${NC} Stopping bot in tmux... "
    tmux send-keys -t terabot C-c
    sleep 2
    echo -e "${GREEN}Stopped${NC}"
    
    echo -ne "${BLUE}[2/3]${NC} Restarting bot... "
    tmux send-keys -t terabot "./start_bot.sh" C-m
    echo -e "${GREEN}Started${NC}"
    
    echo -e "${BLUE}[3/3]${NC} Bot restarted in tmux session"
    echo ""
    echo -e "${GREEN}✓ Bot restarted successfully!${NC}"
    echo "  View session: tmux attach -t terabot"
    echo "  View logs:    tmux attach -t terabot (then scroll up)"
else
    # Check for regular processes
    echo -ne "${BLUE}[1/3]${NC} Looking for bot processes... "
    BOT_PIDS=$(pgrep -f "tsx server/index.ts" 2>/dev/null || true)
    
    if [ ! -z "$BOT_PIDS" ]; then
        echo -e "${YELLOW}Found (PIDs: $BOT_PIDS)${NC}"
        echo -ne "${BLUE}[2/3]${NC} Stopping bot... "
        pkill -f "tsx server/index.ts" 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}Stopped${NC}"
    else
        echo -e "${YELLOW}Not running${NC}"
        echo -e "${BLUE}[2/3]${NC} Skipping stop step"
    fi
    
    echo -ne "${BLUE}[3/3]${NC} Starting bot... "
    ./start_bot.sh
fi
