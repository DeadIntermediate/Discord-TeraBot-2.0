# TeraBot Startup Scripts Quick Reference

## Available Scripts

### 🚀 start_bot.sh - Main startup script
**Basic usage:**
```bash
./start_bot.sh              # Start in foreground (development)
./start_bot.sh --tmux       # Start in tmux session (recommended)
./start_bot.sh --production # Start in production mode
./start_bot.sh --background # Start in background with PM2/nohup
```

**Options:**
- `-t, --tmux` - Run in tmux session (keeps running after terminal closes)
- `-p, --production` - Run in production mode (optimized)
- `-b, --background` - Run in background (PM2 or nohup)
- `--skip-db-check` - Skip database connectivity check
- `-h, --help` - Show help message

**Examples:**
```bash
# Development with tmux (recommended for daily use)
./start_bot.sh --tmux

# Production with tmux
./start_bot.sh --tmux --production

# Background with PM2
./start_bot.sh --background
```

---

### 🔄 restart.sh - Restart the bot
**Usage:**
```bash
./restart.sh
```

Automatically detects if bot is running in:
- tmux session (restarts in tmux)
- Regular process (stops and calls start_bot.sh)

---

### 🔧 auto-restart-bot.sh - Auto-restart on crash
**Usage:**
```bash
./auto-restart-bot.sh [--email your@email.com] [--discord-webhook URL]
```

Features:
- Monitors bot and restarts if it crashes
- Stops after 3 consecutive failures
- Sends email/Discord notifications
- Logs all restarts

---

### 📊 monitor-logs.sh - Live log monitoring
**Usage:**
```bash
./monitor-logs.sh
```

Shows color-coded live logs from the bot.

---

### 🎬 start-with-monitor.sh - Start with log monitoring
**Usage:**
```bash
./start-with-monitor.sh
```

Starts bot and automatically shows live logs.

---

## Tmux Commands

### Basic tmux usage:
```bash
# Start bot in tmux
./start_bot.sh --tmux

# Attach to running session
tmux attach -t terabot

# Detach from session (bot keeps running)
Press: Ctrl+B, then D

# List all sessions
tmux ls

# Kill session
tmux kill-session -t terabot
```

### Inside tmux:
- **Scroll up/down:** `Ctrl+B` then `[`, then use arrow keys or Page Up/Down (press `q` to exit scroll mode)
- **Detach:** `Ctrl+B` then `D`
- **New window:** `Ctrl+B` then `C`
- **Switch windows:** `Ctrl+B` then `0-9`

---

## Recommended Workflows

### For Development:
```bash
# Start in tmux (can close terminal, bot stays running)
./start_bot.sh --tmux

# View logs
tmux attach -t terabot

# Restart after code changes
./restart.sh
```

### For Production:
```bash
# Start in production mode with tmux
./start_bot.sh --tmux --production

# Or use PM2 for process management
./start_bot.sh --production --background
```

### Quick Restart:
```bash
# Works whether bot is in tmux or not
./restart.sh
```

---

## Stopping the Bot

### If running in tmux:
```bash
tmux attach -t terabot
# Then press Ctrl+C
# Or from outside: tmux kill-session -t terabot
```

### If running in background:
```bash
# With PM2
pm2 stop terabot

# With nohup
pkill -f "tsx server/index.ts"
```

### If running in foreground:
```bash
# Just press Ctrl+C
```
