# 🤖 Project TeraBot 2.0

### Created by Josh — Terabyte Gaming Network (TGN)

TeraBot 2.0 is a custom-built **Discord bot** designed for the **Terabyte Gaming Network**, a large-scale multi-server Minecraft network.

---

## 🚀 Quick Setup (2 minutes!)

**One command installs everything:**

```bash
# Ubuntu/Debian - Run this ONE command:
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/Discord-TeraBot-2.0/main/quick-setup.sh | bash

# Then edit .env and run:
npm run dev
```

**Manual setup:**
```bash
# 1. Install Node.js & PostgreSQL
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib
sudo systemctl start postgresql

# 2. Run setup
./setup.sh

# 3. Configure & start
nano .env  # Add your Discord bot token
npm run dev
```

---

## 🧩 Overview

**Terabyte Gaming Network (TGN)** runs on multiple backend Minecraft servers using **Paper** and **Folia**, connected through a **Velocity proxy**.  
TeraBot 2.0 acts as a bridge between Discord, TeamSpeak 3, and the Minecraft network — providing unified tools for community management, moderation, analytics, and automation.

---

## ⚙️ Core Features

### 🧠 General Features
- Welcome and leave messages (embedded with username, avatar, and member count)
- `/serverinfo` command displaying guild stats, creation date, and bot/server details
- Ticket system with cross-platform (Discord + TeamSpeak) visibility
- Giveaway system for digital rewards (gift cards, game keys, etc.)
- Stream notifications for Twitch, YouTube, Kick, or TikTok
- Custom embed creator directly within Discord
- (Removed) Full multiplayer party game feature

### 🎮 Game Integration
- Real-time Minecraft server status embeds (auto-refresh every 3–5 minutes)
- Cross-server **currency** and **leveling** systems (shared between multiple guilds)
- Toggle options for shared features per guild
- Integration with **TGN’s rank system** and webhooks

### 🧑‍💻 Moderation & Security
- **Jail command:** restricts user access to a single text channel
- **Keyword filter:** four strictness levels (non-strict, low, medium, high)
- **Minimum account age restriction:** set by guild admins
- **Role reaction/self-role assignment system**

### 📊 Analytics & Dashboard
- Web-based configuration dashboard for server admins and bot owner
- Customizable layout and color themes per guild
- Command usage tracking and activity analytics
- Grafana integration for advanced data visualization

---

<!-- Cards Against Humanity feature removed -->

---

## 📋 Dependencies & Requirements

### 🖥️ System Requirements
- **Operating System:** Linux (Debian/Ubuntu recommended), Windows 10/11, or macOS
- **RAM:** Minimum 512MB, Recommended 1GB+
- **Storage:** 500MB free space
- **Network:** Stable internet connection for Discord API

### 🛠️ Core Dependencies
- **Node.js:** v18.0.0 or higher (LTS recommended)
- **npm:** v8.0.0 or higher (included with Node.js)
- **PostgreSQL:** v12.0 or higher
- **Git:** For version control and deployment

### 📦 Node.js Packages (Auto-installed)
```bash
# Core Dependencies
- discord.js ^14.22.1          # Discord API wrapper
- drizzle-orm ^0.39.1          # Database ORM
- express ^4.21.2              # Web server framework
- pg ^8.13.1                   # PostgreSQL driver
- zod ^3.24.2                  # Schema validation

# Development Dependencies  
- typescript ^5.6.3            # TypeScript compiler
- drizzle-kit ^0.30.4          # Database migrations
- tsx ^4.19.1                  # TypeScript execution
- @types/node ^20.16.11        # Node.js type definitions
```

### 🗄️ Database Setup
Choose one of the following database options:

#### Option 1: Local PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install postgresql postgresql-contrib

# Windows (using winget)
winget install PostgreSQL.PostgreSQL.17

# macOS (using Homebrew)
brew install postgresql
```

#### Option 2: Cloud Database (Recommended)
- **Neon:** Free PostgreSQL hosting with generous limits
- **Supabase:** PostgreSQL with additional features
- **Railway:** Simple database deployment
- **Heroku Postgres:** Reliable cloud PostgreSQL

### 🔑 Environment Variables Required
Create a `.env` file with the following variables:
```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Database Configuration  
DATABASE_URL=postgresql://username:password@host:port/database

# Optional: Individual PostgreSQL credentials
PGHOST=localhost
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=discord_bot

# Environment
NODE_ENV=production
```

### 🚀 Quick Installation
```bash
# 1. Clone the repository
git clone https://github.com/DeadIntermediate/Discord-TeraBot-2.0.git
cd Discord-TeraBot-2.0

# 2. Run automated setup script
# Windows (PowerShell - Run as Administrator)
.\setup.ps1

# Linux/macOS (Bash)
chmod +x setup.sh && ./setup.sh

# 3. Configure your Discord bot token in .env
# 4. Bot is ready to run!
npm run dev
```

**🔧 Advanced Setup Options:**
- `setup.ps1 -RepairMode` (Windows) - Clean reinstall if issues occur
- `setup.sh --repair` (Linux/macOS) - Clean reinstall if issues occur  
- `setup.ps1 -CloudDatabase` (Windows) - Skip local PostgreSQL setup
- `setup.sh --cloud-database` (Linux/macOS) - Skip local PostgreSQL setup

For detailed setup instructions and troubleshooting, see `SETUP.md`

### ⚠️ Common Issues & Solutions

#### Node.js Installation Issues
```bash
# Check Node.js version
node --version

# If not installed or outdated:
# Visit https://nodejs.org and download LTS version
# Or use package managers like winget, brew, or apt
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U your_username -d discord_bot

# Common fixes:
# 1. Ensure PostgreSQL service is running
# 2. Check firewall settings
# 3. Verify DATABASE_URL format
# 4. Use cloud database if local setup fails
```

#### Permission Issues (Linux/macOS)
```bash
# Fix npm permission issues
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

---

## 🧩 Planned Integrations

### 🗣️ TeamSpeak 3 (TS3-TeraBot)
- Shared ticket system (Discord ↔ TS3)
- Leveling system (text + voice activity)
- Join/leave tracking across both platforms
- Role/permission management through text commands

---

## 💾 System Infrastructure

- **Development Host:** Raspberry Pi  
- **Production Host:** VPS (Debian-based)
- **Database:** PostgreSQL with Drizzle ORM
- **Game Engine:** Custom multiplayer logic (game-specific engines are optional)
- **Process Management:** tmux + systemd
- **Auto-Restart Script:** retries 3 times, sends alert if persistent failure
- **Version Control:** GitHub (`Discord-TeraBot-2.0`)
- **Deployment (Future):** Docker containers with guild sharding for scalability

---

## 🧠 Copilot Guidance

When generating or suggesting code, Copilot should:
1. Use **Discord.js (latest stable)** and **Node.js (LTS)** standards.
2. Favor **modular structure** (`commands/`, `events/`, `features/`, etc.).
3. Utilize **async/await** for asynchronous operations.
4. Prioritize **error handling** and **code maintainability**.
5. Optimize for **performance** and **cross-server compatibility**.
6. Ensure compatibility with **Linux-based** environments (Debian).
7. Use **TypeScript** for type safety and better development experience.
8. Follow **Drizzle ORM** patterns for database operations.
9. Implement proper **Discord.js v14** slash command structure.

---

## 🧰 Related Systems

| Project | Description |
|----------|-------------|
| **Project TeraRanks** | Global + per-server rank system for TGN |
| **Project Skyblock** | Cooperative Skyblock world powered by BentoBox |
| **Project PluginRepo** | Centralized plugin repository with symlinks |
| **Project FiLine Wall** | Raspberry Pi–based call filter system |
| **Project Linktree Clone** | Creator-friendly, analytics-rich link hub |

---

## 🪄 Vision

TeraBot 2.0 is built to unify the **Discord**, **TeamSpeak**, and **Minecraft** communities under a single intelligent system.  
Its goal is to make managing servers easier, more interactive, and more data-driven — while maintaining Josh’s signature “no pay-to-win, pure fun” philosophy across all of TGN.

---

## 🗂️ Migrations

If you removed the Cards Against Humanity (CAH) feature and need to remove related database objects, there's a migration script included that can either move CAH tables to a backup schema or drop them entirely.

- File: `migrations/20251018_remove_cah_with_log.sql`
- Usage (psql):
	- Safe (rename/move to backup schema):
		- Set the target schema and action inside your psql session:
			- `SELECT set_config('app.cah_target_schema','<SCHEMA_NAME>', false);`
			- `SELECT set_config('app.cah_migration_action','rename', false);`
		- Run the migration file:
			- `\i migrations/20251018_remove_cah_with_log.sql`

	- Destructive (DROP tables) — make a backup first and use with caution:
		- `SELECT set_config('app.cah_target_schema','<SCHEMA_NAME>', false);`
		- `SELECT set_config('app.cah_migration_action','drop', false);`
		- `\i migrations/20251018_remove_cah_with_log.sql`

The migration writes detailed action logs to `public.schema_migration_log` (created automatically) so you can audit what changed. Back up your database before running any destructive operation.


**Author:** Josh (DeadIntermediate / RealDeadIntermed)  
**Network:** [Terabyte Gaming Network](https://terabytegaming.net) *(Placeholder link)*  
**Language:** Node.js (Discord.js)  
**Version:** `2.1.0-dev`

---

## 🔁 Dev vs Production — Quick Guide

This project requires a valid `RAWG_API_KEY` for live `/game` lookups. There is no mock fallback in this repository; provide the key in your environment for production use.

Key environment flags:

- `RAWG_API_KEY` — required for live `/game` lookups. If missing the server will log an error and the game APIs will throw to avoid silent failures.
- `SKIP_DB=true` — start the server without connecting to the database (dev convenience).
- `SKIP_DISCORD=true` — start the server without connecting to Discord (dev convenience).

How to run locally (connect to Discord and DB as needed):

```bash
# load local .env (if present)
set -o allexport
[ -f .env ] && source .env || true
set +o allexport

npm run dev
```

Notes:
- Ensure `RAWG_API_KEY` is set when you want `/game` to return live data.
- Use `SKIP_DB=true` and/or `SKIP_DISCORD=true` for local testing when you don't want to connect to those services.

Testing `/game` command:
- Live: set `RAWG_API_KEY` and restart. `/game` will use RAWG to return data and screenshots.

If you want, I can add a dedicated `DEV_MODE` on a separate dev/test branch and a test-bot that registers commands only to a specified test guild to avoid polluting global application commands.
