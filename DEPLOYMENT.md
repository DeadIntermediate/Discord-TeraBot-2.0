# Discord Bot Deployment Guide for Raspberry Pi 5

This guide will help you deploy your comprehensive Discord bot on a Raspberry Pi 5.

## Prerequisites

- Raspberry Pi 5 with Raspberry Pi OS (64-bit recommended)
- Internet connection
- Discord Bot Token
- PostgreSQL database (can use Neon cloud database or local PostgreSQL)

## Quick Install (Automated)

We've included an automated installer that sets up all prerequisites for you!

### Step 1: Extract the Project

```bash
mkdir ~/discord-bot
tar -xzf discord-bot.tar.gz -C ~/discord-bot
cd ~/discord-bot
```

### Step 2: Run Automated Installer

```bash
chmod +x install_prerequisites.sh
./install_prerequisites.sh
```

The script will automatically:
- ✅ Update your system
- ✅ Install Node.js 20.x
- ✅ Install Python 3 and pip
- ✅ Optionally install PostgreSQL locally
- ✅ Set up database with credentials you provide
- ✅ Optimize swap space for Raspberry Pi
- ✅ Install build tools

**Then skip to Step 6 below!**

---

## Manual Installation (Alternative)

If you prefer to install manually, follow these steps:

### Step 1: Prepare Your Raspberry Pi

Update your system:
```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Node.js

Install Node.js 20.x (required for the web dashboard):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

### Step 3: Install Python 3 and Dependencies

Install Python 3 and pip:
```bash
sudo apt install -y python3 python3-pip python3-venv
```

### Step 4: Install PostgreSQL (Optional - if not using Neon)

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

### Step 5: Extract and Setup Project

Extract the downloaded zip file:
```bash
unzip discord-bot.zip
cd discord-bot
```

## Step 6: Install Node.js Dependencies

```bash
npm install
```

## Step 7: Install Python Dependencies

Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate
```

Install Python packages:
```bash
pip install -r python_requirements.txt
```

## Step 8: Configure Environment Variables

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

# Individual PostgreSQL credentials (auto-set if using Neon, or set manually)
PGHOST=localhost
PGPORT=5432
PGUSER=botuser
PGPASSWORD=your_password
PGDATABASE=discord_bot

# Node Environment
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 9: Setup Database Schema

Run database migrations:
```bash
npm run db:push
```

## Step 10: Test the Bot

Start the application:
```bash
npm run dev
```

The web dashboard will be available at: `http://your-pi-ip:5000`

You should see:
- Express server starting
- Python bot connecting to Discord
- All 10 cogs loading
- 35 commands syncing

Press Ctrl+C to stop when testing is complete.

## Step 11: Setup as a System Service (Production)

For production deployment, create a systemd service to auto-start the bot:

```bash
sudo nano /etc/systemd/system/discord-bot.service
```

Add this configuration:
```ini
[Unit]
Description=Discord Bot with Web Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/discord-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable discord-bot
sudo systemctl start discord-bot
```

Check service status:
```bash
sudo systemctl status discord-bot
```

View logs:
```bash
sudo journalctl -u discord-bot -f
```

## Step 12: Access Web Dashboard

Open a browser and navigate to:
```
http://your-raspberry-pi-ip:5000/dashboard
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
cd /path/to/discord-bot
source venv/bin/activate  # if using virtual environment
npm run dev
```

Stop the service:
```bash
sudo systemctl stop discord-bot
```

Restart the service:
```bash
sudo systemctl restart discord-bot
```

View real-time logs:
```bash
sudo journalctl -u discord-bot -f
```

Update bot:
```bash
sudo systemctl stop discord-bot
cd /path/to/discord-bot
# Upload new files or git pull
npm install
pip install -r python_requirements.txt
npm run db:push
sudo systemctl start discord-bot
```

## Troubleshooting

### Bot won't start
- Check logs: `sudo journalctl -u discord-bot -f`
- Verify Discord token is correct in `.env`
- Ensure database is accessible
- Check Python dependencies are installed

### Database connection errors
- Verify DATABASE_URL in `.env` is correct
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql $DATABASE_URL`

### Web dashboard not accessible
- Check if port 5000 is open: `sudo netstat -tulpn | grep 5000`
- Verify firewall settings: `sudo ufw status`
- Check Express server logs

### Python bot crashes
- Activate virtual environment: `source venv/bin/activate`
- Check Python version: `python3 --version` (should be 3.8+)
- Reinstall dependencies: `pip install -r python_requirements.txt`

## Bot Features

Your bot includes:
- **Moderation**: kick, ban, mute, unmute, warn, warnings, clearwarnings, clear
- **Utility**: ping, serverinfo, help, memberinfo
- **Leveling**: 3-track system (text/voice/global) with leaderboards
- **Tickets**: create, assign, close with button interface
- **Giveaways**: create, end, list, reroll
- **Welcome System**: public messages + staff logging
- **Stream Notifications**: Twitch, YouTube, Kick support
- **Role Reactions**: self-assignable roles
- **Anti-Invite**: automatic Discord invite removal
- **Embed Builder**: interactive modal + JSON support with save/reuse
- **Web Dashboard**: bot control panel with analytics

Total: **35 slash commands** across **10 cogs**

## Performance Tips for Raspberry Pi

1. **Use SSD for storage**: Boot from SSD instead of SD card for better performance
2. **Enable swap**: Increase swap space if running multiple services
3. **Monitor temperature**: Ensure proper cooling
4. **Optimize PostgreSQL**: Adjust shared_buffers and work_mem for Pi's RAM
5. **Use lightweight desktop**: Run headless or with minimal GUI

## Support

For issues:
1. Check logs first: `sudo journalctl -u discord-bot -f`
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check Discord bot permissions in Discord Developer Portal

## License

This bot is for personal use. Ensure compliance with Discord's Terms of Service and Developer Policy.
