# 📋 Comprehensive Live Logging System - Implementation Guide

## Overview

The Tera Bot includes a **comprehensive live logging system** that sends detailed logs to a Discord channel in real-time. This allows you to monitor all bot activities, errors, warnings, and important events directly in Discord without needing to check server logs.

⚠️ **Important**: This feature is **only available in the Tera Bot guild** for security and resource management purposes.

## Features

### ✅ Live Logging Capabilities
- **Real-time Discord Messages**: All logs are sent to a configured Discord channel via webhooks
- **Color-coded Severity Levels**: 
  - 🔴 **Errors** (Red)
  - 🟠 **Warnings** (Orange)
  - 🔵 **Info** (Blue)
  - ⚪ **Debug** (Gray)
- **Configurable Log Levels**: Choose what you want to see (errors, warnings, info, debug)
- **Categories**: Logs are organized by category (Commands, Voice, Streams, Moderation, System, Bot)
- **Detailed Context**: Each log includes timestamps, user info, and relevant details
- **Database Storage**: All logs are stored in the database for historical tracking

### 📊 Log Categories
- **Commands** - Slash command execution and usage
- **Voice** - Voice channel join/leave events and XP tracking
- **Streams** - Stream notifications and status changes
- **Moderation** - Moderation actions (kicks, bans, mutes, etc.)
- **System** - Bot initialization, errors, and critical events
- **Bot** - General bot operations and maintenance

## Setup Instructions

### ⚠️ Tera Bot Guild Only

This feature is **restricted to the Tera Bot guild** (ID: 1431645643746836532) for security purposes. The commands and logging will not work in other servers.

### Step 1: Configure Logging Channel

Run the `/setup configure_logging` command:

```
/setup configure_logging channel: #logs
```

**Parameters:**
- `channel` (Required): The Discord text channel where logs will be sent
- `log_errors` (Optional): Log error messages (default: enabled)
- `log_warnings` (Optional): Log warning messages (default: enabled)
- `log_info` (Optional): Log info messages (default: enabled)
- `log_debug` (Optional): Log debug messages (default: disabled)

### Step 2: Verify Logging is Active

After setup, you should see:
- ✅ Test message in the logging channel
- 📋 Confirmation embed showing all settings
- ✨ Green "Tera Bot Logger" webhook avatar

### Example

```
/setup configure_logging
├─ Channel: #bot-logs
├─ 🔴 Log Errors: ✅ Yes
├─ 🟠 Log Warnings: ✅ Yes
├─ 🔵 Log Info: ✅ Yes
└─ ⚪ Log Debug: ❌ No
```

## Viewing Logs

### `/logs` Command

View recent logs directly in Discord:

```
/logs [level] [category] [limit]
```

**Parameters:**
- `level` (Optional): Filter by severity (All, Errors, Warnings, Info, Debug)
- `category` (Optional): Filter by category (Bot, Commands, Voice, Streams, Moderation, System)
- `limit` (Optional): Number of logs to display (1-20, default: 10)

### Examples

```
# View last 10 logs
/logs

# View only errors
/logs level: Errors

# View command logs
/logs category: Commands limit: 5

# View info messages from System category
/logs level: Info category: System limit: 15
```

## Log Entry Format

Each log entry includes:

```
❌ ERROR - Commands
└─ Command `/help` executed by @User#1234 - Failed

📊 Details:
   • Error: Permission Denied
   • Code: 50001

👤 User: @User#1234
⏰ Time: 10/25/2025, 4:25:18 PM
📊 Sent: ✅ Yes
```

## Database Schema

### `logging_config` Table
Stores logging configuration per server:
```sql
- id: Primary key
- server_id: Discord server ID
- channel_id: Logging channel ID
- webhook_url: Webhook URL for sending logs
- log_errors: Boolean (default: true)
- log_warnings: Boolean (default: true)
- log_info: Boolean (default: true)
- log_debug: Boolean (default: false)
- is_active: Boolean (default: true)
- created_at: Timestamp
- updated_at: Timestamp
```

### `bot_logs` Table
Stores all log entries:
```sql
- id: Primary key
- server_id: Discord server ID
- level: debug, info, warn, error
- category: Bot, Commands, Voice, etc.
- message: Log message
- details: JSON with additional data
- user_id: Related Discord user (if applicable)
- message_id: Related Discord message (if applicable)
- sent_to_discord: Boolean (was it sent to webhook?)
- created_at: Timestamp
```

## Available Logging Functions

The logging system provides specialized functions for different event types:

### In Code
```typescript
import { 
  sendLogToDiscord,
  logErrorToDiscord,
  logCommandToDiscord,
  logModerationToDiscord,
  logVoiceToDiscord,
  logStreamToDiscord,
  logSystemToDiscord
} from '@utils/discordLogger';

// Log a command execution
await logCommandToDiscord(
  commandName: 'help',
  userId: '123456789',
  serverId: '987654321',
  success: true,
  error: undefined,
  client: interaction.client
);

// Log an error
await logErrorToDiscord(
  'Failed to process game search',
  error,
  { serverId: guildId, userId: memberId, category: 'Commands' },
  client
);

// Log moderation action
await logModerationToDiscord(
  'ban',
  moderatorId: '111222333',
  targetUserId: '444555666',
  serverId: guildId,
  reason: 'Spam',
  client
);
```

## Security & Privacy

✅ **Secure**
- Webhook URLs stored in database
- Logs sent only to configured channels
- User IDs are shown as mentions (don't reveal PII)

⚠️ **Best Practices**
- Keep logging channels private (admin-only)
- Don't log sensitive data (passwords, tokens)
- Regularly review logs for security issues
- Archive old logs periodically

## Troubleshooting

### Logs not appearing in channel?
1. Check bot has webhook permission in channel: `/setup check_permissions`
2. Verify logging is enabled: Check `is_active` in database
3. Verify webhook URL is valid: Test with `/setup configure_logging` again

### Too many logs?
- Disable debug logging: `/setup configure_logging log_debug: No`
- Use `/logs` filters to find specific issues
- Archive historical logs from database

### Logs showing multiple times?
- Check webhook wasn't created twice
- Verify only one logging config exists per server

## Examples in Action

### Example 1: Error Logging
```
❌ ERROR - Commands
Command `/search-game` executed by @User#1234

📊 Details:
   • Error: API Rate Limited
   • Retries: 3

👤 User: @User#1234
⏰ Time: 10/25/2025, 4:30:45 PM
```

### Example 2: Voice Events
```
ℹ️ INFO - Voice
👤 @User#1234 JOINED voice channel: General

👤 User: @User#1234
⏰ Time: 10/25/2025, 4:32:10 PM
```

### Example 3: Stream Notification
```
ℹ️ INFO - Streams
🔴 @Streamer is now LIVE on Twitch - "Speedrunning Mario!"

📊 Details:
   • Game: Super Mario 64
   • Viewers: 1,250

⏰ Time: 10/25/2025, 5:00:00 PM
```

## Commands Summary

| Command | Purpose | Permission |
|---------|---------|-----------|
| `/setup configure_logging` | Set up logging channel and webhook | Administrator |
| `/setup check_permissions` | Verify bot has logging permissions | Administrator |
| `/logs` | View recent logs with filters | Administrator |

## Next Steps

1. ✅ Configure logging: `/setup configure_logging #logs`
2. ✅ View logs: `/logs` (in #logs channel)
3. ✅ Monitor for issues in real-time
4. ✅ Review logs regularly for patterns or errors
5. ✅ Archive logs as needed

## Technical Details

**Build Size**: 318.1kb (dist/index.js)
**Commands Registered**: 27 (including `/logs` and `/setup configure_logging`)
**Database Tables**: 
- `logging_config` - Logging configuration (1 per server)
- `bot_logs` - Log entries (unlimited, indexed by server, level, category, created_at)

---

**Last Updated**: October 25, 2025
**Status**: ✅ Active and Ready
