// Missing Twitch API implementation
import axios from 'axios';

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
      console.warn('⚠️ Twitch API credentials not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<TwitchOAuthResponse>(
        'https://id.twitch.tv/oauth2/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Twitch access token:', error);
      throw error;
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
      
      const response = await axios.get<TwitchStreamResponse>(
        `https://api.twitch.tv/helix/streams?user_login=${username}`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.data.data.length === 0) {
        return { isLive: false };
      }

      const stream = response.data.data[0];
      return {
        isLive: true,
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080')
      };
    } catch (error) {
      console.error(`Error checking Twitch stream for ${username}:`, error);
      return { isLive: false };
    }
  }
}