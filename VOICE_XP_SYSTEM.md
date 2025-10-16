# Voice XP System

## Overview
The Voice XP system automatically tracks and rewards users for spending time in voice channels. Users earn XP every minute they're in a voice channel, which contributes to their voice level and global level.

## How It Works

### XP Earning
- **Base Rate**: 2 XP per minute in voice channels
- **Minimum Time**: Must be in voice for at least 1 minute to earn XP
- **Update Frequency**: XP is calculated every 60 seconds
- **Level Calculation**: `XP Required = 100 × Current Level`

### Excluded Scenarios
- **AFK Channel**: No XP earned when in the AFK channel
- **Server Muted/Deafened**: XP is still earned (only channel presence matters)

### Tracking
The system tracks:
- **Voice XP**: Total XP earned from voice activity
- **Voice Level**: Level based on voice XP
- **Voice Time**: Total minutes spent in voice channels
- **Global Level**: Average of text level and voice level

## Features

### Real-time Tracking
- XP is awarded incrementally every minute while in voice
- Sessions are tracked individually per user per server
- Automatic cleanup when users leave voice channels

### Level Up Notifications
When a user levels up in voice:
- Console log notification
- System channel message (if configured)
- Emoji celebration 🎉

### Session Management
- **Join Voice**: Session starts, timer begins
- **Leave Voice**: Session ends, final XP calculated and awarded
- **Move to AFK**: Session pauses, XP awarded for time spent before AFK
- **Switch Channels**: Session continues seamlessly

## Database Schema

```typescript
serverMembers {
  voiceXp: integer      // Total voice XP earned
  voiceLevel: integer   // Current voice level
  voiceTime: integer    // Total minutes in voice
  globalLevel: integer  // Average of text and voice levels
}
```

## Commands

Users can check their voice stats with:
- `/profile` - Shows voice level, voice XP, and voice time
- `/leaderboard` - Shows top users by voice level/XP

## Configuration

Default settings in `server/bot/events/voiceStateUpdate.ts`:

```typescript
const VOICE_XP_PER_MINUTE = 2;      // XP per minute
const VOICE_XP_INTERVAL = 60000;     // Check interval (60 seconds)
const XP_PER_LEVEL = 100;            // Base XP per level
```

## Technical Details

### Event Handler
- **Event**: `VoiceStateUpdate`
- **Intent Required**: `GuildVoiceStates`
- **File**: `server/bot/events/voiceStateUpdate.ts`

### Periodic Tracker
- Runs every 60 seconds
- Awards incremental XP to active voice users
- Prevents double-counting by resetting session timestamps

### Performance
- In-memory session tracking using Map
- Minimal database writes (only on level changes and session ends)
- Efficient calculation with batched updates

## Example Scenarios

### Scenario 1: Normal Voice Session
1. User joins voice channel → Session starts
2. User stays for 10 minutes → Earns 20 XP (2 XP × 10 min)
3. User leaves → XP and time saved to database

### Scenario 2: AFK Behavior
1. User joins voice channel → Session starts
2. User stays for 5 minutes → Earns 10 XP
3. User moves to AFK channel → XP awarded, session ends
4. No XP earned while in AFK

### Scenario 3: Level Up
1. User has 95 Voice XP at Level 1
2. User joins voice for 3 minutes → Earns 6 XP
3. Total becomes 101 XP → Levels up to Level 2!
4. Notification sent to system channel

## Future Enhancements
- Voice XP multipliers for specific roles
- Bonus XP for streaming/camera on
- Voice activity challenges
- Voice-only leaderboards
- Configurable XP rates per server
