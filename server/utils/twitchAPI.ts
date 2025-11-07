// Twitch API implementation using global fetch to avoid adding axios as a dependency.

// Note: Node 18+ provides global `fetch`. If running on older Node versions,
// ensure a global fetch polyfill is available.

import { warn, error } from './logger';

interface TwitchOAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TwitchStreamResponse {
  data: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id: string;
    game_name: string;
    type: string;
    title: string;
    viewer_count: number;
    started_at: string;
    language: string;
    thumbnail_url: string;
    tag_ids: string[];
    is_mature: boolean;
  }>;
}

export class TwitchAPI {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
    
    if (!this.clientId || !this.clientSecret) {
      warn('⚠️ Twitch API credentials not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        throw new Error(`Twitch token request failed: ${tokenResp.status} ${text}`);
      }

      const data = (await tokenResp.json()) as TwitchOAuthResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

      return this.accessToken;
    } catch (err) {
      error('Failed to get Twitch access token:', err);
      throw err;
    }
  }

  async getStreamData(username: string): Promise<{
    isLive: boolean;
    title?: string;
    game?: string;
    viewers?: number;
    thumbnailUrl?: string;
  }> {
    if (!this.clientId || !this.clientSecret) {
      return { isLive: false };
    }

    try {
      const accessToken = await this.getAccessToken();
      
      const streamResp = await fetch(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!streamResp.ok) {
        const text = await streamResp.text();
        throw new Error(`Twitch streams request failed: ${streamResp.status} ${text}`);
      }

      const streamData = (await streamResp.json()) as TwitchStreamResponse;
      if (!streamData.data || streamData.data.length === 0) {
        return { isLive: false };
      }

      const stream = streamData.data[0];
      return {
        isLive: true,
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080')
      };
    } catch (err) {
      error(`Error checking Twitch stream for ${username}:`, err);
      return { isLive: false };
    }
  }
}