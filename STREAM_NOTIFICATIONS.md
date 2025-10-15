# Stream Notification System

## Overview

The Stream Notification System allows TeraBot 2.0 to automatically detect when streamers go live on **Twitch**, **YouTube**, or **Kick** and send notifications to a designated channel.

## Features

### ✨ Key Features

- **Automatic Detection**: `/stream addme` automatically detects your connected streaming platforms from Discord
- **Multi-Platform Support**: Twitch, YouTube, and Kick
- **Auto Monitoring**: Checks streams every 5 minutes for live status
- **Rich Embeds**: Beautiful notification embeds with stream info, thumbnails, and viewer count
- **Role Pinging**: Optional role mentions when streamers go live
- **User-Friendly**: Members can add their own streams without admin help

### 🎯 Commands

#### `/stream addme`
Automatically adds your connected streaming accounts to notifications.

**How it works:**
1. Discord checks your profile for connected Twitch, YouTube, or Kick accounts
2. Bot extracts your usernames from these connections
3. Adds all found platforms to the notification system

**Requirements:**
- You must have streaming platforms connected in Discord Settings → Connections
- Connections must be set to "Display on profile"

**Example Output:**
```
✅ Stream Notifications Updated
Your streaming accounts have been added to notifications in #streams!

✅ Added
twitch: YourTwitchName
kick: YourKickName

ℹ️ Already Tracking
youtube: YourYouTubeName (already added)
```

---

#### `/stream add`
Manually add any streamer to notifications.

**Parameters:**
- `platform`: Choose from Twitch, YouTube, or Kick
- `username`: The streamer's username on that platform

**Permissions Required:** Manage Server

**Example:**
```
/stream add platform:twitch username:shroud
```

---

#### `/stream remove`
Remove a streamer from notifications.

**Parameters:**
- `platform`: Choose from Twitch, YouTube, or Kick
- `username`: The streamer's username to remove

**Permissions Required:** Manage Server

**Example:**
```
/stream remove platform:twitch username:shroud
```

---

#### `/stream list`
View all currently tracked streamers.

Shows:
- Platform (Twitch, YouTube, Kick)
- Username
- Current status (🔴 LIVE or ⚫ Offline)
- Who added them (if added via `/stream addme`)

**Example Output:**
```
📺 Tracked Streamers
Currently tracking 5 streamer(s) in this server.

Twitch (3)
🔴 LIVE shroud @User123
⚫ Offline pokimane @User456
⚫ Offline xqc

YouTube (1)
⚫ Offline MrBeast @User789

Kick (1)
🔴 LIVE AdinRoss
```

---

#### `/stream setup`
Configure the channel where stream notifications will be sent.

**Parameters:**
- `channel`: Text channel for notifications

**Permissions Required:** Manage Server

**Example:**
```
/stream setup channel:#streams
```

---

## Setup Guide

### For Server Administrators

#### Step 1: Set Up Notification Channel
```
/stream setup channel:#your-stream-channel
```

This designates where all stream notifications will be posted.

#### Step 2: Add Streamers
You have two options:

**Option A: Let users add themselves**
```
Tell your members to run: /stream addme
```

**Option B: Add streamers manually**
```
/stream add platform:twitch username:streamer_name
```

#### Step 3: (Optional) Configure Role Pinging
Currently, the system supports role pinging for notifications. To use this feature:
1. The role ID can be configured per streamer in the database
2. Future updates will add a command to set this

---

### For Server Members

#### How to Add Your Stream

1. **Connect your streaming account to Discord:**
   - Open Discord Settings
   - Go to "Connections"
   - Click "Add" and connect your Twitch/YouTube/Kick account
   - Toggle "Display on profile" to ON

2. **Run the command:**
   ```
   /stream addme
   ```

3. **Done!** The bot will automatically detect your platforms and add them.

**Troubleshooting:**
If `/stream addme` doesn't detect your accounts:
- Make sure connections are set to "Display on profile"
- Try disconnecting and reconnecting your accounts
- Use `/stream add` to manually add your channel:
  ```
  /stream add platform:twitch username:YourUsername
  ```

---

## How the Monitor Works

### Background Process

The bot runs a background task that:
1. Checks all tracked streamers every **5 minutes**
2. Queries each platform's API to see if they're live
3. Sends a notification when someone goes live
4. Updates the notification when stream ends

### Notification Embed

When a streamer goes live, the bot sends an embed with:
- **Title**: Streamer name + "is now LIVE!"
- **Stream Title**: Current stream title
- **Game/Category**: What they're playing
- **Viewer Count**: Current viewers (Kick only for now)
- **Thumbnail**: Stream thumbnail/preview
- **Link**: Direct link to watch

### Platform Status

| Platform | Status | Notes |
|----------|--------|-------|
| **Kick** | ✅ **Working** | Uses public API, no setup needed |
| **Twitch** | ⏳ Needs Setup | Requires Twitch API credentials |
| **YouTube** | ⏳ Needs Setup | Requires YouTube Data API key |

---

## API Setup (For Developers)

### Twitch API

1. Create app at https://dev.twitch.tv/console/apps
2. Get Client ID and Client Secret
3. Add to `.env`:
   ```env
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   ```
4. Implement OAuth flow in `streamMonitor.ts`
5. Use Helix API: `GET https://api.twitch.tv/helix/streams?user_login={username}`

### YouTube API

1. Create project in Google Cloud Console
2. Enable YouTube Data API v3
3. Create API key
4. Add to `.env`:
   ```env
   YOUTUBE_API_KEY=your_api_key
   ```
5. Use endpoint: `GET https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={channelId}&eventType=live&type=video`

### Kick API

Already implemented! Uses public API:
```
GET https://kick.com/api/v2/channels/{username}
```

---

## Database Schema

### Table: `stream_notifications`

| Field | Type | Description |
|-------|------|-------------|
| `id` | varchar (PK) | Unique notification ID |
| `serverId` | varchar (FK) | Discord server ID |
| `userId` | varchar (FK) | User who added the stream |
| `channelId` | varchar | Notification channel ID |
| `platform` | text | twitch/youtube/kick |
| `platformUserId` | text | Platform-specific user ID |
| `username` | text | Streamer username |
| `displayName` | text | Platform display name |
| `avatarUrl` | text | Streamer avatar URL |
| `messageId` | varchar | Last notification message |
| `notificationMessage` | text | Custom notification text |
| `roleIdToPing` | varchar | Role to ping when live |
| `isLive` | boolean | Current live status |
| `isActive` | boolean | Enabled/disabled |
| `liveTitle` | text | Current stream title |
| `liveGame` | text | Current game/category |
| `liveViewers` | integer | Current viewer count |
| `liveStartedAt` | timestamp | When stream went live |
| `lastChecked` | timestamp | Last API check time |
| `createdAt` | timestamp | When added to system |

---

## Examples

### Example Notification (Twitch)
```
@Streamers 🟣 shroud is now LIVE!

Stream Title: "VALORANT RANKED - Road to Radiant"
🎮 Playing: VALORANT
👥 Viewers: 45,234
🔗 Watch: Click here to watch

[Stream thumbnail preview]
```

### Example Notification (Kick)
```
🟢 AdinRoss is now LIVE!

Stream Title: "IRL STREAM IN MIAMI"
🎮 Playing: Just Chatting
👥 Viewers: 12,543
🔗 Watch: Click here to watch

[Stream thumbnail preview]
```

---

## Future Enhancements

- [ ] Add command to configure role pinging per streamer
- [ ] Add custom notification messages per streamer
- [ ] Add stream schedule feature
- [ ] Add stream analytics (average viewers, stream duration)
- [ ] Add VOD notifications
- [ ] Add multi-language support
- [ ] Add stream clips integration
- [ ] Add streamer leaderboard

---

## Troubleshooting

### "No streaming platforms detected"
**Solution:** Make sure your streaming accounts are connected in Discord Settings → Connections and set to "Display on profile"

### "Stream notifications are not set up"
**Solution:** Ask a server admin to run `/stream setup channel:#channel-name`

### Streams not being detected
**Possible causes:**
- API credentials not configured (Twitch/YouTube)
- Username changed on platform
- Platform API is down
- Stream is unlisted/private

**Check logs:**
```bash
sudo journalctl -u terabot -f | grep "stream"
```

### Bot not sending notifications
1. Check bot has permission to send messages in the notification channel
2. Check bot has permission to mention roles (if using role pinging)
3. Verify the streamer is actually live on the platform
4. Check the stream monitor is running (should see "🔍 Checking X stream(s)" in logs)

---

## Contributing

To improve the stream notification system:
1. Implement Twitch API integration
2. Implement YouTube API integration
3. Add more customization options
4. Improve error handling
5. Add caching to reduce API calls

See `server/bot/streamMonitor.ts` for the monitoring logic.
