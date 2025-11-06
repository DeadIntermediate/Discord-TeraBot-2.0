# 🤖 TERA BOT AUTO-RESTART - QUICK REFERENCE CARD

## 🚀 Quick Start (Copy & Paste)

### Development (Simplest)
```bash
cd /home/deadintermediate/Desktop/Terabot/Discord-TeraBot-2.0
./start-with-monitor.sh
```

### Production (Systemd)
```bash
sudo cp /home/deadintermediate/Desktop/Terabot/Discord-TeraBot-2.0/tera-bot.service /etc/systemd/system/
sudo systemctl enable tera-bot
sudo systemctl start tera-bot
```

### With Email Alerts
```bash
./auto-restart-bot.sh --email your@email.com
```

### With Discord Alerts
```bash
./auto-restart-bot.sh --discord-webhook "https://discordapp.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
```

---

## 📋 Common Commands

| Task | Command |
|------|---------|
| **View status** | `./monitor-logs.sh status` |
| **Follow logs** | `tail -f /tmp/bot-restart.log` |
| **See errors** | `./monitor-logs.sh errors` |
| **Stop bot** | `Ctrl+C` or `sudo systemctl stop tera-bot` |
| **Restart bot** | `sudo systemctl restart tera-bot` |
| **Check failure count** | `cat /tmp/bot-failure-count` |
| **Reset failures** | `echo "0" > /tmp/bot-failure-count` |
| **View service logs** | `sudo journalctl -u tera-bot -f` |
| **Kill stuck bot** | `lsof -ti:5000 \| xargs kill -9` |

---

## 📂 Files Created

```
auto-restart-bot.sh (7.4K)
  └─ Main monitoring script

start-with-monitor.sh (1.4K)
  └─ Quick start wrapper (edit for config)

monitor-logs.sh (1.2K)
  └─ Log viewer utility

tera-bot.service (850B)
  └─ Systemd service file

AUTO_RESTART_SETUP.md (6.4K)
  └─ Setup & usage guide

AUTO_RESTART_README.md (5.6K)
  └─ Technical documentation

IMPLEMENTATION_GUIDE.md (9.9K)
  └─ Complete implementation guide
```

---

## 📊 How It Works

```
Crash #1 → Auto-restart (Failure: 1/3)
Crash #2 → Auto-restart (Failure: 2/3)
Crash #3 → STOP + Send Notifications (Failure: 3/3)
           ├─ Email sent ✉️
           └─ Discord alert 🔔
```

---

## 🔔 Setting Up Notifications

### Discord (Easiest)
```bash
# 1. Create webhook in Discord server
# 2. Copy webhook URL
# 3. Run:
./auto-restart-bot.sh --discord-webhook "YOUR_URL"
```

### Email
```bash
# 1. Install: sudo apt-get install sendmail
# 2. Test: echo "Test" | mail -s "Test" your@email.com
# 3. Run:
./auto-restart-bot.sh --email your@email.com
```

---

## 📋 Log Files

| File | Contains |
|------|----------|
| `/tmp/bot-restart.log` | All restart events |
| `/tmp/bot-errors.log` | Error messages |
| `/tmp/bot-latest.log` | Current bot output |
| `/tmp/bot-failure-count` | Failure counter (0-3) |

---

## 🔧 Troubleshooting

### Bot won't start
```bash
lsof -ti:5000 | xargs kill -9
tail -50 /tmp/bot-latest.log
```

### Script won't run
```bash
chmod +x auto-restart-bot.sh
bash auto-restart-bot.sh
```

### Notifications not working
```bash
# Test Discord
curl -X POST "YOUR_WEBHOOK" -H "Content-Type: application/json" -d '{"content":"Test"}'

# Test email
echo "Test" | mail -s "Test" your@email.com
```

---

## ⚡ Pro Tips

1. **Monitor in background** - Use tmux:
   ```bash
   tmux new-session -d -s tera-bot ./start-with-monitor.sh
   ```

2. **24/7 uptime** - Use systemd
3. **Check logs regularly** - Catch issues early
4. **Set up automated alerts** - Use cron jobs

---

**Version**: 1.0 | **Status**: ✅ Ready to Use | **Created**: 2025-11-06
