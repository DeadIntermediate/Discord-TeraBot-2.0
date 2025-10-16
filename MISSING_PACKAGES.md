# Missing Packages Installation Guide

## Core Missing Packages

Install these packages that are typically needed for a Discord bot with streaming features:

```bash
# HTTP Client for API calls (Python equivalent: aiohttp, requests)
npm install axios

# Better scheduling (Python equivalent: APScheduler)
npm install node-cron

# Rate limiting (Python equivalent: aioredis rate limiting)
npm install bottleneck

# Caching (Python equivalent: cachetools)
npm install node-cache

# Environment management (Python equivalent: python-dotenv)
npm install dotenv

# Development dependencies
npm install --save-dev @types/node-cron @types/node-cache
```

## Additional Useful Packages

```bash
# Logging library (Python equivalent: loguru)
npm install winston

# Date/time utilities (Python equivalent: arrow, pendulum)
npm install moment

# Retry logic (Python equivalent: tenacity)
npm install async-retry

# Image processing for stream thumbnails (Python equivalent: Pillow)
npm install sharp

# Type definitions
npm install --save-dev @types/sharp
```

## Environment Variables to Add

Add these to your `.env` file:

```env
# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# Rate limiting settings
STREAM_CHECK_INTERVAL=300000  # 5 minutes in milliseconds
API_RATE_LIMIT=30             # Requests per minute

# Logging level
LOG_LEVEL=info
```

## Functionality Gaps vs Python Version

### 1. **Stream API Integration**
- ❌ **Missing**: Full Twitch API implementation
- ❌ **Missing**: Full YouTube API implementation  
- ✅ **Present**: Kick API (working)

### 2. **Rate Limiting & Caching**
- ❌ **Missing**: API rate limiting
- ❌ **Missing**: Response caching
- ❌ **Missing**: Request retries

### 3. **Scheduling & Background Tasks**
- ⚠️ **Basic**: Simple setInterval() (should be upgraded)
- ❌ **Missing**: Robust error recovery
- ❌ **Missing**: Task persistence

### 4. **Logging & Monitoring**
- ⚠️ **Basic**: Console.log only
- ❌ **Missing**: Structured logging
- ❌ **Missing**: Log levels
- ❌ **Missing**: Log rotation

### 5. **Error Handling**
- ⚠️ **Basic**: Try/catch blocks
- ❌ **Missing**: Retry logic
- ❌ **Missing**: Circuit breakers
- ❌ **Missing**: Graceful degradation

## Priority Installation Order

1. **Immediate (Critical)**:
   ```bash
   npm install axios dotenv
   ```

2. **High Priority**:
   ```bash
   npm install node-cron bottleneck node-cache
   ```

3. **Nice to Have**:
   ```bash
   npm install winston async-retry moment sharp
   ```

## Installation Commands

Run this single command to install all missing packages:

```bash
npm install axios node-cron bottleneck node-cache dotenv winston async-retry moment sharp && npm install --save-dev @types/node-cron @types/node-cache @types/sharp
```