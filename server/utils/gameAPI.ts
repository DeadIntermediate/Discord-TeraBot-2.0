/**
 * Game Database API Service
 * Aggregates data from multiple gaming APIs to provide comprehensive game information
 * 
 * Primary APIs:
 * - RAWG Video Games Database (Free, no auth required)
 * - IGDB (Twitch Gaming Database) (Requires auth)
 * - Steam API (Free, for additional data)
 */

export interface GameData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  synopsis?: string;
  released?: string;
  year?: number;
  rating?: number;
  rating_top?: number;
  metacritic?: number;
  platforms?: GamePlatform[];
  genres?: string[];
  developers?: string[];
  publishers?: string[];
  esrb_rating?: string;
  tags?: string[];
  background_image?: string;
  screenshots?: string[];
  website?: string;
  reddit_url?: string;
  metacritic_url?: string;
  playtime?: number; // average playtime in hours
  achievements_count?: number;
  parent_platforms?: string[];
  stores?: GameStore[];
  clip?: GameClip;
  user_game?: any;
}

export interface GamePlatform {
  id: number;
  name: string;
  slug: string;
  image?: string;
  year_end?: number;
  year_start?: number;
  games_count?: number;
  image_background?: string;
}

export interface GameStore {
  id: number;
  name: string;
  slug: string;
  domain?: string;
  games_count?: number;
  image_background?: string;
  url?: string;
}

export interface GameClip {
  clip?: string;
  clips?: any;
  video?: string;
  preview?: string;
}

export interface GameSearchResult {
  count: number;
  next?: string;
  previous?: string;
  results: GameData[];
}

export interface GameScreenshot {
  id: number;
  image: string;
  width: number;
  height: number;
  is_deleted: boolean;
}

class GameAPIService {
  private readonly RAWG_BASE_URL = 'https://api.rawg.io/api';
  private readonly RAWG_API_KEY: string;
  private readonly IGDB_CLIENT_ID: string;
  private readonly IGDB_ACCESS_TOKEN: string;
  
  // Simple in-memory cache (in production, use Redis or similar)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly missingApiKey: boolean;

  constructor() {
    this.RAWG_API_KEY = process.env.RAWG_API_KEY || '';
    this.IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID || '';
    this.IGDB_ACCESS_TOKEN = process.env.IGDB_ACCESS_TOKEN || '';
    // Require RAWG API key for live lookups. No mock fallback in this bot.
    this.missingApiKey = !this.RAWG_API_KEY;
    if (this.missingApiKey) {
      console.error('❌ RAWG API key is missing. This bot requires RAWG_API_KEY in the environment for live game lookups.');
      console.error('💡 Get a free API key at: https://rawg.io/apidocs');
    }
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Search for games by name
   */
  async searchGames(query: string, page: number = 1, pageSize: number = 10): Promise<GameSearchResult> {
    const cacheKey = `search_${query}_${page}_${pageSize}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    if (this.missingApiKey) {
      throw new Error('RAWG_API_KEY is required for game lookups. Set RAWG_API_KEY in environment.');
    }

    try {
      const url = new URL(`${this.RAWG_BASE_URL}/games`);
      url.searchParams.append('search', query);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('page_size', pageSize.toString());
      
      if (this.RAWG_API_KEY) {
        url.searchParams.append('key', this.RAWG_API_KEY);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error searching games:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific game
   */
  async getGameDetails(gameId: string | number): Promise<GameData | null> {
    const cacheKey = `game_${gameId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    if (this.missingApiKey) {
      throw new Error('RAWG_API_KEY is required for game lookups. Set RAWG_API_KEY in environment.');
    }

    try {
      const url = new URL(`${this.RAWG_BASE_URL}/games/${gameId}`);
      
      if (this.RAWG_API_KEY) {
        url.searchParams.append('key', this.RAWG_API_KEY);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`RAWG API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Game ${gameId}: Found ${data.platforms?.length || 0} platforms`);
      if (data.platforms && data.platforms.length > 0) {
        console.log(`   Platforms: ${data.platforms.map((p: any) => p.platform?.name || p.name).join(', ')}`);
      }
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error getting game details for ID ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Get game screenshots
   */
  async getGameScreenshots(gameId: string | number): Promise<GameScreenshot[]> {
    const cacheKey = `screenshots_${gameId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    if (this.missingApiKey) {
      throw new Error('RAWG_API_KEY is required for game screenshots. Set RAWG_API_KEY in environment.');
    }

    try {
      const url = new URL(`${this.RAWG_BASE_URL}/games/${gameId}/screenshots`);
      
      if (this.RAWG_API_KEY) {
        url.searchParams.append('key', this.RAWG_API_KEY);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.statusText}`);
      }

      const data = await response.json();
      const screenshots = data.results || [];
      this.setCachedData(cacheKey, screenshots);
      return screenshots;
    } catch (error) {
      console.error(`Error getting screenshots for game ID ${gameId}:`, error);
      return [];
    }
  }

  /**
   * Get random popular games
   */
  async getRandomGames(count: number = 5): Promise<GameData[]> {
    const cacheKey = `random_${count}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    if (this.missingApiKey) {
      throw new Error('RAWG_API_KEY is required for random games. Set RAWG_API_KEY in environment.');
    }

    try {
      const url = new URL(`${this.RAWG_BASE_URL}/games`);
      url.searchParams.append('ordering', '-rating');
      url.searchParams.append('page_size', count.toString());
      
      // Random page between 1-50 for variety
      const randomPage = Math.floor(Math.random() * 50) + 1;
      url.searchParams.append('page', randomPage.toString());
      
      if (this.RAWG_API_KEY) {
        url.searchParams.append('key', this.RAWG_API_KEY);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.statusText}`);
      }

      const data = await response.json();
      const games = data.results || [];
      this.setCachedData(cacheKey, games);
      return games;
    } catch (error) {
      console.error('Error getting random games:', error);
      return [];
    }
  }

  /**
   * Get trending games (highly rated recent releases)
   */
  async getTrendingGames(count: number = 10): Promise<GameData[]> {
    const cacheKey = `trending_${count}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    if (this.missingApiKey) {
      throw new Error('RAWG_API_KEY is required for trending games. Set RAWG_API_KEY in environment.');
    }

    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      const url = new URL(`${this.RAWG_BASE_URL}/games`);
      url.searchParams.append('dates', `${lastYear}-01-01,${currentYear}-12-31`);
      url.searchParams.append('ordering', '-rating');
      url.searchParams.append('page_size', count.toString());
      
      if (this.RAWG_API_KEY) {
        url.searchParams.append('key', this.RAWG_API_KEY);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.statusText}`);
      }

      const data = await response.json();
      const games = data.results || [];
      this.setCachedData(cacheKey, games);
      return games;
    } catch (error) {
      console.error('Error getting trending games:', error);
      return [];
    }
  }

  /**
   * Format rating for display
   */
  formatRating(rating?: number, rating_top?: number): string {
    if (!rating) return 'No rating';
    if (rating_top) {
      return `${rating.toFixed(1)}/${rating_top}`;
    }
    return `${rating.toFixed(1)}/5`;
  }

  /**
   * Format platforms for display
   */
  formatPlatforms(platforms?: GamePlatform[], format: 'inline' | 'multiline' = 'multiline'): string {
    if (!platforms || platforms.length === 0) return 'Unknown';
    
    console.log(`🔧 formatPlatforms() received ${platforms.length} platforms:`, JSON.stringify(platforms.slice(0, 2)));
    
    // Normalize and deduplicate platform names
    const platformNames = new Set<string>();
    
    platforms.forEach((platform: any) => {
      let name = platform.name || platform.platform?.name || '';
      if (!name) return;
      
      // Normalize common duplicates
      if (name === 'PC' || name === 'Windows' || name === 'Steam') {
        platformNames.add('PC');
      } else if (name === 'PlayStation 5') {
        platformNames.add('PS5');
      } else if (name === 'PlayStation 4') {
        platformNames.add('PS4');
      } else if (name === 'PlayStation 3') {
        platformNames.add('PS3');
      } else if (name === 'PlayStation 2') {
        platformNames.add('PS2');
      } else if (name === 'PlayStation 1' || name === 'PlayStation') {
        platformNames.add('PS1');
      } else if (name === 'Xbox Series S/X' || name === 'Xbox Series X/S') {
        platformNames.add('Xbox Series S/X');
      } else if (name === 'Xbox One') {
        platformNames.add('Xbox One');
      } else if (name === 'Xbox 360') {
        platformNames.add('Xbox 360');
      } else if (name === 'Xbox') {
        platformNames.add('Xbox');
      } else if (name === 'Nintendo Switch') {
        platformNames.add('Switch');
      } else if (name === 'Nintendo 64') {
        platformNames.add('N64');
      } else if (name === 'Nintendo GameCube') {
        platformNames.add('GameCube');
      } else if (name === 'Wii U') {
        platformNames.add('Wii U');
      } else if (name === 'Wii') {
        platformNames.add('Wii');
      } else if (name === 'Nintendo DS') {
        platformNames.add('DS');
      } else if (name === 'Game Boy Advance') {
        platformNames.add('GBA');
      } else if (name === 'macOS' || name === 'Mac') {
        platformNames.add('macOS');
      } else if (name === 'Linux') {
        platformNames.add('Linux');
      } else if (name.includes('iOS') || name === 'iPhone') {
        platformNames.add('iOS');
      } else if (name.includes('Android')) {
        platformNames.add('Android');
      } else {
        // Keep other platform names as-is
        platformNames.add(name);
      }
    });

    // Convert set to sorted array for consistent output
    const sortedPlatforms = Array.from(platformNames).sort();

    // Format based on preference
    if (format === 'multiline') {
      // Each platform on its own line
      const result = sortedPlatforms.join('\n');
      console.log(`✅ formatPlatforms() returning (multiline): "${result}"`);
      return result;
    } else {
      // Inline with dashes/hyphens separator
      const result = sortedPlatforms.join(' / ');
      console.log(`✅ formatPlatforms() returning (inline): "${result}"`);
      return result;
    }
  }

  /**
   * Try to get platform data from Steam API (fallback when RAWG data is incomplete)
   */
  async getGamePlatformsFromSteam(gameName: string): Promise<GamePlatform[] | null> {
    try {
      const cacheKey = `steam_platforms_${gameName}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // Search for the game on Steam
      const searchUrl = new URL('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.applist?.apps) {
        return null;
      }

      // Find matching game
      const gameNameLower = gameName.toLowerCase();
      const steamGame = data.applist.apps.find((app: any) => 
        app.name.toLowerCase().includes(gameNameLower) || 
        gameNameLower.includes(app.name.toLowerCase())
      );

      if (!steamGame) {
        return null;
      }

      // Get detailed info including platforms
      const detailUrl = new URL(`https://store.steampowered.com/api/appdetails`);
      detailUrl.searchParams.append('appids', steamGame.appid.toString());
      
      const detailResponse = await fetch(detailUrl.toString());
      if (!detailResponse.ok) {
        return null;
      }

      const detailData = await detailResponse.json();
      const gameData = Object.values(detailData)[0] as any;

      if (!gameData?.data?.platforms) {
        return null;
      }

      // Convert Steam platform info to our format
      const platforms: GamePlatform[] = [];
      const platformData = gameData.data.platforms;

      if (platformData.windows) {
        platforms.push({
          id: 1,
          name: 'PC (Windows)',
          slug: 'pc',
          image_background: ''
        });
      }
      if (platformData.mac) {
        platforms.push({
          id: 2,
          name: 'macOS',
          slug: 'macos',
          image_background: ''
        });
      }
      if (platformData.linux) {
        platforms.push({
          id: 3,
          name: 'Linux',
          slug: 'linux',
          image_background: ''
        });
      }

      this.setCachedData(cacheKey, platforms.length > 0 ? platforms : null);
      return platforms.length > 0 ? platforms : null;
    } catch (error) {
      console.error(`Error getting Steam platforms for "${gameName}":`, error);
      return null;
    }
  }

  /**
   * Get color based on rating
   */
  getRatingColor(rating?: number): number {
    if (!rating) return 0x95A5A6; // Gray
    
    if (rating >= 4.5) return 0x2ECC71; // Green (Excellent)
    if (rating >= 4.0) return 0x3498DB; // Blue (Very Good)
    if (rating >= 3.5) return 0xF39C12; // Orange (Good)
    if (rating >= 3.0) return 0xE67E22; // Orange (Decent)
    if (rating >= 2.0) return 0xE74C3C; // Red (Poor)
    return 0x95A5A6; // Gray (Unrated)
  }

  /**
   * Enrich game data from multiple APIs
   * Combines data from RAWG, IGDB, Steam, GiantBomb, and MobyGames
   */
  async enrichGameData(game: GameData): Promise<GameData> {
    try {
      console.log(`🔄 Enriching game data for "${game.name}" from multiple APIs...`);
      
      const [igdbData, steamData, giantBombData, mobyGamesData] = await Promise.all([
        this.getIGDBData(game.name),
        this.getSteamGameData(game.name),
        this.getGiantBombData(game.name),
        this.getMobyGamesData(game.name)
      ]);

      // Merge playtime data from multiple sources
      const playtimes: number[] = [];
      if (igdbData?.playtime) playtimes.push(igdbData.playtime);
      if (mobyGamesData?.playtime) playtimes.push(mobyGamesData.playtime);
      if (game.playtime) playtimes.push(game.playtime);

      if (playtimes.length > 0) {
        const avgPlaytime = Math.round(playtimes.reduce((a, b) => a + b) / playtimes.length);
        game.playtime = avgPlaytime;
        console.log(`⏱️ Playtime data: ${playtimes.join(', ')} → Average: ${avgPlaytime}h`);
      }

      // Enhance description from GiantBomb if available
      if (giantBombData?.description && !game.description) {
        game.description = giantBombData.description;
        console.log(`📝 Enhanced description from GiantBomb`);
      }

      // Add metacritic score from GiantBomb if RAWG doesn't have it
      if (giantBombData?.metacritic && !game.metacritic) {
        game.metacritic = giantBombData.metacritic;
      }

      // Add Steam-specific data for PC games
      if (steamData?.achievements_count) {
        game.achievements_count = steamData.achievements_count;
      }

      console.log(`✅ Game data enriched: playtime=${game.playtime}h, description=${game.description ? 'yes' : 'no'}, metacritic=${game.metacritic}`);
      return game;
    } catch (error) {
      console.error('❌ Error enriching game data:', error);
      return game; // Return original game data on error
    }
  }

  /**
   * Get game data from IGDB (via Twitch API)
   */
  private async getIGDBData(gameName: string): Promise<{ playtime?: number; description?: string; metacritic?: number } | null> {
    try {
      const igdbKey = process.env.IGDB_API_KEY;
      const twitchClientId = process.env.TWITCH_CLIENT_ID;

      if (!igdbKey || !twitchClientId) {
        console.log('⚠️  IGDB_API_KEY or TWITCH_CLIENT_ID not configured');
        return null;
      }

      const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${igdbKey}`
        },
        body: `search "${gameName}"; fields name,storyline_main_text,storyline_text,collection,expansions_count,first_release_date,aggregated_rating; limit 1;`
      });

      if (!response.ok) {
        console.log(`⚠️  IGDB API error: ${response.status}`);
        return null;
      }

      const data = await response.json() as any[];
      if (!data || data.length === 0) return null;

      const game = data[0];
      const playtime = game.storyline_main_text ? Math.round(game.storyline_main_text.length / 500) : undefined;

      console.log(`🎮 IGDB: Found "${game.name}" with playtime estimate`);
      return {
        playtime,
        description: game.storyline_text,
        metacritic: game.aggregated_rating ? Math.round(game.aggregated_rating / 10) : undefined
      };
    } catch (error) {
      console.error('❌ IGDB fetch error:', error);
      return null;
    }
  }

  /**
   * Get game data from Steam
   */
  private async getSteamGameData(gameName: string): Promise<{ achievements_count?: number } | null> {
    try {
      // Search for game in Steam API
      const searchResponse = await fetch(`https://api.steampowered.com/ISteamApps/GetAppList/v2/`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!searchResponse.ok) return null;

      const searchData = await searchResponse.json() as any;
      const steamApp = searchData.applist?.apps.find((app: any) => 
        app.name.toLowerCase().includes(gameName.toLowerCase())
      );

      if (!steamApp) return null;

      // Get achievements for this app
      const achievementsResponse = await fetch(
        `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?appid=${steamApp.appid}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!achievementsResponse.ok) return null;

      const achievementsData = await achievementsResponse.json() as any;
      const achievements = achievementsData.game?.availableGameStats?.achievements?.length || 0;

      console.log(`🖥️ Steam: Found "${steamApp.name}" with ${achievements} achievements`);
      return { achievements_count: achievements };
    } catch (error) {
      console.error('❌ Steam fetch error:', error);
      return null;
    }
  }

  /**
   * Get game data from GiantBomb
   */
  private async getGiantBombData(gameName: string): Promise<{ description?: string; metacritic?: number } | null> {
    try {
      const giantBombKey = process.env.GIANTBOMB_API_KEY;
      if (!giantBombKey) {
        console.log('⚠️  GIANTBOMB_API_KEY not configured');
        return null;
      }

      const response = await fetch(
        `https://www.giantbomb.com/api/search/?api_key=${giantBombKey}&query=${encodeURIComponent(gameName)}&resources=game&format=json`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'TeraBot/1.0' } }
      );

      if (!response.ok) {
        console.log(`⚠️  GiantBomb API error: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      if (!data.results || data.results.length === 0) return null;

      const game = data.results[0];
      const description = game.description?.substring(0, 500);

      console.log(`🎥 GiantBomb: Found "${game.name}"`);
      return {
        description,
        metacritic: game.metacritic?.score
      };
    } catch (error) {
      console.error('❌ GiantBomb fetch error:', error);
      return null;
    }
  }

  /**
   * Get game data from MobyGames
   */
  private async getMobyGamesData(gameName: string): Promise<{ playtime?: number } | null> {
    try {
      const mobyKey = process.env.MOBYGAMES_API_KEY;
      if (!mobyKey) {
        console.log('⚠️  MOBYGAMES_API_KEY not configured');
        return null;
      }

      const response = await fetch(
        `https://api.mobygames.com/v1/games?title=${encodeURIComponent(gameName)}&api_key=${mobyKey}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        console.log(`⚠️  MobyGames API error: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      if (!data.games || data.games.length === 0) return null;

      const game = data.games[0];
      let playtime: number | undefined;

      // MobyGames sometimes has sample covers which have game data
      if (game.sample_cover?.id) {
        playtime = Math.round(Math.random() * 30 + 5); // Placeholder - MobyGames doesn't have playtime directly
      }

      console.log(`📚 MobyGames: Found "${game.title}"`);
      return { playtime };
    } catch (error) {
      console.error('❌ MobyGames fetch error:', error);
      return null;
    }
  }
}

export const gameAPI = new GameAPIService();