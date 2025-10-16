# 🎮 Game Lookup System

A comprehensive game database lookup feature for TeraBot that provides detailed information about video games from multiple sources.

## ✨ Features

### **Game Information Display**
- **Game Title** with official website link
- **Release Date** and year
- **Ratings** from multiple sources (RAWG community rating, Metacritic score)
- **Platforms** (PC, PlayStation, Xbox, Nintendo, Mobile, etc.)
- **Genres** and game categories
- **Developers** and publishers
- **ESRB Rating** (age rating)
- **Average Playtime** hours
- **Game Description/Synopsis**
- **Screenshots** (carousel view with navigation)
- **Purchase Links** (Steam, Epic, etc.)

### **Advanced Search Features**
- **Smart Search** - Find games by partial name matches
- **Multiple Results** - Interactive selection menu for multiple matches
- **Autocomplete** - Quick access to popular games
- **Random Discovery** - Discover random popular games
- **Trending Games** - See what's hot in gaming

### **Database Features**
- **Game Favorites** - Users can save favorite games
- **Game Recommendations** - Recommend games to other users
- **API Caching** - Efficient caching system to reduce API calls
- **Multiple Data Sources** - Aggregates from RAWG, IGDB, Steam APIs

## 🎯 Commands

### `/game search <query>`
Search for games by name with interactive selection.

**Example:**
```
/game search witcher
```

**What it does:**
1. Searches the RAWG database for games matching "witcher"
2. If multiple results, shows a selection menu
3. User selects desired game from dropdown
4. Displays detailed game information

---

### `/game info <game>`
Get detailed information about a specific game.

**Example:**
```
/game info The Witcher 3: Wild Hunt
```

**What it shows:**
- 🎮 Game title with official website link
- 📅 Release date (May 19, 2015)
- ⭐ Rating (4.6/5 from community)
- 📊 Metacritic score (92/100)
- 🔞 ESRB Rating (Mature 17+)
- 🎮 Platforms (PC, PS4, PS5, Xbox One, Xbox Series X/S, Nintendo Switch)
- 🎯 Genres (Action, RPG, Adventure)
- 👥 Developers (CD Projekt Red)
- 🏢 Publishers (CD Projekt)
- ⏱️ Average Playtime (51 hours)
- 📖 Game description
- 📸 Screenshot carousel
- 🛒 Purchase links

---

### `/game random [count]`
Discover random popular games.

**Parameters:**
- `count` (optional): Number of games to show (1-5, default: 1)

**Example:**
```
/game random count:3
```

**What it does:**
- Fetches random highly-rated games from the database
- If count=1, shows detailed view of one game
- If count>1, shows a list of games with basic info

---

### `/game trending [count]`
Show trending games from the past year.

**Parameters:**
- `count` (optional): Number of games to show (1-10, default: 5)

**Example:**
```
/game trending count:10
```

**What it shows:**
- List of highest-rated recent releases
- Release dates and ratings for each
- Platform availability
- Quick access to detailed information

## 🔧 Setup Requirements

### **Required API Keys**

#### **RAWG API (Primary - Free)**
1. Visit https://rawg.io/apidocs
2. Create a free account
3. Get your API key
4. Add to `.env`:
   ```env
   RAWG_API_KEY=your_rawg_api_key_here
   ```

#### **IGDB API (Optional - Enhanced Data)**
1. Register app at https://dev.twitch.tv/console/apps
2. Get Client ID and Client Secret
3. Add to `.env`:
   ```env
   IGDB_CLIENT_ID=your_igdb_client_id
   IGDB_CLIENT_SECRET=your_igdb_client_secret
   ```

### **Required Packages**

Install missing dependencies:
```bash
# If npm is available
npm install axios node-cache

# Or add to package.json dependencies:
"axios": "^1.6.0",
"node-cache": "^5.1.2"
```

### **Database Migration**

Run database migration to add game tables:
```bash
npm run db:push
```

**New Tables Added:**
- `game_cache` - API response caching
- `game_favorites` - User favorite games
- `game_recommendations` - Game recommendations between users

## 📊 Data Sources

### **Primary: RAWG Video Games Database**
- **Status**: ✅ Implemented
- **Coverage**: 850,000+ games
- **Features**: Ratings, platforms, genres, developers, screenshots
- **API Limits**: 20,000 requests/month (free)
- **Authentication**: API Key required

### **Secondary: IGDB (Twitch Gaming Database)**
- **Status**: 🔄 Framework ready (needs implementation)
- **Coverage**: 200,000+ games with detailed metadata
- **Features**: Release dates, artwork, videos, companies
- **API Limits**: 4 requests/second
- **Authentication**: OAuth2 required

### **Tertiary: Steam API**
- **Status**: 🔄 Planned
- **Coverage**: Steam catalog
- **Features**: Pricing, reviews, achievements
- **API Limits**: 200 requests/5 minutes
- **Authentication**: API Key required

## 🎨 Example Embed Output

```
🎮 The Witcher 3: Wild Hunt
https://thewitcher.com/

Geralt of Rivia, a monster slayer for hire, journeys to find his adopted daughter on the run from the Wild Hunt in this open-world RPG.

Basic Information          Game Details
📅 Released: 2015-05-19   🎯 Genres: Action, RPG, Adventure
⭐ Rating: 4.6/5          👥 Developers: CD Projekt Red
📊 Metacritic: 92/100     🏢 Publishers: CD Projekt
🔞 ESRB: Mature 17+       ⏱️ Avg. Playtime: 51 hours

🎮 Platforms
PC, PlayStation 4, PlayStation 5, Xbox One, Xbox Series X/S, Nintendo Switch

[Screenshot showing game environment]

[View Screenshots] [Official Website] [Metacritic] [Get on Steam]

Data from RAWG Video Games Database • ID: 3328
```

## 🔄 Caching System

The system includes intelligent caching to optimize API usage:

- **Game Data**: Cached for 24 hours
- **Screenshots**: Cached for 7 days  
- **Search Results**: Cached for 1 hour
- **Trending/Random**: Cached for 6 hours

**Cache Management:**
- Automatic expiration
- Manual cache clearing (admin command)
- Memory-based caching (upgradeable to Redis)

## 🎯 Interactive Features

### **Screenshot Viewer**
- Navigate through multiple game screenshots
- Previous/Next buttons
- Full-resolution images
- Automatic timeout and cleanup

### **Game Selection Menu**
- Dropdown menu for multiple search results
- Game previews with ratings and platforms
- One-click detailed view
- Timeout handling

### **Quick Actions**
- Direct links to official websites
- Metacritic reviews
- Store purchase pages
- Steam/Epic/GOG integration

## 🔮 Future Enhancements

### **Planned Features**
- **Game Favorites System**: Save and manage favorite games
- **Game Recommendations**: Recommend games to server members
- **Game Wishlist**: Track games you want to play
- **Game Reviews**: User reviews and ratings
- **Game Comparisons**: Side-by-side game comparisons
- **Gaming Statistics**: Server gaming trends and stats
- **Game Alerts**: Notifications for releases and sales

### **Advanced Features**
- **Multi-language Support**: Game info in multiple languages
- **Price Tracking**: Monitor game prices across stores
- **Achievement Integration**: Track gaming achievements
- **Gaming Communities**: Find others playing the same games
- **Game Event Calendar**: Track release dates and events

## 🐛 Troubleshooting

### **Common Issues**

#### **"No games found" Error**
**Cause**: API rate limits or incorrect game name
**Solution**: 
1. Check RAWG API key is valid
2. Try different search terms
3. Check API rate limits (20,000/month)

#### **Missing Screenshots**
**Cause**: Game doesn't have screenshots or API error
**Solution**: Screenshots are not available for all games

#### **Slow Response Times**
**Cause**: API delays or large response data
**Solution**: Responses cached after first request

#### **Command Not Working**
**Cause**: Missing dependencies or API configuration
**Solution**: 
1. Verify `axios` and `node-cache` are installed
2. Check environment variables are set
3. Run database migration

### **API Status Check**

Test API connectivity:
```bash
# Test RAWG API
curl "https://api.rawg.io/api/games?key=YOUR_API_KEY&search=witcher"

# Check rate limits
curl -I "https://api.rawg.io/api/games?key=YOUR_API_KEY"
```

## 📚 Usage Examples

### **Finding a Specific Game**
```
User: /game search zelda breath of the wild
Bot: [Shows selection menu with Zelda games]
User: [Selects "The Legend of Zelda: Breath of the Wild"]
Bot: [Shows detailed game information with screenshots]
```

### **Discovering New Games**
```
User: /game random count:3
Bot: [Shows 3 random popular games with ratings and platforms]

User: /game trending
Bot: [Shows 5 trending games from the past year]
```

### **Getting Game Details**
```
User: /game info cyberpunk 2077
Bot: [Shows detailed Cyberpunk 2077 information with review scores, platforms, and screenshots]
```

## 🔒 Privacy & Data

- **No Personal Data**: Only Discord user IDs stored for favorites
- **API Compliance**: Follows RAWG API terms of service
- **Cache Management**: Cached data expires automatically
- **User Control**: Users can manage their own favorites

## 📝 Command Reference

| Command | Description | Required Role | Cooldown |
|---------|-------------|---------------|----------|
| `/game search` | Search for games | Everyone | 3 seconds |
| `/game info` | Get game details | Everyone | 3 seconds |
| `/game random` | Random games | Everyone | 5 seconds |
| `/game trending` | Trending games | Everyone | 10 seconds |

---

*The Game Lookup System enhances your Discord server with comprehensive gaming information, helping members discover new games and share their gaming interests.*