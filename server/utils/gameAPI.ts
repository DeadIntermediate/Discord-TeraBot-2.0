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
  formatPlatforms(platforms?: GamePlatform[]): string {
    if (!platforms || platforms.length === 0) return '❓ Unknown';
    
    console.log(`🔧 formatPlatforms() received ${platforms.length} platforms:`, JSON.stringify(platforms.slice(0, 2)));
    
    // First pass: normalize and deduplicate platform names
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

    // Second pass: group by category and assign emojis
    const platformGroups: { [key: string]: { emoji: string; names: string[] } } = {
      'PC': { emoji: '💻', names: [] },
      'PlayStation': { emoji: '🎮', names: [] },
      'Xbox': { emoji: '🎮', names: [] },
      'Nintendo': { emoji: '🎮', names: [] },
      'Mobile': { emoji: '📱', names: [] },
      'Retro': { emoji: '👾', names: [] },
    };

    platformNames.forEach(name => {
      if (name === 'PC' || name === 'macOS' || name === 'Linux') {
        platformGroups['PC'].names.push(name);
      } else if (name.startsWith('PS') || name.includes('PlayStation')) {
        platformGroups['PlayStation'].names.push(name);
      } else if (name.startsWith('Xbox') || name === 'Xbox') {
        platformGroups['Xbox'].names.push(name);
      } else if (name.includes('Switch') || name.startsWith('Nintendo') || name === 'Wii' || name === 'Wii U' || name === 'GameCube' || name === 'N64' || name === 'DS' || name === 'GBA') {
        platformGroups['Nintendo'].names.push(name);
      } else if (name === 'iOS' || name === 'Android') {
        platformGroups['Mobile'].names.push(name);
      } else {
        // Retro/other platforms
        platformGroups['Retro'].names.push(name);
      }
    });

    // Format output with emojis
    const formatted = Object.entries(platformGroups)
      .filter(([_, group]) => group.names.length > 0)
      .map(([type, group]) => {
        const emoji = group.emoji;
        const names = group.names;
        
        // If only one platform in this group, show just the emoji + name
        if (names.length === 1) {
          return `${emoji} ${names[0]}`;
        } else {
          // Multiple platforms, group them
          return `${emoji} ${names.join(', ')}`;
        }
      });

    const result = formatted.join(' • ') || '❓ Unknown';
    console.log(`✅ formatPlatforms() returning: "${result}"`);
    return result;
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
}

export const gameAPI = new GameAPIService();