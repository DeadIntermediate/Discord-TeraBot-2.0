# TeraBot 2.0 Technology Stack

## Overview
TeraBot 2.0 is built **entirely with Node.js and TypeScript**. This document outlines the complete technology stack.

## Core Technologies

### Bot Framework
- **Runtime**: Node.js 20.x (LTS)
- **Language**: TypeScript
- **Discord Library**: Discord.js v14.22.1
- **Architecture**: Modular command structure with event handlers

### Web Dashboard
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter

### Backend Server
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **API**: RESTful endpoints for bot control and data management

### Database
- **Database**: PostgreSQL (local or Neon cloud)
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit
- **Connection**: @neondatabase/serverless

## Project Structure

```
Discord-TeraBot-2.0/
├── server/
│   ├── bot/              # Discord bot code
│   │   ├── index.ts      # Bot initialization
│   │   ├── commands/     # Slash commands
│   │   └── events/       # Event handlers
│   ├── index.ts          # Express server
│   ├── routes.ts         # API routes
│   └── botControl.ts     # Bot lifecycle management
├── client/
│   └── src/              # React dashboard
├── shared/
│   └── schema.ts         # Database schema
└── migrations/           # Database migrations
```

## Bot Features (Implemented)

### Moderation
- `/kick` - Remove a member from the server
- `/ban` - Ban a member from the server
- `/timeout` - Temporarily timeout a member
- `/jail` - Restrict member to single channel
- `/unjail` - Remove jail restrictions
- `/warn` - Issue a warning to a member
- `/modhistory` - View moderation history
- `/clear` - Bulk delete messages

### Utility
- `/ping` - Check bot latency
- `/serverinfo` - Display server information
- `/help` - Show available commands
- `/memberinfo` - View member details

### Tickets
- `/ticket create` - Create a support ticket
- `/ticket manage` - Manage ticket settings
- `/ticket close` - Close a ticket
- `/ticket assign` - Assign ticket to staff
- `/ticket list` - List all tickets

### Giveaways
- `/giveaway create` - Start a new giveaway
- `/giveaway end` - End a giveaway early
- `/giveaway list` - List active giveaways
- `/giveaway reroll` - Reroll giveaway winner

### Role Management
- `/rolereaction create` - Set up role reactions
- `/rolereaction remove` - Remove role reactions
- `/rolereaction template` - Use preset templates

### Custom Content
- `/embed create` - Interactive embed builder
- `/embed save` - Save embed template
- `/embed list` - List saved embeds

### Welcome/Leave System
- Customizable join messages with embeds
- Customizable leave messages with embeds
- Placeholder support: {user}, {server}, {membercount}

## Dependencies

### Production Dependencies
```json
{
  "discord.js": "^14.22.1",
  "express": "^4.21.2",
  "@neondatabase/serverless": "^0.10.4",
  "drizzle-orm": "^0.38.3",
  "dotenv": "^16.4.7",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.6.3",
  "vite": "^6.0.1",
  "@types/express": "^5.0.0",
  "@types/react": "^18.3.18",
  "drizzle-kit": "^0.30.1",
  "tailwindcss": "^3.4.17"
}
```

## Environment Variables

Required `.env` configuration:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Server Configuration
NODE_ENV=production
PORT=5000
```

## Installation & Setup

### Prerequisites
1. Node.js 20.x or higher
2. PostgreSQL database (local or Neon cloud)
3. Discord Bot Token from Discord Developer Portal

### Quick Start
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:push

# Start development server
npm run dev

# Or start production server
npm start
```

## Deployment

### Systemd Service (Linux)
```ini
[Unit]
Description=TeraBot 2.0 - Discord Bot
After=network.target postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/Discord-TeraBot-2.0
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Commands
```bash
# Enable service
sudo systemctl enable terabot

# Start service
sudo systemctl start terabot

# Check status
sudo systemctl status terabot

# View logs
sudo journalctl -u terabot -f
```

## Migration from Python

**Note**: A previous Python version of this bot has been archived in the `python_legacy/` directory. The current production bot is built entirely with Node.js and Discord.js. The Python code is kept for reference only and is not required for bot operation.

## Development Workflow

### Adding New Commands
1. Create command file in `server/bot/commands/`
2. Export command data and execute function
3. Import in `server/bot/commands/index.ts`
4. Bot automatically registers new commands

### Database Changes
1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Drizzle ORM handles migrations automatically

### Testing
```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Support & Resources

- **Documentation**: See `DEPLOYMENT.md` for detailed deployment guide
- **README**: See `README.md` for feature overview
- **Discord.js Docs**: https://discord.js.org/
- **Drizzle ORM Docs**: https://orm.drizzle.team/

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**License**: MIT
