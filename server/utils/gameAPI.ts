import { error as logError } from './logger';

export interface GameData {
  id: string | number;
  name: string;
  slug: string;
  description?: string;
  synopsis?: string;
  released?: string;
  rating?: number;
  rating_top?: number;
  metacritic?: number;
  metacritic_url?: string;
  platforms?: GamePlatform[];
  genres?: { name: string }[];
  developers?: { name: string }[];
  publishers?: { name: string }[];
  esrb_rating?: string | { name: string };
  tags?: { name: string }[];
  background_image?: string;
  website?: string;
  playtime?: number;
  stores?: GameStore[];
}

export interface GamePlatform {
  id: number;
  name: string;
  slug: string;
}

export interface GameStore {
  id: number;
  name: string;
  slug: string;
  url?: string;
}

export interface GameSearchResult {
  count: number;
  results: GameData[];
}

export interface GameScreenshot {
  id: number;
  image: string;
  width: number;
  height: number;
  is_deleted: boolean;
}

export interface SearchFilters {
  genre?: string;
  parentPlatform?: number;
}

class GameAPIService {
  private readonly BASE = 'https://api.rawg.io/api';
  private readonly key: string;
  private readonly cache = new Map<string, { data: any; ts: number }>();
  private readonly TTL = 3_600_000;      // 1 hour
  private readonly AC_TTL = 300_000;     // 5 min for autocomplete
  readonly missingApiKey: boolean;

  constructor() {
    this.key = process.env.RAWG_API_KEY || '';
    this.missingApiKey = !this.key;
    if (this.missingApiKey) {
      logError('RAWG_API_KEY not set — /game commands will not work. Get a free key at rawg.io/apidocs');
    }
  }

  private get<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.ts < this.TTL) return hit.data as T;
    return null;
  }

  private set(key: string, data: any, ttl = this.TTL) {
    this.cache.set(key, { data, ts: Date.now() - (this.TTL - ttl) });
  }

  private url(path: string, params: Record<string, string> = {}): string {
    const u = new URL(`${this.BASE}${path}`);
    u.searchParams.set('key', this.key);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  }

  private requireKey() {
    if (this.missingApiKey) throw new Error('RAWG_API_KEY is required. Add it to .env — get one free at rawg.io/apidocs');
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async searchGames(
    query: string,
    page = 1,
    pageSize = 10,
    filters: SearchFilters = {},
  ): Promise<GameSearchResult> {
    this.requireKey();
    const cacheKey = `search_${query}_${page}_${pageSize}_${filters.genre || ''}_${filters.parentPlatform || ''}`;
    const cached = this.get<GameSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string> = {
        search: query,
        page: String(page),
        page_size: String(pageSize),
      };
      if (filters.genre) params.genres = filters.genre;
      if (filters.parentPlatform) params.parent_platforms = String(filters.parentPlatform);

      const res = await fetch(this.url('/games', params));
      if (!res.ok) throw new Error(`RAWG ${res.status}: ${res.statusText}`);
      const data = await res.json();
      this.set(cacheKey, data);
      return data;
    } catch (err) {
      logError('Error searching games:', err);
      throw err;
    }
  }

  async searchAutocomplete(query: string): Promise<{ id: number; name: string }[]> {
    if (!this.key || query.length < 2) return [];
    const cacheKey = `ac_${query.toLowerCase()}`;
    const cached = this.get<{ id: number; name: string }[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(this.url('/games', { search: query, page_size: '10' }));
      if (!res.ok) return [];
      const data = await res.json();
      const results = (data.results || []).map((g: any) => ({ id: g.id, name: g.name }));
      this.set(cacheKey, results, this.AC_TTL);
      return results;
    } catch {
      return [];
    }
  }

  // ── Single game ───────────────────────────────────────────────────────────

  async getGameDetails(gameId: string | number): Promise<GameData | null> {
    this.requireKey();
    const cacheKey = `game_${gameId}`;
    const cached = this.get<GameData>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(this.url(`/games/${gameId}`));
      if (!res.ok) { if (res.status === 404) return null; throw new Error(`RAWG ${res.status}`); }
      const data = await res.json();
      this.set(cacheKey, data);
      return data;
    } catch (err) {
      logError(`Error getting game ${gameId}:`, err);
      return null;
    }
  }

  async getGameScreenshots(gameId: string | number): Promise<GameScreenshot[]> {
    this.requireKey();
    const cacheKey = `ss_${gameId}`;
    const cached = this.get<GameScreenshot[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(this.url(`/games/${gameId}/screenshots`));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      const screenshots = data.results || [];
      this.set(cacheKey, screenshots);
      return screenshots;
    } catch (err) {
      logError(`Error getting screenshots for ${gameId}:`, err);
      return [];
    }
  }

  // ── Collections ───────────────────────────────────────────────────────────

  async getTopGames(
    count = 10,
    options: { genre?: string; parentPlatform?: number; year?: number; ordering?: string } = {},
  ): Promise<GameData[]> {
    this.requireKey();
    const { genre, parentPlatform, year, ordering = '-metacritic' } = options;
    const cacheKey = `top_${count}_${genre || ''}_${parentPlatform || ''}_${year || ''}_${ordering}`;
    const cached = this.get<GameData[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string> = { ordering, page_size: String(count) };
      if (genre) params.genres = genre;
      if (parentPlatform) params.parent_platforms = String(parentPlatform);
      if (year) params.dates = `${year}-01-01,${year}-12-31`;

      const res = await fetch(this.url('/games', params));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      this.set(cacheKey, data.results || []);
      return data.results || [];
    } catch (err) {
      logError('Error getting top games:', err);
      return [];
    }
  }

  async getTrendingGames(count = 10, genre?: string): Promise<GameData[]> {
    this.requireKey();
    const cacheKey = `trending_${count}_${genre || ''}`;
    const cached = this.get<GameData[]>(cacheKey);
    if (cached) return cached;

    try {
      const year = new Date().getFullYear();
      const params: Record<string, string> = {
        dates: `${year - 1}-01-01,${year}-12-31`,
        ordering: '-rating',
        page_size: String(count),
      };
      if (genre) params.genres = genre;

      const res = await fetch(this.url('/games', params));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      this.set(cacheKey, data.results || []);
      return data.results || [];
    } catch (err) {
      logError('Error getting trending games:', err);
      return [];
    }
  }

  async getNewReleases(count = 10): Promise<GameData[]> {
    this.requireKey();
    const cacheKey = `new_${count}`;
    const cached = this.get<GameData[]>(cacheKey);
    if (cached) return cached;

    try {
      const today = new Date().toISOString().split('T')[0];
      const ago = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      const res = await fetch(this.url('/games', {
        dates: `${ago},${today}`,
        ordering: '-added',
        page_size: String(count),
      }));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      this.set(cacheKey, data.results || []);
      return data.results || [];
    } catch (err) {
      logError('Error getting new releases:', err);
      return [];
    }
  }

  async getRandomGames(count = 5): Promise<GameData[]> {
    this.requireKey();
    // Don't cache random results
    try {
      const page = Math.floor(Math.random() * 50) + 1;
      const res = await fetch(this.url('/games', {
        ordering: '-rating',
        page_size: String(count),
        page: String(page),
      }));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      logError('Error getting random games:', err);
      return [];
    }
  }

  async getSuggestedGames(gameId: string | number, count = 6): Promise<GameData[]> {
    this.requireKey();
    const cacheKey = `suggested_${gameId}`;
    const cached = this.get<GameData[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(this.url(`/games/${gameId}/suggested`, { page_size: String(count) }));
      if (!res.ok) throw new Error(`RAWG ${res.status}`);
      const data = await res.json();
      this.set(cacheKey, data.results || []);
      return data.results || [];
    } catch (err) {
      logError(`Error getting suggested games for ${gameId}:`, err);
      return [];
    }
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  formatRating(rating?: number, rating_top?: number): string {
    if (!rating) return 'No rating';
    return `${rating.toFixed(1)}/${rating_top || 5}`;
  }

  formatPlatforms(platforms?: GamePlatform[]): string {
    if (!platforms?.length) return 'Unknown';
    const groups: Record<string, string[]> = {};
    for (const p of platforms) {
      const n = p.name;
      const key =
        n.includes('PlayStation') || n.includes('PS') ? 'PlayStation' :
        n.includes('Xbox') ? 'Xbox' :
        n.includes('Nintendo') || n.includes('Switch') || n.includes('Wii') ? 'Nintendo' :
        n.includes('PC') || n.includes('Windows') ? 'PC' :
        n.includes('iOS') || n.includes('Android') || n.includes('Mobile') ? 'Mobile' :
        n.includes('macOS') || n.includes('Mac') ? 'macOS' :
        n.includes('Linux') ? 'Linux' : 'Other';
      (groups[key] ??= []).push(n);
    }
    return Object.entries(groups)
      .map(([g, ps]) => ps.length === 1 ? ps[0] : `${g} (${ps.length})`)
      .join(', ');
  }

  formatPlatformsWithEmojis(platforms?: GamePlatform[]): string {
    if (!platforms?.length) return '❓ Unknown';
    const EMOJI: Record<string, string> = {
      PlayStation: '🎮', Xbox: '🎮', Nintendo: '🎮',
      PC: '🖥️', macOS: '🍎', Linux: '🐧',
      Mobile: '📱', Other: '🕹️',
    };
    const groups: Record<string, number> = {};
    for (const p of platforms) {
      const n = p.name;
      const key =
        n.includes('PlayStation') || n.includes('PS') ? 'PlayStation' :
        n.includes('Xbox') ? 'Xbox' :
        n.includes('Nintendo') || n.includes('Switch') || n.includes('Wii') ? 'Nintendo' :
        n.includes('PC') || n.includes('Windows') ? 'PC' :
        n.includes('iOS') || n.includes('Android') || n.includes('Mobile') ? 'Mobile' :
        n.includes('macOS') || n.includes('Mac') ? 'macOS' :
        n.includes('Linux') ? 'Linux' : 'Other';
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups)
      .map(([g, count]) => `${EMOJI[g] || '🕹️'} ${g}${count > 1 ? ` (${count})` : ''}`)
      .join('\n');
  }

  formatESRB(esrb?: string | { name: string }): string {
    const rating = typeof esrb === 'string' ? esrb : esrb?.name;
    if (!rating) return 'Not rated';
    const map: Record<string, string> = {
      'Everyone': '🟢 E — Everyone',
      'Everyone 10+': '🟡 E10+ — Everyone 10+',
      'Teen': '🟡 T — Teen',
      'Mature': '🔴 M — Mature 17+',
      'Adults Only': '🔴 AO — Adults Only 18+',
      'Rating Pending': '⚪ RP — Pending',
    };
    return map[rating] || rating;
  }

  getRatingColor(rating?: number): number {
    if (!rating) return 0x95A5A6;
    if (rating >= 4.5) return 0x2ECC71;
    if (rating >= 4.0) return 0x3498DB;
    if (rating >= 3.5) return 0xF39C12;
    if (rating >= 3.0) return 0xE67E22;
    return 0xE74C3C;
  }
}

export const gameAPI = new GameAPIService();
