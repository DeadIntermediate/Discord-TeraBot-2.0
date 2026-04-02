# 🚀 TeraBot 2.0 Quick Setup

**Super simple setup - just 3 steps!**

## ⚡ Quick Start

### 1. Install Prerequisites
```bash
# Ubuntu/Debian
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Run Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

### 3. Configure & Run
```bash
# Edit .env with your Discord bot token
nano .env

# Start the bot
npm run dev
```

## 🎯 What the Setup Does

- ✅ Checks Node.js & npm
- ✅ Verifies PostgreSQL connection
- ✅ Creates `.env` configuration file
- ✅ Installs npm dependencies
- ✅ Sets up database schema

## 🆘 Troubleshooting

**"Node.js not found"**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**"PostgreSQL not detected"**
```bash
sudo systemctl start postgresql
# OR use a cloud database like Neon, Supabase, etc.
```

**Memory issues during npm install**
```bash
NODE_OPTIONS="--max-old-space-size=8192" npm install
```

## 📁 Project Structure

```
terabot/
├── client/          # React dashboard
├── server/          # Discord bot backend
├── shared/          # TypeScript types
├── migrations/      # Database migrations
├── setup.sh         # Quick setup script
└── package.json     # Dependencies
```
- ✅ Install and start PostgreSQL service
- ✅ Create database and user (if using local PostgreSQL)
- ✅ Test database connectivity
- ✅ Support for cloud databases (Neon, Supabase, etc.)

### 3. **Environment Configuration**
- ✅ Create `.env` file from template
- ✅ Configure database connection strings
- ✅ Set up development environment variables

### 4. **Bot Dependencies**
- ✅ Install all Node.js packages from `package.json`
- ✅ Install TypeScript dependencies
- ✅ Install Discord.js and database drivers

### 5. **Database Migration**
- ✅ Run Drizzle ORM migrations
	- ✅ Create all required tables
- ✅ Verify database schema

### 6. **Verification & Testing**
- ✅ Test all critical file paths
- ✅ Verify Node.js and npm versions
- ✅ Check database connectivity
- ✅ Validate configuration files

## 🔧 Manual Setup (Alternative)

If the automated scripts don't work, follow these manual steps:

### Step 1: Install Dependencies

#### Windows
```powershell
# Install Node.js
winget install OpenJS.NodeJS

# Install PostgreSQL
winget install PostgreSQL.PostgreSQL.17

# Refresh PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
```

#### Linux (Ubuntu/Debian)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and PostgreSQL
brew install node postgresql
brew services start postgresql
```

### Step 2: Clone and Setup Project
```bash
# Clone repository
git clone https://github.com/DeadIntermediate/Discord-TeraBot-2.0.git
cd Discord-TeraBot-2.0

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Discord bot token and database credentials

# Run database migration
npm run db:push
```

### Step 3: Configure Discord Bot
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token and add it to your `.env` file
5. Enable necessary bot permissions (Send Messages, Use Slash Commands, etc.)

## 🗄️ Database Configuration Options

### Option 1: Local PostgreSQL (Default)
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/discord_bot
```

### Option 2: Neon Cloud Database (Recommended for beginners)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Use in your `.env` file:
```bash
DATABASE_URL=postgresql://username:password@ep-*.neon.tech/neondb?sslmode=require
```

### Option 3: Other Cloud Providers
- **Supabase**: [supabase.com](https://supabase.com)
- **Railway**: [railway.app](https://railway.app)
- **Heroku Postgres**: [heroku.com](https://heroku.com)

<!-- Cards Against Humanity feature removed -->

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. Node.js Not Found
```bash
# Windows
winget install OpenJS.NodeJS
# Restart PowerShell

# Linux/macOS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### 2. PostgreSQL Connection Failed
```bash
# Check if PostgreSQL is running
# Windows
Get-Service postgresql*

# Linux/macOS
sudo systemctl status postgresql
brew services list | grep postgresql
```

#### 3. npm Permission Errors (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

#### 4. Database Migration Failed
```bash
# Check database connection
psql -h localhost -U your_username -d discord_bot

# Or use cloud database instead
./setup.sh --cloud-database
```

#### 5. Bot Token Invalid
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → Bot
3. Click "Reset Token" and copy the new token
4. Update `.env` file with the new token

### Repair Installation
If something goes wrong, use repair mode:

```bash
# Windows
.\setup.ps1 -RepairMode

# Linux/macOS
./setup.sh --repair
```

This will:
- Remove `node_modules` and `package-lock.json`
- Clear npm cache
- Reinstall all dependencies

## 📚 Additional Resources

- **Discord.js Guide**: [discordjs.guide](https://discordjs.guide/)
- **PostgreSQL Documentation**: [postgresql.org/docs](https://www.postgresql.org/docs/)
- **Drizzle ORM Docs**: [orm.drizzle.team](https://orm.drizzle.team)
- **Node.js Documentation**: [nodejs.org/docs](https://nodejs.org/docs/)

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the troubleshooting section in `README.md`
2. Review the setup script output for specific error messages
3. Check `DEPLOYMENT.md` for production deployment guidance
4. (CAH docs removed) Review project docs for any game-specific setup

## 📄 Script Output Examples

### Successful Setup
```
🤖 TeraBot 2.0 Setup Script
============================

🔍 Checking system dependencies...
✅ Node.js found: v20.10.0
✅ npm found: 10.2.3
🗄️ Setting up database...
✅ PostgreSQL service is running!
🔧 Setting up environment configuration...
✅ Created .env file from .env.example
📦 Installing Node.js dependencies...
✅ Node.js dependencies installed successfully!
🧪 Testing bot setup...
✅ All required files present!
🗄️ Running database migration...
✅ Database migration completed successfully!

🎉 TeraBot 2.0 Setup Complete!
```

### Setup with Repairs
```
🔧 Repair mode activated...
🗑️ Removing node_modules...
🗑️ Removing package-lock.json...
🧹 Clearing npm cache...
📦 Installing Node.js dependencies...
✅ Node.js dependencies installed successfully!
```

---

**Author:** Josh (DeadIntermediate)  
**Version:** 2.1.0  
**Last Updated:** October 2025