// Missing YouTube API implementation
import { error, warn } from './logger';

export class YouTubeAPI {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    
    if (!this.apiKey) {
      warn('⚠️ YouTube API key not configured');
    }
  }

  async getStreamData(channelId: string): Promise<{
    isLive: boolean;
    title?: string;
    viewers?: number;
    thumbnailUrl?: string;
  }> {
    if (!this.apiKey) {
      return { isLive: false };
    }

    try {
      // First, search for live streams from the channel
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&eventType=live&type=video&key=${this.apiKey}`
      );

      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();

      if (searchData.items.length === 0) {
        return { isLive: false };
      }

      const liveVideo = searchData.items[0];

      // Get video statistics for viewer count
      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=liveStreamingDetails,statistics&id=${liveVideo.id.videoId}&key=${this.apiKey}`
      );

      if (!videoResponse.ok) {
        throw new Error(`YouTube API error: ${videoResponse.statusText}`);
      }

      const videoData = await videoResponse.json();
      const video = videoData.items[0];

      return {
        isLive: true,
        title: liveVideo.snippet.title,
        viewers: video.liveStreamingDetails?.concurrentViewers ? 
          parseInt(video.liveStreamingDetails.concurrentViewers) : undefined,
        thumbnailUrl: liveVideo.snippet.thumbnails?.high?.url
      };
    } catch (err) {
      error(`Error checking YouTube stream for channel ${channelId}:`, err);
      return { isLive: false };
    }
  }

  // Helper method to get channel ID from username
  async getChannelId(username: string): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?` +
        `part=id&forUsername=${username}&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items[0]?.id || null;
    } catch (err) {
      error(`Error getting YouTube channel ID for ${username}:`, err);
      return null;
    }
  }
}