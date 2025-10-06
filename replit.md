# Overview

This is a comprehensive Discord bot application designed for community management and engagement. The bot provides a wide range of features including moderation tools, welcome messages, leveling systems, giveaways, ticketing, and more. The application consists of a Python Discord bot backend integrated with a TypeScript/React web dashboard for server configuration and management.

# Recent Changes (October 4, 2025)

- **Web Dashboard**: Added comprehensive bot control panel (accessible at `/dashboard`)
  - Real-time bot status monitoring with auto-refresh
  - Start, Stop, and Restart controls for the Discord bot
  - Analytics display showing member count, tickets, mod actions, and giveaways
  - Settings panel with feature toggles for enable/disable functionality
  - Clean, dark-themed UI with responsive design
- **Updated /help Command**: Added all missing commands including mute, clear, closeticket, assignticket, ticketlist, gend, glist, listreactionroles
  - Fixed stream command names (streamadd, streamremove, streamlist)
  - Now shows all 35 bot commands organized by category
- **Interactive Embed Builder**: Complete embed creation system with JSON support
  - `/embed` command opens interactive modal builder with title, description, color, thumbnail, and footer fields
  - `/embedjson` command creates embeds from Discord JSON format for advanced users
  - `/embedsave` command saves embed templates for reuse
  - `/embeduse` command sends saved embed templates to any channel
  - `/embedlist` command shows all saved embeds in the server
  - `/embeddelete` command removes saved embed templates
  - Color support: hex codes (#5865F2) or color names (blue, red, green, etc.)
  - Optional auto-save: create and save embeds in one step
- **Anti-Invite System**: Automatic detection and removal of external Discord invite links
  - Automatically deletes messages containing Discord invites for other servers
  - Allows invites for the current server
  - `/antiinvite` command to enable/disable and configure log channel
  - `/antiinvite-bypass` command to add/remove bypass roles (admins/mods can post external invites)
  - DM notification to users when their invite is removed
  - Optional logging to moderation channel
  - Handles invalid/expired invites by removing them
- **Member Info Command**: Added `/memberinfo` for staff to view comprehensive member details
  - Shows account creation date, server join date, and membership duration
  - Displays text/voice/global levels and XP stats
  - Lists member roles and key permissions
  - Shows current status and activity
  - Restricted to staff with Moderate Members permission
- **Fixed Leveling System**: Resolved issues with member tracking
  - Members are now automatically added to leveling system on first message/voice activity
  - Fixed voice time tracking when switching between channels
  - Voice XP now properly saves when changing channels instead of only on disconnect
- **Triple-Track Leveling System**: Comprehensive XP tracking with three separate systems
  - Text XP: Earned from sending messages (5 XP per message)
  - Voice XP: Earned from voice channel participation (10 XP per minute)
  - Global Level: Combined ranking system using both text and voice XP
  - Dedicated leaderboard commands for each track: `/leaderboard text`, `/leaderboard voice`, `/leaderboard global`
- **Stream Notification System**: Multi-platform live stream alerts
  - Support for Twitch, YouTube, and Kick streaming platforms
  - `/addstreamer` command to add streamers with platform selection
  - `/removestreamer` command to remove tracked streamers
  - `/liststreams` command to view all configured notifications
  - Auto-updating embeds when streamers go live
- **Enhanced Welcome System**: Staff log channel feature with detailed member join/leave tracking
  - Public welcome messages for new members
  - Private staff logs showing account age, bot/user status, and guild statistics
  - `/setupwelcomelog` command to configure staff log channel
- **Ticket System Close Button**: Persistent "Close Ticket" button for easier ticket management
- **Converted Discord Bot to Python**: Migrated from TypeScript/JavaScript to Python using Discord.py with cogs-based architecture
- **Implemented Cogs System**: Organized bot functionality into 10 separate cogs (moderation, utility, events, leveling, giveaways, role_reactions, tickets, streams, anti_invite, embeds)
- **Verified Functionality**: All 10 cogs load successfully, 35 slash commands synced to Discord

# User Preferences

Preferred communication style: Simple, everyday language.
Bot implementation preference: Python with Discord.py using cogs system

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Components**: Radix UI primitives with custom styling (shadcn/ui component library)
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Design System**: Component-based architecture with reusable UI components and a dark theme

## Backend Architecture
- **Web Server Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP server and REST API (serves on port 5000)
- **Discord Bot Runtime**: Python 3.x with Discord.py library
- **Bot Architecture**: Cogs-based modular design for feature organization
- **Bot Control System**: Centralized bot controller managing bot process lifecycle (start/stop/restart)
- **Database ORM**: Drizzle ORM (Node.js) and asyncpg (Python) for database operations
- **API Design**: RESTful endpoints for CRUD operations on Discord servers, members, moderation logs, tickets, giveaways, and bot control
  - `/api/bot/status` - Get current bot status
  - `/api/bot/start` - Start the Discord bot
  - `/api/bot/stop` - Stop the Discord bot
  - `/api/bot/restart` - Restart the Discord bot
- **Real-time Communication**: WebSocket support for live updates
- **Process Management**: Bot controller manages Python bot as child process with unbuffered output

## Database Schema
- **Users**: Basic user authentication and management
- **Discord Servers**: Server configuration, settings, and metadata (includes welcome_channel_id, staff_log_channel_id, moderation_channel_id)
- **Discord Users**: Discord user profiles and information
- **Server Members**: Triple-track leveling system with separate text_xp, text_level, voice_xp, voice_level, and global_level fields, plus message count and voice time tracking
- **Moderation Logs**: Comprehensive logging of all moderation actions
- **Tickets**: Support ticket system with status tracking
- **Giveaways**: Giveaway management with participant tracking
- **Role Reactions**: Self-assignable role system via message reactions
- **Stream Notifications**: Multi-platform streamer tracking (Twitch, YouTube, Kick) with channel configuration
- **Saved Embeds**: Reusable embed templates with JSON data storage

## Discord Bot Features
- **Moderation Commands**: Kick, ban, and other moderation actions with logging
- **Anti-Invite System**: Automatic detection and removal of Discord invite links for external servers
  - Configurable per-server enable/disable
  - Bypass roles for staff who can post external invites
  - DM notifications and optional moderation logging
  - Handles invalid/expired invites safely
- **Utility Commands**: Server information and member details
  - `/memberinfo` for staff to view comprehensive member information
- **Event Handlers**: 
  - Public welcome messages for new members
  - Private staff log channel with detailed member join/leave information (account age, bot/user status, guild stats)
  - Member join/leave tracking in database
- **Ticket System**: Create, manage, and close support tickets with persistent button interface
- **Triple-Track Leveling System**: Comprehensive XP tracking system
  - Text XP from messages (5 XP per message)
  - Voice XP from voice channel time (10 XP per minute)
  - Global level combining both XP types
  - Three leaderboard commands for separate rankings
  - Automatic member initialization on first activity
- **Stream Notifications**: Multi-platform live stream alerts for Twitch, YouTube, and Kick
- **Interactive Embed Builder**: Complete embed creation system
  - Interactive modal builder with color support (hex codes or color names)
  - JSON-based embed creation for advanced users
  - Save and reuse embed templates across the server
  - List, use, and delete saved embeds
- **Giveaway System**: Create and manage server giveaways
- **Role Reactions**: Self-assignable roles via message reactions
- **Slash Commands**: Modern Discord interaction system with 35 commands
- **Auto-moderation**: Configurable moderation rules and actions

## Development Environment
- **Monorepo Structure**: Shared schema and types between frontend and backend
- **Development Tools**: Hot reloading with Vite, TypeScript compilation, and database migrations
- **Build Process**: Separate build processes for client (Vite) and server (ESBuild)

# External Dependencies

## Database
- **Neon Database**: PostgreSQL serverless database for production
- **Connection Pooling**: @neondatabase/serverless for efficient database connections

## Discord Integration
- **Discord.js**: Official Discord API library for bot functionality
- **Bot Permissions**: Comprehensive permission system for moderation and management

## UI and Styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography

## Development and Build Tools
- **Vite**: Fast development server and build tool for the frontend
- **ESBuild**: Fast JavaScript bundler for server-side code
- **TypeScript**: Type safety across the entire application
- **Drizzle Kit**: Database migration and schema management tool

## Third-party Services
- **Font Loading**: Google Fonts integration for typography
- **Development Banner**: Replit-specific development environment integration
- **WebSocket Support**: Real-time communication capabilities