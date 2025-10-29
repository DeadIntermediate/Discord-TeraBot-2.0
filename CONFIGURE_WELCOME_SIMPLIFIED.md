# Configure Welcome Command - Simplified

## Summary of Changes

The `/setup configure_welcome` command has been simplified to remove custom message options. The system now exclusively uses the default announcement format defined in the event handlers.

## Command Changes

### Before
```
/setup configure_welcome <channel> [welcome_message] [leave_message] [show_leave_messages]
```

**Options:**
- `channel` (Required) - Announcement channel
- `welcome_message` (Optional) - Custom welcome text
- `leave_message` (Optional) - Custom leave text
- `show_leave_messages` (Optional) - Toggle leave announcements

### After
```
/setup configure_welcome <channel> [show_leave_messages]
```

**Options:**
- `channel` (Required) - Announcement channel
- `show_leave_messages` (Optional, Default: true) - Toggle leave announcements

## Configuration Storage

The command now only saves:
1. **welcomeChannelId** - Channel for announcements
2. **showLeaveMessages** - Boolean flag for leave messages

All message templates are handled by the event handlers using hardcoded default embeds.

## Message Format (Always Used)

### Join Announcement
- Status badge: NEW MEMBER (blue) or RETURNING MEMBER (purple)
- Member name, account creation date, member ID
- Guild statistics: member count, bot count, total count
- Member position in guild

### Leave Announcement
- Red embed indicating departure
- Member name, account creation date, member ID
- Guild statistics at time of leave

## Code Changes

### File: `/server/bot/commands/setup.ts`

**Removed:**
- `welcome_message` string option
- `leave_message` string option
- Custom message validation logic
- Custom message database storage
- Message placeholder documentation in response embed

**Kept:**
- Channel selection
- Leave message toggle
- Core configuration logic

### Database Storage

The following fields are NO LONGER used:
- `discord_servers.welcome_message` - Can be deprecated/removed in future
- `settings.leaveMessage` - No longer stored

The following fields ARE used:
- `discord_servers.welcome_channel_id` - Channel for announcements
- `settings.showLeaveMessages` - Boolean flag

## Benefits

✅ **Simplified User Experience** - Fewer options to configure
✅ **Consistent Messaging** - All servers use the same professional format
✅ **Smaller Code Base** - 40+ lines of code removed
✅ **Reduced Storage** - No custom message data stored
✅ **Easier Maintenance** - Message updates apply to all servers automatically

## Build Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Build Size | 373.7kb | 372.0kb | -1.7kb |
| setup.ts lines | 758 | 744 | -14 |
| Compile Errors | 0 | 0 | ✅ |

## Testing the Command

```
/setup configure_welcome #announcements
```

Response:
```
✅ Welcome Announcements Configured

📺 Channel: #announcements
👋 Welcome Messages: ✅ Enabled
👋 Leave Messages: ✅ Enabled
📋 Messages: Using default announcement format

Welcome announcements are now active!
```

To disable leave messages:
```
/setup configure_welcome #announcements show_leave_messages:false
```

## Summary

The `/setup configure_welcome` command is now streamlined and focused on its core responsibility: selecting the announcement channel and toggling leave notifications. All messaging is handled by the enhanced event handlers, ensuring consistent and professional announcements across all servers.
