#!/bin/bash

# Quick Start: Run this to start Tera Bot with Auto-Restart & Notifications

# ============================================================================
# CONFIGURATION - Edit these before running
# ============================================================================

# Your email for crash notifications (leave empty to disable)
EMAIL_NOTIFICATIONS="your@email.com"

# Discord webhook URL for crash notifications (leave empty to disable)
# Get this from: Discord Server > Channel > Edit > Integrations > Webhooks
DISCORD_WEBHOOK=""

# ============================================================================
# AUTO-START SCRIPT
# ============================================================================

cd "$(dirname "$0")" || exit 1

echo "🤖 Starting Tera Bot with Auto-Restart Monitor..."
echo ""

# Build the command
CMD="./auto-restart-bot.sh"

if [ -n "$EMAIL_NOTIFICATIONS" ]; then
  CMD="$CMD --email $EMAIL_NOTIFICATIONS"
  echo "📧 Email notifications: $EMAIL_NOTIFICATIONS"
fi

if [ -n "$DISCORD_WEBHOOK" ]; then
  CMD="$CMD --discord-webhook $DISCORD_WEBHOOK"
  echo "🔔 Discord notifications: [Configured]"
fi

echo ""
echo "Starting: $CMD"
echo "Logs: /tmp/bot-restart.log"
echo "Errors: /tmp/bot-errors.log"
echo ""
echo "Press Ctrl+C to stop"
echo "=================================================="
echo ""

# Run the auto-restart script
exec $CMD
