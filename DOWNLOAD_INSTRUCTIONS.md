# Download Instructions for Raspberry Pi Deployment

## Download the Bot Package

Your Discord bot has been packaged and is ready for download!

### File: `discord-bot.tar.gz`

This archive contains:
- ✅ All source code (Python bot + Node.js web dashboard)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Deployment guide (DEPLOYMENT.md)
- ✅ Python dependencies list (python_requirements.txt)
- ✅ Environment template (.env.example)
- ✅ Startup script (start_bot.sh)
- ✅ Systemd service template (systemd_service_template.txt)

**Excluded** (you'll install these on your Pi):
- node_modules (Node.js dependencies)
- venv (Python virtual environment)
- Cache and temporary files

## How to Download

### Method 1: Using Replit Shell (Recommended)

1. Open the Shell tab in Replit
2. Type this command to download:
   ```bash
   download discord-bot.tar.gz
   ```
3. Your browser will download the file

### Method 2: Manual Download

1. Find `discord-bot.tar.gz` in the file tree on the left
2. Right-click on the file
3. Select "Download"

## File Size

The compressed package is approximately **~500KB** (without node_modules and dependencies).

After installing all dependencies on your Raspberry Pi, the full installation will be around **200-300 MB**.

## Next Steps

Once you've downloaded the file:

1. Transfer `discord-bot.tar.gz` to your Raspberry Pi using:
   - USB drive
   - SCP/SFTP: `scp discord-bot.tar.gz pi@your-pi-ip:~/`
   - Network share

2. On your Raspberry Pi, extract the archive:
   ```bash
   tar -xzf discord-bot.tar.gz -C ~/discord-bot
   cd ~/discord-bot
   ```

3. Follow the complete setup guide in **DEPLOYMENT.md**

## What's Included

### Core Bot Files
- `python_bot/` - Discord bot Python code with 10 cogs
- `server/` - Express.js backend with bot controller
- `client/` - React web dashboard
- `shared/` - Shared schema and types

### Configuration Files
- `package.json` - Node.js dependencies
- `python_requirements.txt` - Python dependencies
- `.env.example` - Environment variable template
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database configuration
- `vite.config.ts` - Frontend build configuration

### Deployment Files
- `DEPLOYMENT.md` - Complete Raspberry Pi setup guide
- `install_prerequisites.sh` - **NEW!** Automated installer for Node.js, Python, PostgreSQL
- `start_bot.sh` - Automated startup script
- `systemd_service_template.txt` - System service configuration

### Database Schema
- `shared/schema.ts` - Complete database schema with all tables
- Supports PostgreSQL (local or Neon cloud)

## Quick Start After Extraction

### Step 1: Install Prerequisites (One-Time Setup)
```bash
cd ~/discord-bot
chmod +x install_prerequisites.sh
./install_prerequisites.sh
```

This automated installer will:
1. Update your system
2. Install Node.js 20.x
3. Install Python 3 and pip
4. Optionally install PostgreSQL locally
5. Set up database with your credentials
6. Optimize swap space for Raspberry Pi

### Step 2: Configure and Start Bot
```bash
# Copy environment template
cp .env.example .env
nano .env  # Add your Discord token and database URL

# Run the bot startup script
chmod +x start_bot.sh
./start_bot.sh
```

The startup script will:
1. Check for .env configuration
2. Install Node.js dependencies
3. Set up Python virtual environment
4. Install Python dependencies
5. Start the bot and web dashboard

## Important Notes

⚠️ **Before running on your Pi:**
1. You MUST configure `.env` with your Discord bot token
2. You MUST have a PostgreSQL database (local or Neon cloud)
3. Node.js 20+ and Python 3.8+ must be installed

📖 **Read DEPLOYMENT.md** for complete step-by-step instructions!

## Support

If you encounter issues:
1. Check `DEPLOYMENT.md` for troubleshooting section
2. Verify all prerequisites are installed
3. Check system logs: `sudo journalctl -u discord-bot -f`

## Bot Features Summary

- 35 slash commands across 10 cogs
- Triple-track leveling system (text/voice/global)
- Moderation tools with logging
- Support ticket system with buttons
- Stream notifications (Twitch/YouTube/Kick)
- Anti-invite system
- Interactive embed builder
- Web dashboard for bot control
- Welcome system with staff logging
- Giveaway management
- Role reactions

Enjoy your Discord bot on Raspberry Pi! 🎉
