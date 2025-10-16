# 🎮 Game Lookup System - Installation Guide

## 📦 Required Packages

The Game Lookup System requires additional packages that need to be installed:

### **Install Missing Dependencies**

Add these to your `package.json` dependencies:

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "node-cache": "^5.1.2"
  }
}
```

**Installation Command:**
```bash
npm install axios node-cache
```

## 🔑 API Configuration

### **1. RAWG API (Primary - Required)**

**Free tier**: 20,000 requests/month

1. **Register**: Go to https://rawg.io/apidocs
2. **Create Account**: Sign up for a free account
3. **Get API Key**: Navigate to your API section
4. **Add to Environment**:
   ```env
   RAWG_API_KEY=your_api_key_here
   ```

### **2. IGDB API (Optional - Enhanced Data)**

**Free tier**: 4 requests/second

1. **Register App**: Go to https://dev.twitch.tv/console/apps
2. **Create New App**: 
   - Name: "Your Bot Name"
   - OAuth Redirect URL: `http://localhost`
   - Category: "Game Integration"
3. **Get Credentials**: Copy Client ID and Client Secret
4. **Add to Environment**:
   ```env
   IGDB_CLIENT_ID=your_client_id
   IGDB_CLIENT_SECRET=your_client_secret
   ```

## 🗄️ Database Migration

Run the database migration to add game tables:

```bash
npm run db:push
```

**New Tables Added:**
- `game_cache` - API response caching (1 hour - 24 hours TTL)
- `game_favorites` - User favorite games per server
- `game_recommendations` - Game recommendations between users

## ✅ Testing the Installation

### **1. Test Basic Functionality**

```bash
# Start the bot
npm run dev

# In Discord, test:
/game search witcher
```

### **2. Verify API Connection**

Check bot logs for:
```
✅ RAWG API configured and working
⚠️ IGDB API not configured (optional)
```

### **3. Test Commands**

Try these commands in Discord:
```
/game search minecraft
/game info cyberpunk 2077  
/game random
/game trending
```

## 🔧 Environment Variables

Complete `.env` configuration:

```env
# Existing variables
DATABASE_URL=postgresql://username:password@localhost:5432/terabot_db
DISCORD_BOT_TOKEN=your_discord_bot_token

# Game Lookup System (NEW)
RAWG_API_KEY=your_rawg_api_key
IGDB_CLIENT_ID=your_igdb_client_id
IGDB_CLIENT_SECRET=your_igdb_client_secret

# Optional: Cache settings
GAME_CACHE_TTL=3600000  # 1 hour in milliseconds
```

## 📊 API Limits & Monitoring

### **RAWG API Limits**
- **Free**: 20,000 requests/month
- **Rate**: No strict rate limiting
- **Monitoring**: Check usage at https://rawg.io/apidocs

### **IGDB API Limits**
- **Free**: 4 requests/second
- **Monthly**: No monthly limit
- **Rate**: Built-in rate limiting in bot

### **Bot Caching Strategy**
- **Game Details**: 24 hours
- **Search Results**: 1 hour  
- **Screenshots**: 7 days
- **Random/Trending**: 6 hours

## 🐛 Troubleshooting

### **Package Installation Issues**

**Error**: `Cannot find module 'axios'`
```bash
# Solution: Install missing packages
npm install axios node-cache

# Verify installation
npm list axios node-cache
```

### **API Configuration Issues**

**Error**: `RAWG API key not configured`
```bash
# Check .env file exists and has:
RAWG_API_KEY=your_actual_api_key

# Restart bot after adding environment variables
```

### **Database Migration Issues**

**Error**: `relation "game_cache" does not exist`
```bash
# Run database migration
npm run db:push

# If issues persist, check database connection
npm run dev
```

### **Command Not Appearing**

**Issue**: `/game` command not showing in Discord

**Solutions**:
1. **Restart Bot**: Commands register on startup
2. **Check Permissions**: Bot needs `applications.commands` scope
3. **Global vs Guild**: Commands take up to 1 hour to sync globally

### **API Rate Limiting**

**Error**: `Rate limit exceeded`

**RAWG API**:
- Wait until next month or upgrade plan
- Check usage: https://rawg.io/apidocs

**IGDB API**:
- Wait 1 second between requests (handled automatically)
- Consider implementing longer delays

## 📈 Performance Optimization

### **1. Cache Configuration**

Optimize cache settings in `gameAPI.ts`:
```typescript
// Increase cache TTL for frequently accessed data
private readonly CACHE_TTL = 3600000; // 1 hour

// Or use environment variable
private readonly CACHE_TTL = parseInt(process.env.GAME_CACHE_TTL || '3600000');
```

### **2. Database Indexing**

Add indexes for better performance:
```sql
-- Add indexes for common queries
CREATE INDEX idx_game_cache_game_id ON game_cache(game_id);
CREATE INDEX idx_game_favorites_user_id ON game_favorites(user_id);
CREATE INDEX idx_game_cache_expires_at ON game_cache(expires_at);
```

### **3. API Request Optimization**

- Enable response compression
- Use HTTP/2 when available
- Implement request batching where possible

## 🔄 Upgrading

### **From Basic to Enhanced**

1. **Add IGDB API**:
   ```env
   IGDB_CLIENT_ID=your_client_id
   IGDB_CLIENT_SECRET=your_client_secret
   ```

2. **Implement Enhanced Features**:
   - Game recommendations
   - Enhanced metadata
   - Video trailers
   - Release calendars

### **Production Considerations**

1. **Redis Cache**: Replace in-memory cache with Redis
2. **Rate Limiting**: Implement user-level rate limiting
3. **Error Handling**: Enhanced error reporting and recovery
4. **Monitoring**: API usage monitoring and alerts

## 🎯 Quick Start Checklist

- [ ] Install `axios` and `node-cache` packages
- [ ] Register for RAWG API key (required)
- [ ] Add `RAWG_API_KEY` to `.env` file
- [ ] Run `npm run db:push` for database migration
- [ ] Restart bot to load new commands
- [ ] Test `/game search minecraft` in Discord
- [ ] Verify game information displays correctly
- [ ] Test screenshot viewer functionality
- [ ] Optional: Add IGDB API for enhanced data

## 📞 Support

If you encounter issues:

1. **Check Logs**: Look for error messages in bot console
2. **Verify Environment**: Ensure all variables are set correctly
3. **Test APIs**: Manually test API endpoints
4. **Database**: Verify tables were created successfully
5. **Discord Permissions**: Ensure bot has required permissions

---

*After completing this installation, your bot will have a fully functional game lookup system with rich embeds, interactive menus, and comprehensive game information!*