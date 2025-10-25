# Multi-API Game Data Enrichment Setup

## Overview

The bot now uses a powerful multi-API system to enrich game data with the most accurate and comprehensive information available. It combines data from 5 different APIs to provide:

- ✅ Accurate playtime estimates (averaged from multiple sources)
- ✅ Rich game descriptions
- ✅ Metacritic scores
- ✅ Steam achievements data
- ✅ And more!

## Supported APIs

### 1. **RAWG** (Primary - Required) ✅
**What it provides:**
- Game basics, platforms, genres, developers
- Release date, ratings, background images
- Stores/links for purchasing

**Setup:** Already configured
- Free API key from https://rawg.io/apidocs
- Add to `.env`: `RAWG_API_KEY=your_key`

---

### 2. **IGDB (Twitch Gaming Database)** 🎮
**What it provides:**
- Accurate playtime estimates (story duration)
- Game descriptions and storyline info
- Aggregated ratings

**Setup:**
1. Go to https://dev.twitch.tv/console/apps
2. Create a new application
3. Get your **Client ID** and generate an **OAuth Token**
4. Add to `.env`:
   ```
   IGDB_API_KEY=your_igdb_oauth_token
   TWITCH_CLIENT_ID=your_twitch_client_id
   ```

**Rate Limits:** 4 requests per second

---

### 3. **Steam API** 🖥️
**What it provides:**
- PC-specific game data
- Achievement counts
- Player counts
- Alternative titles

**Setup:** No key required!
- Free and public API
- Automatically enabled

---

### 4. **GiantBomb** 🎥
**What it provides:**
- Rich game descriptions from the wiki
- Video game database entries
- User reviews and information
- Metacritic scores

**Setup:**
1. Sign up at https://www.giantbomb.com/api/
2. Get your free API key
3. Add to `.env`:
   ```
   GIANTBOMB_API_KEY=your_giantbomb_api_key
   ```

**Rate Limits:** Reasonable limits, check docs

---

### 5. **MobyGames** 📚
**What it provides:**
- Alternative game information
- Platform compatibility details
- Game covers and media

**Setup:**
1. Go to https://www.mobygames.com/info/api
2. Request a free API key
3. Add to `.env`:
   ```
   MOBYGAMES_API_KEY=your_mobygames_api_key
   ```

**Rate Limits:** Varies by tier

---

## Data Aggregation Strategy

The system intelligently combines data from multiple sources:

### **Playtime Calculation:**
```
1. Fetch playtime from IGDB
2. Fetch playtime from MobyGames
3. Use RAWG as fallback
4. Average all available values
5. Round to nearest integer
```

**Example:**
- IGDB: 12 hours
- MobyGames: 10 hours
- RAWG: 15 hours
- **Result:** Average = 12.3 → **12 hours**

### **Description Priority:**
1. GiantBomb (most detailed)
2. RAWG
3. IGDB
4. Use first available

### **Metacritic Score Priority:**
1. RAWG (if available)
2. GiantBomb (as fallback)
3. IGDB (if available)

### **Other Data:**
- Steam achievements + PC platform data
- Combine all available genres, platforms, developers
- Deduplicate information

---

## Complete .env Configuration

Add all these to your `.env` file:

```env
# Existing
RAWG_API_KEY=your_rawg_key
DATABASE_URL=your_db_url
DISCORD_TOKEN=your_discord_token

# New - Multi-API
IGDB_API_KEY=your_igdb_token
TWITCH_CLIENT_ID=your_twitch_client_id
GIANTBOMB_API_KEY=your_giantbomb_key
MOBYGAMES_API_KEY=your_mobygames_key

# Optional
X_API_KEY=your_x_api_key
INSTAGRAM_API_TOKEN=your_instagram_token
```

---

## API Priority & Fallback

The system is designed to be resilient:

```
Priority Chain:
┌─ IGDB → MOBYGAMES → RAWG (for playtime)
├─ GIANTBOMB → RAWG (for description)
├─ GIANTBOMB → RAWG (for metacritic)
├─ STEAM (for achievements)
└─ Gracefully handles missing APIs
```

**If any API is missing or fails:**
- ✅ Bot continues working
- ✅ Uses fallback sources
- ✅ Logs which API failed
- ✅ Serves best available data

---

## Performance

**Fetch Time:** ~2-3 seconds for full enrichment
- Parallel requests to all APIs
- No sequential blocking
- Timeout protection per API

**Caching:** Planned for future (Redis recommended)

---

## Monitoring & Debugging

Check console logs for API performance:

```
🔄 Enriching game data for "Resident Evil 4" from multiple APIs...
🎮 IGDB: Found "Resident Evil 4" with playtime estimate
🖥️ Steam: Found "Resident Evil 4 Remake" with 47 achievements
🎥 GiantBomb: Found "Resident Evil 4"
📚 MobyGames: Found "Resident Evil 4"
⏱️ Playtime data: 12, 10, 15 → Average: 12h
✅ Game data enriched: playtime=12h, description=yes, metacritic=82
```

---

## Troubleshooting

### No playtime showing
- Check IGDB_API_KEY and TWITCH_CLIENT_ID are set
- Check your Twitch OAuth token is valid
- RAWG should provide fallback

### Missing descriptions
- Verify GIANTBOMB_API_KEY is configured
- RAWG should provide fallback description

### Game not found in some APIs
- Not all games are indexed in every database
- System uses available data
- Check console logs for which APIs found the game

### Rate limit errors
- Wait a few seconds between requests
- Consider implementing rate limit handling
- Check individual API rate limits

---

## Future Enhancements

- [ ] Redis caching (avoid re-fetching)
- [ ] Additional APIs (Wikipedia for descriptions)
- [ ] User-contributed playtime data
- [ ] Region-specific data
- [ ] Cloud save integration
- [ ] Achievement tracking

---

## API Credits

- **RAWG:** https://rawg.io
- **IGDB:** https://www.igdb.com/api
- **Steam:** https://steamcommunity.com/dev
- **GiantBomb:** https://www.giantbomb.com/api/
- **MobyGames:** https://www.mobygames.com/api

---

## Support

If you encounter issues:
1. Check all API keys in `.env`
2. Verify API credentials are valid
3. Check console logs for error messages
4. Ensure rate limits haven't been exceeded
5. Test with a common game (Minecraft, Fortnite, etc.)
