# Tera Bot Auto-Restart Script

This script automatically restarts the Tera Bot if it crashes, with intelligent failure tracking and notifications.

## Features

✅ **Auto-Restart** - Automatically restarts bot on crash  
✅ **Failure Tracking** - Stops after 3 consecutive failures  
✅ **Email Notifications** - Send crash logs via email  
✅ **Discord Notifications** - Send alerts to Discord webhook  
✅ **Detailed Logging** - Maintains restart and error logs  
✅ **Graceful Shutdown** - Clean handling of signals  

## Usage

### Basic Usage (No Notifications)
```bash
./auto-restart-bot.sh
```

### With Email Notifications
```bash
./auto-restart-bot.sh --email admin@example.com
```

### With Discord Notifications
```bash
./auto-restart-bot.sh --discord-webhook "https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
```

### With Both Email and Discord
```bash
./auto-restart-bot.sh \
  --email admin@example.com \
  --discord-webhook "https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
```

## Log Files

The script creates and manages the following logs:

- **`/tmp/bot-restart.log`** - Auto-restart monitoring log (all events)
- **`/tmp/bot-errors.log`** - Consolidated error logs from crashes
- **`/tmp/bot-latest.log`** - Latest bot output
- **`/tmp/bot-failure-count`** - Current failure count (0-3)

## Viewing Logs

### Recent Restart Events
```bash
tail -50 /tmp/bot-restart.log
```

### Error Logs
```bash
tail -100 /tmp/bot-errors.log
```

### Current Bot Output
```bash
tail -100 /tmp/bot-latest.log
```

### Follow Logs in Real-Time
```bash
tail -f /tmp/bot-restart.log
```

## How It Works

1. **Startup** - Script starts the bot and waits for it to be ready
2. **Monitoring** - Every 5 seconds, checks if bot is running on port 5000
3. **Crash Detection** - If bot crashes, increments failure counter
4. **Auto-Restart** - Attempts to restart (up to 3 times)
5. **Notification** - On 3rd failure, sends notifications and stops

### Failure Scenarios

| Attempt | Action |
|---------|--------|
| 1st Crash | Auto-restart immediately |
| 2nd Crash | Wait 5s, then restart |
| 3rd Crash | Stop, log error, send notifications |

## Setting Up for Production (systemd)

### Install as System Service

```bash
# Copy service file
sudo cp tera-bot.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable tera-bot

# Start the service
sudo systemctl start tera-bot

# Check status
sudo systemctl status tera-bot
```

### Monitor Service

```bash
# View service logs
sudo journalctl -u tera-bot -f

# Service status
sudo systemctl status tera-bot

# Stop service
sudo systemctl stop tera-bot

# Restart service
sudo systemctl restart tera-bot
```

## Setting Up Email Notifications

### Option 1: Using Sendmail
```bash
sudo apt-get install sendmail
./auto-restart-bot.sh --email your@email.com
```

### Option 2: Using msmtp (Lightweight)
```bash
sudo apt-get install msmtp
# Configure ~/.msmtprc with your email provider
chmod 600 ~/.msmtprc
./auto-restart-bot.sh --email your@email.com
```

### Option 3: Using ssmtp (Simple)
```bash
sudo apt-get install ssmtp
# Edit /etc/ssmtp/ssmtp.conf with your SMTP settings
./auto-restart-bot.sh --email your@email.com
```

## Setting Up Discord Notifications

1. **Create a Discord Webhook**:
   - Go to your Discord server
   - Right-click channel → Edit Channel → Integrations → Webhooks
   - Click "New Webhook" and copy the URL

2. **Use the Webhook**:
```bash
./auto-restart-bot.sh --discord-webhook "https://discordapp.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
```

## Troubleshooting

### Bot Won't Start
```bash
# Check if port 5000 is already in use
lsof -i :5000

# Kill existing process
lsof -ti:5000 | xargs kill -9

# Check latest bot logs
tail -100 /tmp/bot-latest.log
```

### Emails Not Sending
```bash
# Test email configuration
echo "Test" | mail -s "Test Subject" your@email.com

# Check mail logs
sudo tail -50 /var/log/mail.log
```

### Discord Notifications Not Working
```bash
# Test webhook (replace URL)
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test message"}'
```

### Check Failure Count
```bash
cat /tmp/bot-failure-count
# Output: 0 (running) or 1-3 (failures)
```

## Stopping the Script

```bash
# Gracefully stop monitoring
Ctrl+C

# Kill if stuck
killall auto-restart-bot.sh
```

## Example: Full Production Setup

```bash
# 1. Make script executable
chmod +x auto-restart-bot.sh

# 2. Install as systemd service
sudo cp tera-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tera-bot

# 3. Create Discord webhook and use it
# (Setup in Discord server as described above)

# 4. Start service
sudo systemctl start tera-bot

# 5. Monitor
sudo journalctl -u tera-bot -f
```

## Performance Impact

- **Memory**: ~10MB (very lightweight)
- **CPU**: <1% idle (only checks every 5 seconds)
- **Disk**: ~100KB logs (rotated manually)

## Advanced Configuration

Edit `auto-restart-bot.sh` to customize:

```bash
# Line 18 - Max failures before stopping
MAX_FAILURES=3

# Line 19 - Check interval in seconds
CHECK_INTERVAL=5

# Line 20 - Log file locations
LOG_FILE="/tmp/bot-restart.log"
ERROR_LOG="/tmp/bot-errors.log"
```

## Support

For issues or questions:
1. Check `/tmp/bot-restart.log` for recent events
2. Check `/tmp/bot-errors.log` for error details
3. Check `/tmp/bot-latest.log` for bot output
4. Review bot database and environment variables

---

**Created**: 2025-11-06  
**Bot Directory**: `/home/deadintermediate/Desktop/Terabot/Discord-TeraBot-2.0`  
**Maintenance**: Check logs regularly and update as needed
