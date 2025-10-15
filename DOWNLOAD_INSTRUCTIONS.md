# Download Instructions for Server Deployment

## Download the Bot Package

Your Discord bot has been packaged and is ready for download!

### File: `discord-bot.tar.gz`

This archive contains:
- ✅ All source code (Node.js Discord bot + Web dashboard)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Deployment guide (DEPLOYMENT.md)
- ✅ Node.js dependencies list (package.json)
- ✅ Environment template (.env.example)
- ✅ Startup script (start_bot.sh)
- ✅ Systemd service template (systemd_service_template.txt)

**Excluded** (you'll install these on your server):
- node_modules (Node.js dependencies)
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

The compressed package is approximately **~500KB** (without node_modules).

After installing all dependencies on your server, the full installation will be around **200-300 MB**.

## Next Steps

Once you've downloaded the file:

1. Transfer `discord-bot.tar.gz` to your server using:
   - USB drive
   - SCP/SFTP: `scp discord-bot.tar.gz user@your-server-ip:~/`
   - Network share

2. On your server, extract the archive:
   ```bash
   tar -xzf discord-bot.tar.gz -C ~/Discord-TeraBot-2.0
   cd ~/Discord-TeraBot-2.0
   ```

3. Follow the complete setup guide in **DEPLOYMENT.md**

## What's Included

### Core Bot Files
- `server/bot/` - Discord bot Node.js code with command modules
- `server/` - Express.js backend with bot controller
- `client/` - React web dashboard
- `shared/` - Shared schema and types

### Configuration Files
- `package.json` - Node.js dependencies
- `.env.example` - Environment variable template
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database configuration
- `vite.config.ts` - Frontend build configuration

### Deployment Files
- `DEPLOYMENT.md` - Complete server setup guide
- `install_prerequisites.sh` - Automated installer for Node.js and PostgreSQL
- `start_bot.sh` - Automated startup script
- `systemd_service_template.txt` - System service configuration

### Database Schema
- `shared/schema.ts` - Complete database schema with all tables
- Supports PostgreSQL (local or Neon cloud)

## Quick Start After Extraction

### Step 1: Install Prerequisites (One-Time Setup)
```bash
cd ~/Discord-TeraBot-2.0
chmod +x install_prerequisites.sh
./install_prerequisites.sh
```

This automated installer will:
1. Update your system
2. Install Node.js 20.x (LTS)
3. Optionally install PostgreSQL locally
4. Set up database with your credentials
5. Optimize system settings

### Step 2: Configure and Start Bot
```bash
# Copy environment template
cp .env.example .env
nano .env  # Add your Discord token and database URL

# Install Node.js dependencies
npm install

# Run database migrations
npm run db:push

# Run the bot startup script
chmod +x start_bot.sh
./start_bot.sh
```

The startup script will:
1. Check for .env configuration
2. Verify Node.js dependencies are installed
3. Load environment variables
4. Start the bot and web dashboard

## Important Notes

⚠️ **Before running on your server:**
1. You MUST configure `.env` with your Discord bot token
2. You MUST have a PostgreSQL database (local or Neon cloud)
3. Node.js 20+ must be installed

📖 **Read DEPLOYMENT.md** for complete step-by-step instructions!

## Support

If you encounter issues:
1. Check `DEPLOYMENT.md` for troubleshooting section
2. Verify all prerequisites are installed
3. Check system logs: `sudo journalctl -u terabot -f`

## Bot Features Summary

Built with **Discord.js v14** and **Node.js**, featuring:
- Moderation tools (kick, ban, timeout, jail, warn, modhistory)
- Utility commands (ping, serverinfo, help, memberinfo)
- Support ticket system with interactive buttons
- Giveaway system with requirement checking
- Welcome/leave messages with custom embeds
- Role reaction system for self-assignable roles
- Interactive embed builder with templates
- Web dashboard for bot control and analytics
- Giveaway management
- Role reactions

Enjoy your Discord bot on Raspberry Pi! 🎉
