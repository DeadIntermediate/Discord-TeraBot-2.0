#!/bin/bash

# Monitor Tera Bot Logs (for systemd deployment)
# Usage: ./monitor-logs.sh [follow|errors|status]

case "${1:-follow}" in
  follow)
    echo "Following bot restart logs (Ctrl+C to stop)..."
    tail -f /tmp/bot-restart.log
    ;;
  
  errors)
    echo "Showing bot errors..."
    tail -100 /tmp/bot-errors.log
    ;;
  
  status)
    echo "Bot Status Report"
    echo "=================="
    echo "Failure Count: $(cat /tmp/bot-failure-count 2>/dev/null || echo '0')"
    echo "Port 5000 Status: $(lsof -i :5000 >/dev/null 2>&1 && echo '✅ RUNNING' || echo '❌ NOT RUNNING')"
    echo ""
    echo "Recent Logs:"
    tail -10 /tmp/bot-restart.log
    ;;
  
  systemd)
    echo "Following systemd journal logs (Ctrl+C to stop)..."
    sudo journalctl -u tera-bot -f
    ;;
  
  *)
    echo "Monitor Tera Bot Logs"
    echo "Usage: $0 [follow|errors|status|systemd]"
    echo ""
    echo "Options:"
    echo "  follow   - Follow restart logs in real-time (default)"
    echo "  errors   - Show recent error logs"
    echo "  status   - Show bot status and failure count"
    echo "  systemd  - Follow systemd journal (for service deployment)"
    ;;
esac
