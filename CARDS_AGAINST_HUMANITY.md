# Cards Against Humanity Discord Bot Feature

## 🃏 Overview

A complete implementation of Cards Against Humanity for Discord servers, featuring multiplayer gameplay, custom cards, server administration, and comprehensive statistics tracking.

## 📋 Table of Contents

1. [Features](#features)
2. [Database Schema](#database-schema)
3. [Commands](#commands)
4. [Game Flow](#game-flow)
5. [Installation & Setup](#installation--setup)
6. [Configuration](#configuration)
7. [Administration](#administration)
8. [Technical Implementation](#technical-implementation)

## ✨ Features

### 🎮 Core Gameplay
- **Multiplayer Support**: 3-10 players per game
- **Round-based Gameplay**: Configurable max rounds (5-20)
- **Judge Rotation**: Fair turn-based judging system
- **Real-time Interaction**: Discord embeds and buttons
- **Win Conditions**: Configurable point threshold (3-10 points)
- **Game State Management**: Persistent game state with database storage

### 🃏 Card Management
- **Official Cards**: Complete base set from Cards Against Humanity
- **Multiple Card Sets**: Base, Family-Friendly, Gaming, Community
- **Custom Cards**: Server-specific custom white and black cards
- **Card Approval System**: Admin moderation for custom submissions
- **Smart Card Dealing**: No duplicate cards per game session

### 🛡️ Content Moderation
- **Family-Friendly Mode**: Clean content option for all audiences
- **Server Settings**: Per-server configuration options
- **Content Filtering**: Automatic filtering based on server settings
- **Custom Card Approval**: Admin control over user-submitted cards

### 📊 Statistics & Leaderboards
- **Player Statistics**: Games played, wins, rounds won, total score
- **Server Leaderboards**: Top players by wins and win percentage
- **Game History**: Complete record of past games
- **Card Usage Tracking**: Popular cards and usage statistics

### 🎨 Rich Discord Integration
- **Interactive Embeds**: Beautiful, responsive game displays
- **Button Controls**: Easy-to-use game controls
- **Select Menus**: Intuitive card selection interface
- **Private DMs**: Secure hand delivery to players
- **Real-time Updates**: Live game state updates

## 🗄️ Database Schema

### Core Tables

#### `cah_white_cards`
```sql
- id: Primary key
- content: Card text content
- card_set: Set identifier (base, family, gaming, etc.)
- server_id: Server ID for custom cards (nullable)
- created_by: User ID who created the card
- is_approved: Admin approval status
- is_active: Card availability status
- usage_count: Popularity tracking
- created_at: Creation timestamp
```

#### `cah_black_cards`
```sql
- id: Primary key
- content: Card text with blanks (____)
- pick_count: Number of white cards required (1-3)
- card_set: Set identifier
- server_id: Server ID for custom cards (nullable)
- created_by: User ID who created the card
- is_approved: Admin approval status
- is_active: Card availability status
- usage_count: Popularity tracking
- created_at: Creation timestamp
```

#### `cah_games`
```sql
- id: Primary key
- server_id: Discord server ID
- channel_id: Discord channel ID
- host_id: Game host user ID
- game_message_id: Main game embed message
- status: Game state (waiting, active, voting, finished, cancelled)
- current_round: Current round number
- max_rounds: Maximum rounds for this game
- max_players: Maximum players for this game
- current_judge_id: Current round judge
- current_black_card_id: Current round's black card
- settings: Game configuration (JSON)
- game_data: Runtime game state (JSON)
- winner_id: Game winner user ID
- created_at: Game creation time
- started_at: Game start time
- ended_at: Game end time
```

#### `cah_game_players`
```sql
- id: Primary key
- game_id: Reference to game
- user_id: Discord user ID
- hand: Player's white cards (JSON array)
- score: Current game score
- is_active: Player status
- joined_at: Join timestamp
- left_at: Leave timestamp (nullable)
```

#### `cah_game_submissions`
```sql
- id: Primary key
- game_id: Reference to game
- player_id: Reference to player
- round: Round number
- white_card_ids: Submitted cards (JSON array)
- is_winner: Winning submission flag
- votes: Vote count (for voting modes)
- submitted_at: Submission timestamp
```

#### `cah_game_stats`
```sql
- id: Primary key
- user_id: Discord user ID
- server_id: Discord server ID (nullable for global)
- games_played: Total games participated
- games_won: Total games won
- rounds_won: Total rounds won
- rounds_judged: Total rounds judged
- favorite_white_card: Most used white card
- favorite_black_card: Most used black card
- total_score: Cumulative score across all games
- average_score: Average score per game
- last_played_at: Last game participation
- created_at: Stats creation time
- updated_at: Last update time
```

## 🎮 Commands

### Player Commands (`/cah`)

#### Game Management
- `/cah create` - Create a new game
  - `max-players` (3-10): Maximum players
  - `max-rounds` (5-20): Maximum rounds
  - `win-condition` (3-10): Points to win
  - `family-friendly`: Use clean content only

- `/cah join` - Join an active game
- `/cah leave` - Leave current game
- `/cah start` - Start game (host only)
- `/cah cancel` - Cancel game (host only)

#### Gameplay
- `/cah hand` - View your cards (private DM)
- `/cah play` - Submit cards for current round
- `/cah status` - View current game status
- `/cah stats` - View your statistics

### Admin Commands (`/cahadmin`)

#### Card Management (`/cahadmin cards`)
- `/cahadmin cards seed` - Initialize official card database
  - `force`: Force re-seed existing cards

- `/cahadmin cards add-white` - Add custom white card
  - `content`: Card text content
  - `set`: Card set (server-custom, family, gaming, community)

- `/cahadmin cards add-black` - Add custom black card
  - `content`: Card text with blanks
  - `pick-count`: Number of cards to pick (1-3)
  - `set`: Card set identifier

- `/cahadmin cards list` - List server's custom cards
  - `type`: white, black, or all

- `/cahadmin cards remove` - Remove custom card
  - `card-id`: Card ID to remove

- `/cahadmin cards stats` - View card statistics

#### Game Management (`/cahadmin games`)
- `/cahadmin games list` - List active games
- `/cahadmin games force-end` - Force end active game
  - `game-id`: Specific game ID (optional)

- `/cahadmin games history` - View completed games
  - `limit`: Number of games to show (1-20)

- `/cahadmin games leaderboard` - Server leaderboard
  - `limit`: Number of players to show (5-25)

#### Server Settings (`/cahadmin settings`)
- `/cahadmin settings family-mode` - Toggle family-friendly mode
  - `enabled`: Enable/disable family mode

- `/cahadmin settings max-games` - Set concurrent game limit
  - `count`: Maximum concurrent games (1-5)

- `/cahadmin settings view` - View current settings

## 🎯 Game Flow

### Phase 1: Game Creation & Lobby
1. **Host creates game** with `/cah create`
2. **Players join** using `/cah join` or join button
3. **Game lobby displays** player list and settings
4. **Host starts** when ready (minimum 3 players)

### Phase 2: Round Start
1. **System selects judge** (rotation or random)
2. **Black card drawn** from available pool
3. **Cards dealt** to maintain 7-card hands
4. **Round embed posted** with black card and instructions
5. **Private hands sent** to all players via DM

### Phase 3: Card Submission
1. **Non-judge players** use `/cah play` to submit cards
2. **Card selection interface** shows available options
3. **Submissions tracked** until all players complete
4. **Phase changes** to voting when all submitted

### Phase 4: Judge Decision
1. **All submissions displayed** anonymously to judge
2. **Judge receives private interface** with voting options
3. **Judge selects winner** from submission options
4. **Winner announced** publicly with winning combination

### Phase 5: Round Resolution
1. **Points awarded** to round winner
2. **Scores updated** and displayed
3. **Win condition checked** (target points reached)
4. **Next round starts** or game ends
5. **Statistics updated** for all participants

### Phase 6: Game End
1. **Winner announcement** with final leaderboard
2. **Game marked finished** in database
3. **Player statistics updated** with game results
4. **Game cleanup** and state archival

## 🚀 Installation & Setup

### Prerequisites
```bash
# Required Node.js packages
npm install discord.js
npm install drizzle-orm
npm install @types/node

# Database setup (PostgreSQL required)
# Ensure your .env file has:
DATABASE_URL=postgresql://user:password@localhost:5432/terabot
```

### Database Migration
```bash
# Run database push to create CAH tables
npm run db:push

# Seed official Cards Against Humanity cards
# Use /cahadmin cards seed command in Discord
```

### Bot Permissions
Ensure your Discord bot has these permissions:
- ✅ Send Messages
- ✅ Use Slash Commands
- ✅ Embed Links
- ✅ Read Message History
- ✅ Add Reactions
- ✅ Send Messages in Threads
- ✅ Send DMs to Users

### Initial Setup Commands
1. **Seed official cards**: `/cahadmin cards seed`
2. **Configure server settings**: `/cahadmin settings family-mode enabled:false`
3. **Test game creation**: `/cah create`

## ⚙️ Configuration

### Game Settings
```typescript
interface GameSettings {
  maxPlayers: number;        // 3-10 players
  maxRounds: number;         // 5-20 rounds
  winCondition: number;      // 3-10 points to win
  cardSets: string[];        // ['base', 'family', 'gaming']
  judgeRotation: boolean;    // True for rotation, false for random
  allowCustomCards: boolean; // Allow server custom cards
  familyFriendly: boolean;   // Filter inappropriate content
}
```

### Server Settings
```json
{
  "cah_family_mode": false,    // Family-friendly content only
  "cah_max_games": 3,          // Max concurrent games per server
  "cah_auto_cleanup": true,    // Auto-cleanup finished games
  "cah_stats_tracking": true   // Track player statistics
}
```

### Card Sets Available
- **`base`**: Original Cards Against Humanity cards
- **`family`**: Family-friendly alternatives
- **`gaming`**: Gaming and internet culture cards
- **`community`**: Community-contributed cards
- **`server-custom`**: Server-specific custom cards

## 🛡️ Administration

### Content Moderation
```bash
# Enable family-friendly mode
/cahadmin settings family-mode enabled:true

# Review custom cards
/cahadmin cards list type:all

# Remove inappropriate cards
/cahadmin cards remove card-id:abc123...
```

### Game Monitoring
```bash
# Monitor active games
/cahadmin games list

# Force end problematic game
/cahadmin games force-end game-id:def456...

# View game history
/cahadmin games history limit:10
```

### Server Statistics
```bash
# View server leaderboard
/cahadmin games leaderboard limit:10

# Check card usage stats
/cahadmin cards stats

# Review server settings
/cahadmin settings view
```

## 🔧 Technical Implementation

### Core Components

#### `CahGameEngine` Class
- **Game State Management**: Persistent game state handling
- **Card Dealing**: Smart card distribution without duplicates
- **Round Management**: Automated round progression
- **Player Management**: Join/leave/kick functionality
- **Scoring System**: Point tracking and win condition checking

#### `CahEmbedBuilder` Class
- **Rich Embeds**: Beautiful Discord embed creation
- **Interactive Components**: Button and select menu generation
- **Dynamic Updates**: Real-time embed updates
- **Error Handling**: User-friendly error messages

#### Database Integration
- **Drizzle ORM**: Type-safe database operations
- **Relationship Management**: Proper foreign key relationships
- **Data Validation**: Input sanitization and validation
- **Performance Optimization**: Efficient queries and indexing

### Key Features

#### Memory Management
```typescript
// Active games stored in memory for performance
const activeGames = new Map<string, CahGameEngine>();

// Automatic cleanup of finished games
setInterval(() => {
  cleanupFinishedGames();
}, 300000); // Every 5 minutes
```

#### Error Handling
```typescript
try {
  const result = await gameEngine.submitCards(userId, cardIds);
  if (!result.success) {
    return await interaction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
} catch (error) {
  console.error('Game error:', error);
  return await interaction.reply({
    content: '❌ An unexpected error occurred.',
    ephemeral: true
  });
}
```

#### Security Considerations
- **Input Validation**: All user inputs validated and sanitized
- **Permission Checks**: Proper Discord permission verification
- **Rate Limiting**: Built-in protection against spam
- **SQL Injection Prevention**: Parameterized queries only

## 📊 Analytics & Monitoring

### Game Metrics
- **Total Games Played**: Lifetime game count
- **Average Game Duration**: Time from start to finish
- **Player Retention**: Return player statistics
- **Popular Cards**: Most-used white/black cards
- **Server Activity**: Games per server over time

### Performance Monitoring
- **Database Query Performance**: Query execution times
- **Memory Usage**: Active game memory consumption
- **Error Rates**: Exception tracking and handling
- **Response Times**: Command execution speed

## 🎉 Future Enhancements

### Planned Features
- **Tournament Mode**: Bracket-style competitions
- **Custom Game Modes**: Alternative rule sets
- **Card Trading**: Player card collections
- **Voice Integration**: Voice channel support
- **Mobile Optimization**: Mobile-friendly interfaces

### Potential Improvements
- **AI Judge Mode**: Computer-controlled judging
- **Themed Card Packs**: Holiday and event-specific cards
- **Player Achievements**: Unlock system for gameplay milestones
- **Spectator Mode**: Non-player viewing experience
- **Live Streaming Integration**: Twitch/YouTube integration

---

## 🚨 Content Warning

**Age Rating**: 17+ (Mature Content)

Cards Against Humanity contains adult humor, mature themes, and potentially offensive content. Server administrators should:

1. **Enable Family Mode** for all-ages servers
2. **Review custom cards** before approval
3. **Set clear server rules** about appropriate usage
4. **Monitor game content** for compliance with Discord ToS

**Disclaimer**: This implementation includes the option for family-friendly content and provides administrative controls for content moderation. Server administrators are responsible for ensuring compliance with their community guidelines and Discord's Terms of Service.

---

*Cards Against Humanity Discord Bot Implementation - A party game for horrible people, now on Discord! 🃏*