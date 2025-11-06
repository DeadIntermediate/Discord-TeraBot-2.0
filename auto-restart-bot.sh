#!/bin/bash

################################################################################
# Tera Bot Auto-Restart Script with Failure Tracking & Notifications
# 
# Features:
# - Automatically restarts bot if it crashes
# - Tracks consecutive failures (stops after 3)
# - Sends email/Discord notifications with logs on 3 failures
# - Logs all restarts and crashes
#
# Usage: ./auto-restart-bot.sh [--email your@email.com] [--discord-webhook URL]
################################################################################

set -e

# Configuration
BOT_DIR="/home/deadintermediate/Desktop/Terabot/Discord-TeraBot-2.0"
LOG_FILE="/tmp/bot-restart.log"
ERROR_LOG="/tmp/bot-errors.log"
FAILURE_COUNT_FILE="/tmp/bot-failure-count"
MAX_FAILURES=3
CHECK_INTERVAL=5  # seconds between checks
EMAIL_TO=""
DISCORD_WEBHOOK=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --email)
      EMAIL_TO="$2"
      shift 2
      ;;
    --discord-webhook)
      DISCORD_WEBHOOK="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Initialize
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$ERROR_LOG")"

log_message() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Function to send email notification
send_email_notification() {
  local subject="🚨 Tera Bot Critical Failure - 3 Crashes Detected"
  local error_log_content=$(tail -100 "$ERROR_LOG" 2>/dev/null || echo "No error logs available")
  
  if [ -z "$EMAIL_TO" ]; then
    return
  fi

  # Check if mail command is available
  if ! command -v mail &> /dev/null; then
    log_message "WARN" "mail command not found, skipping email notification"
    return
  fi

  local email_body="TERA BOT CRITICAL FAILURE ALERT

The Tera Bot has crashed 3 times consecutively and has been stopped.

FAILURE COUNT: 3/$MAX_FAILURES
TIMESTAMP: $(date)
BOT DIRECTORY: $BOT_DIR
LOG FILE: $LOG_FILE

=== RECENT ERROR LOGS ===
$error_log_content

=== RESTART LOG ===
$(tail -50 "$LOG_FILE")

Please investigate the issue and restart the bot manually or check the logs above.
"

  echo "$email_body" | mail -s "$subject" "$EMAIL_TO" 2>/dev/null || \
    log_message "ERROR" "Failed to send email to $EMAIL_TO"
  
  log_message "INFO" "Email notification sent to $EMAIL_TO"
}

# Function to send Discord notification
send_discord_notification() {
  if [ -z "$DISCORD_WEBHOOK" ]; then
    return
  fi

  local error_log_content=$(tail -50 "$ERROR_LOG" 2>/dev/null || echo "No error logs available")
  # Escape backticks and format for Discord
  error_log_content=$(echo "$error_log_content" | sed 's/`/\\`/g')

  local discord_payload=$(cat <<EOF
{
  "content": "🚨 **TERA BOT CRITICAL FAILURE**",
  "embeds": [
    {
      "color": 16711680,
      "title": "Bot Crashed 3 Times - Auto-Restart Disabled",
      "fields": [
        {
          "name": "Failure Count",
          "value": "3/$MAX_FAILURES",
          "inline": true
        },
        {
          "name": "Timestamp",
          "value": "$(date)",
          "inline": true
        },
        {
          "name": "Recent Errors",
          "value": "\`\`\`\n$(echo "$error_log_content" | head -30)\n\`\`\`"
        }
      ],
      "footer": {
        "text": "Bot: Tera Bot | Alert: Auto-Restart"
      }
    }
  ]
}
EOF
)

  curl -X POST "$DISCORD_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$discord_payload" \
    2>/dev/null || log_message "ERROR" "Failed to send Discord notification"
  
  log_message "INFO" "Discord notification sent"
}

# Function to get current failure count
get_failure_count() {
  if [ -f "$FAILURE_COUNT_FILE" ]; then
    cat "$FAILURE_COUNT_FILE"
  else
    echo "0"
  fi
}

# Function to increment failure count
increment_failure_count() {
  local current=$(get_failure_count)
  local new=$((current + 1))
  echo "$new" > "$FAILURE_COUNT_FILE"
  echo "$new"
}

# Function to reset failure count
reset_failure_count() {
  echo "0" > "$FAILURE_COUNT_FILE"
}

# Function to check if bot is running
is_bot_running() {
  if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Function to start the bot
start_bot() {
  log_message "INFO" "Starting bot..."
  cd "$BOT_DIR" || exit 1
  
  # Kill any existing processes on port 5000
  lsof -ti:5000 | xargs kill -9 2>/dev/null || true
  sleep 1
  
  # Start bot in background
  npm start > /tmp/bot-latest.log 2>&1 &
  local bot_pid=$!
  
  log_message "INFO" "Bot started with PID: $bot_pid"
  
  # Wait a bit for bot to potentially crash immediately
  sleep 3
  
  if is_bot_running; then
    log_message "INFO" "✅ Bot is running on port 5000"
    reset_failure_count
    return 0
  else
    log_message "ERROR" "❌ Bot failed to start. Checking logs..."
    tail -50 /tmp/bot-latest.log >> "$ERROR_LOG"
    return 1
  fi
}

# Function to handle bot restart
handle_bot_crash() {
  local failure_count=$(increment_failure_count)
  local timestamp=$(date)
  
  log_message "ERROR" "Bot crashed! Failure count: $failure_count/$MAX_FAILURES"
  
  # Log the crash
  tail -100 /tmp/bot-latest.log >> "$ERROR_LOG" 2>/dev/null || true
  
  if [ "$failure_count" -ge "$MAX_FAILURES" ]; then
    log_message "ERROR" "❌ Bot has failed $MAX_FAILURES times. Stopping auto-restart."
    send_email_notification
    send_discord_notification
    
    echo ""
    echo "======================================================================"
    echo -e "${RED}CRITICAL: BOT AUTO-RESTART DISABLED${NC}"
    echo "======================================================================"
    echo "The bot has crashed $MAX_FAILURES consecutive times."
    echo "Notifications have been sent (if configured)."
    echo ""
    echo "Log files:"
    echo "  - Restart log: $LOG_FILE"
    echo "  - Error log: $ERROR_LOG"
    echo "  - Latest bot log: /tmp/bot-latest.log"
    echo ""
    echo "To investigate:"
    echo "  tail -100 $ERROR_LOG"
    echo "  tail -100 /tmp/bot-latest.log"
    echo "======================================================================"
    
    exit 1
  else
    log_message "WARN" "Attempting restart... ($failure_count/$MAX_FAILURES)"
    sleep 5
    start_bot
  fi
}

# Main monitoring loop
main() {
  echo ""
  echo "======================================================================"
  echo -e "${BLUE}🤖 TERA BOT AUTO-RESTART MONITOR${NC}"
  echo "======================================================================"
  echo "Bot Directory: $BOT_DIR"
  echo "Max Failures: $MAX_FAILURES"
  echo "Check Interval: ${CHECK_INTERVAL}s"
  echo "Log File: $LOG_FILE"
  echo "Error Log: $ERROR_LOG"
  if [ -n "$EMAIL_TO" ]; then
    echo "Email Notifications: $EMAIL_TO"
  fi
  if [ -n "$DISCORD_WEBHOOK" ]; then
    echo "Discord Webhook: [Configured]"
  fi
  echo "======================================================================"
  echo ""
  
  log_message "INFO" "🚀 Bot auto-restart monitor started"
  
  # Start the bot initially
  start_bot || handle_bot_crash
  
  # Monitoring loop
  while true; do
    sleep "$CHECK_INTERVAL"
    
    if ! is_bot_running; then
      handle_bot_crash
    fi
  done
}

# Trap signals for graceful shutdown
trap 'log_message "INFO" "Monitor stopped by user"; exit 0' SIGINT SIGTERM

# Run main
main
