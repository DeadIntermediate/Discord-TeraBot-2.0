# Social Media Integration Feature

## Overview

The Tera Bot now has integrated social media support to pull posts from BlueSky, X (Twitter), and Instagram accounts directly into Discord!

## Features

### 📱 Supported Platforms

1. **BlueSky** 🦋
   - No API key required
   - Pull posts from any public BlueSky account
   - Automatically handles BlueSky handles with domains (e.g., `user.bsky.social`)

2. **X (Twitter)** 𝕏
   - Requires API access
   - Real-time tweet fetching
   - Engagement metrics (likes, retweets, replies)
   - Media support (images, videos)

3. **Instagram** 📸
   - Requires business account setup
   - Meta Graph API integration
   - Note: Currently requires manual API token configuration

## Commands

### `/socials bluesky`
Get recent posts from a BlueSky account

**Options:**
- `handle` (required): BlueSky handle (e.g., `user.bsky.social` or `@handle`)
- `limit` (optional): Number of posts to fetch (1-10, default: 5)

**Example:**
```
/socials bluesky handle:jack.bsky.social limit:5
```

### `/socials x`
Get recent posts from an X (Twitter) account

**Options:**
- `username` (required): X username (e.g., `@jack` or `jack`)
- `limit` (optional): Number of posts to fetch (1-10, default: 5)

**Example:**
```
/socials x username:@jack limit:5
```

**Requirements:**
- Set `X_API_KEY` in `.env` with your X API bearer token

### `/socials instagram`
Get recent posts from an Instagram account

**Options:**
- `username` (required): Instagram username
- `limit` (optional): Number of posts to fetch (1-10, default: 5)

**Example:**
```
/socials instagram username:instagram limit:5
```

**Requirements:**
- Set `INSTAGRAM_API_TOKEN` in `.env` with your Meta Graph API token
- Instagram business account required

## Setup Instructions

### BlueSky Setup
✅ **No setup required!** BlueSky posts are publicly accessible via their XRPC API.

### X (Twitter) Setup

1. Go to https://developer.twitter.com
2. Create a new app or use an existing one
3. Generate an API key with bearer token access
4. Add to `.env`:
   ```
   X_API_KEY=your_bearer_token_here
   ```

### Instagram Setup

1. Create a Meta/Facebook Developer account
2. Create an Instagram Business Account (if you don't have one)
3. Create an app with Instagram Graph API access
4. Generate a long-lived access token
5. Add to `.env`:
   ```
   INSTAGRAM_API_TOKEN=your_access_token_here
   ```

**Note:** Instagram API requires a business account and has stricter API limits

## Features

### Post Display
- **Single Post**: Shows full post details with engagement metrics
- **Multiple Posts**: Interactive dropdown menu to select and view individual posts
- **Media Support**: Displays images/videos from posts (where available)
- **Engagement Stats**: 
  - ❤️ Likes/Favorites
  - 🔄 Retweets/Reposts
  - 💬 Reply count
- **Author Info**: Display name, handle, and avatar
- **Timestamps**: Human-readable time differences (e.g., "2h ago")
- **Direct Links**: Click post title to open on original platform

### UI/UX
- Platform-specific colors:
  - BlueSky: Blue (#1185FE)
  - X: Black (#000000)
  - Instagram: Pink (#E1306C)
- Emoji indicators for each platform
- Clean, organized embed formatting
- Interactive selection for browsing multiple posts

## Data Structure

### SocialPost Interface
```typescript
interface SocialPost {
  id: string;
  author: string;
  authorHandle: string;
  authorAvatar?: string;
  content: string;
  timestamp: Date;
  likes: number;
  reposts?: number;
  replies?: number;
  url: string;
  platform: 'bluesky' | 'instagram' | 'x';
  media?: {
    type: 'image' | 'video' | 'gif';
    url: string;
  }[];
}
```

## API Limits

- **BlueSky**: 100 requests per 5 minutes (per IP)
- **X**: Varies by endpoint (standard: 450 requests per 15 minutes)
- **Instagram**: 200 requests per hour per token

## Error Handling

The bot provides clear error messages for:
- ❌ Account not found
- ❌ API key not configured
- ❌ API rate limits exceeded
- ❌ Account privacy settings blocking access
- ❌ Network errors

## Future Enhancements

Potential improvements for future versions:
- TikTok integration
- YouTube Shorts support
- Scheduled social media feed updates
- Discord channel cross-posting
- Post scheduling to social media
- Analytics dashboard
- Multi-account monitoring

## Troubleshooting

### "No posts found"
- Verify the username/handle is correct
- Check if the account is public
- Ensure you're using the correct platform-specific format

### "API integration is not configured"
- Check your `.env` file has the required API keys
- Verify tokens are valid and not expired
- Check bot logs for specific error messages

### Rate limit errors
- Wait before making another request
- Consider caching recent posts
- X API has tier-based limits depending on your developer account level

## Code Location

- **Command**: `/server/bot/commands/socialmedia.ts`
- **API Utility**: `/server/utils/socialMediaAPI.ts`
- **Command Index**: `/server/bot/commands/index.ts`

## Testing

To test the feature:

1. Make sure the bot is running: `npm run dev`
2. Try fetching BlueSky posts (no API key required):
   ```
   /socials bluesky handle:jack.bsky.social
   ```
3. For X/Instagram, configure API keys first, then test

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive tokens
- Rotate API tokens periodically
- Monitor API usage to detect abuse
- Consider rate limiting per-user in Discord

