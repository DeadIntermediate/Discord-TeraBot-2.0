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

import { error as logError, warn } from './logger';

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
      logError('❌ RAWG API key is missing. This bot requires RAWG_API_KEY in the environment for live game lookups.');
      logError('💡 Get a free API key at: https://rawg.io/apidocs');
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
      logError('Error searching games:', error);
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
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      logError(`Error getting game details for ID ${gameId}:`, error);
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
      logError(`Error getting screenshots for game ID ${gameId}:`, error);
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
      logError('Error getting random games:', error);
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
      logError('Error getting trending games:', error);
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
    if (!platforms || platforms.length === 0) return 'Unknown';
    
    // Group by parent platform type
    const platformGroups: { [key: string]: string[] } = {};
    
    platforms.forEach(platform => {
      const name = platform.name;
      
      // Categorize platforms
      if (name.includes('PlayStation') || name.includes('PS')) {
        platformGroups['PlayStation'] = platformGroups['PlayStation'] || [];
        platformGroups['PlayStation'].push(name);
      } else if (name.includes('Xbox')) {
        platformGroups['Xbox'] = platformGroups['Xbox'] || [];
        platformGroups['Xbox'].push(name);
      } else if (name.includes('Nintendo') || name.includes('Switch') || name.includes('Wii')) {
        platformGroups['Nintendo'] = platformGroups['Nintendo'] || [];
        platformGroups['Nintendo'].push(name);
      } else if (name.includes('PC') || name.includes('Windows') || name.includes('Steam')) {
        platformGroups['PC'] = platformGroups['PC'] || [];
        platformGroups['PC'].push(name);
      } else if (name.includes('Mobile') || name.includes('iOS') || name.includes('Android')) {
        platformGroups['Mobile'] = platformGroups['Mobile'] || [];
        platformGroups['Mobile'].push(name);
      } else {
        platformGroups['Other'] = platformGroups['Other'] || [];
        platformGroups['Other'].push(name);
      }
    });

    // Format output
    const formatted = Object.keys(platformGroups).map(group => {
      const platforms = platformGroups[group];
      if (platforms.length === 1) {
        return platforms[0];
      } else {
        return `${group} (${platforms.length})`;
      }
    });

    return formatted.join(', ');
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