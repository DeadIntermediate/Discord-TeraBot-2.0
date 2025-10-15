# TeraBot 2.0 Deployment Guide

This guide will help you deploy TeraBot 2.0 (Node.js Discord bot) on your server or Raspberry Pi.

## Prerequisites

- Server or Raspberry Pi with Linux (Debian-based recommended)
- Internet connection
- Discord Bot Token
- PostgreSQL database (Neon cloud database or local PostgreSQL)

## Quick Install (Automated)

We've included an automated installer that sets up all prerequisites for you!

### Step 1: Clone or Extract the Project

```bash
git clone https://github.com/DeadIntermediate/Discord-TeraBot-2.0.git
cd Discord-TeraBot-2.0
```

### Step 2: Run Automated Installer

```bash
chmod +x install_prerequisites.sh
./install_prerequisites.sh
```

The script will automatically:
- ✅ Update your system
- ✅ Install Node.js 20.x (LTS)
- ✅ Optionally install PostgreSQL locally
- ✅ Set up database with credentials you provide
- ✅ Optimize system settings
- ✅ Install build tools

**Then skip to Step 5 below!**

---

## Manual Installation (Alternative)

If you prefer to install manually, follow these steps:

### Step 1: Prepare Your System

Update your system:
```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Node.js

Install Node.js 20.x (LTS):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

### Step 3: Install PostgreSQL (Optional - if not using Neon)

If you want to run PostgreSQL locally instead of using Neon:
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Create a database:
```bash
sudo -u postgres psql
CREATE DATABASE discord_bot;
CREATE USER botuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE discord_bot TO botuser;
\q
```

### Step 4: Clone Project

Clone the repository:
```bash
git clone https://github.com/DeadIntermediate/Discord-TeraBot-2.0.git
cd Discord-TeraBot-2.0
```

### Step 5: Install Node Dependencies

Install Node.js packages:
```bash
npm install
```

### Step 6: Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```bash
nano .env
```

Required environment variables:
```env
# Discord Bot Token (get from https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# PostgreSQL Database URL
# Format: postgresql://username:password@host:port/database
DATABASE_URL=postgresql://botuser:your_password@localhost:5432/discord_bot

# Or use Neon cloud database:
# DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# Individual PostgreSQL credentials (optional, auto-parsed from DATABASE_URL)
PGHOST=localhost
PGPORT=5432
PGUSER=botuser
PGPASSWORD=your_password
PGDATABASE=discord_bot

# Node Environment
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter).

### Step 7: Setup Database Schema

Run database migrations:
```bash
npm run db:push
```

### Step 8: Test the Bot

Start the application:
```bash
npm run dev
```

The web dashboard will be available at: `http://your-server-ip:5000`

You should see:
- Express server starting
- Discord bot connecting
- All commands registering
- Bot status: Ready

Press Ctrl+C to stop when testing is complete.

### Step 9: Setup as a System Service (Production)

For production deployment, create a systemd service to auto-start the bot:

```bash
sudo nano /etc/systemd/system/terabot.service
```

Add this configuration:
```ini
[Unit]
Description=TeraBot 2.0 - Discord Bot
After=network.target postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/Discord-TeraBot-2.0
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable terabot
sudo systemctl start terabot
```

Check service status:
```bash
sudo systemctl status terabot
```

View logs:
```bash
sudo journalctl -u terabot -f
```

### Step 10: Access Web Dashboard

Open a browser and navigate to:
```
http://your-server-ip:5000/dashboard
```

From here you can:
- Start/Stop/Restart the bot
- View analytics
- Toggle features on/off
- Monitor bot status

## Port Forwarding (Optional)

If you want to access the dashboard from outside your local network:

1. Find your Pi's local IP: `hostname -I`
2. Login to your router's admin panel
3. Forward port 5000 to your Pi's local IP
4. Access via: `http://your-public-ip:5000/dashboard`

**Security Warning**: Always use strong passwords and consider setting up a firewall if exposing services to the internet.

## Useful Commands

Start bot manually:
```bash
cd /path/to/Discord-TeraBot-2.0
npm run dev
```

Stop the service:
```bash
sudo systemctl stop terabot
```

Restart the service:
```bash
sudo systemctl restart terabot
```

View real-time logs:
```bash
sudo journalctl -u terabot -f
```

Update bot:
```bash
sudo systemctl stop terabot
cd /path/to/Discord-TeraBot-2.0
# Upload new files or git pull
npm install
npm run db:push
sudo systemctl start terabot
```

## Troubleshooting

### Bot won't start
- Check logs: `sudo journalctl -u terabot -f`
- Verify Discord token is correct in `.env`
- Ensure database is accessible
- Check Node.js dependencies are installed

### Database connection errors
- Verify DATABASE_URL in `.env` is correct
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql $DATABASE_URL`

### Web dashboard not accessible
- Check if port 5000 is open: `sudo netstat -tulpn | grep 5000`
- Verify firewall settings: `sudo ufw status`
- Check Express server logs

### Node.js issues
- Check Node.js version: `node --version` (should be 20.x LTS)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for compilation errors: `npm run build`

## Bot Features

Your bot includes:
- **Moderation**: kick, ban, timeout, jail, unjail, warn, modhistory, clear
- **Utility**: ping, serverinfo, help, memberinfo
- **Tickets**: create, manage, close, assign, list with button/modal interface
- **Giveaways**: create, end, list, reroll with requirement checking
- **Welcome/Leave System**: customizable embed messages with placeholders
- **Role Reactions**: self-assignable roles with templates
- **Embed Builder**: interactive modal builder with save/reuse functionality
- **Web Dashboard**: bot control panel with analytics

Built with **Discord.js v14** and **PostgreSQL** for robust performance.

## Performance Tips

1. **Use SSD for storage**: Boot from SSD instead of SD card for better performance
2. **Enable swap**: Increase swap space if running multiple services
3. **Monitor temperature**: Ensure proper cooling for your hardware
4. **Optimize PostgreSQL**: Adjust shared_buffers and work_mem for available RAM
5. **Use lightweight desktop**: Run headless or with minimal GUI to save resources

## Support

For issues:
1. Check logs first: `sudo journalctl -u terabot -f`
2. Verify all environment variables are set correctly in `.env`
3. Ensure all dependencies are installed: `npm install`
4. Check Discord bot permissions in Discord Developer Portal
5. Review database schema: `npm run db:push`

---

**Legacy Python Code**: A previous Python version of this bot has been archived in `python_legacy/` for reference only. The current bot is built entirely with Node.js.

## License

This bot is for personal use. Ensure compliance with Discord's Terms of Service and Developer Policy.
