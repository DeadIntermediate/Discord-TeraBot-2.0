# 🚀 Quick Start - Live Logging System

⚠️ **Note:** This feature only works in the **Tera Bot guild**

## 30-Second Setup

1. **Run this command in Discord (in Tera Bot guild):**
   ```
   /setup configure_logging channel: #bot-logs
   ```

2. **You'll see a test message in #bot-logs channel ✅**

3. **View logs with:**
   ```
   /logs
   ```

Done! 🎉

## What You Get

- ✅ Real-time logs in Discord
- ✅ Color-coded by severity (errors, warnings, info, debug)
- ✅ Full historical log database
- ✅ Searchable by level and category

## Common Commands

```
# View last 10 logs
/logs

# View only errors
/logs level: Errors

# View command logs
/logs category: Commands

# View 20 most recent logs
/logs limit: 20

# View errors from last week filtered by category
/logs level: Errors category: Voice limit: 15
```

## What Gets Logged

- 🎮 Command executions (success/failure)
- ❌ Errors and exceptions
- ⚠️ Warnings
- ℹ️ Important events
- 🎤 Voice activity
- 🔴 Stream notifications
- 🛡️ Moderation actions

## Fine-Tuning

After setup, you can customize what gets logged:

```
/setup configure_logging 
  channel: #logs
  log_errors: true      ← Enable error logs
  log_warnings: true    ← Enable warning logs
  log_info: true        ← Enable info logs
  log_debug: false      ← Disable debug logs (verbose)
```

**Pro Tip**: Keep debug disabled for a cleaner feed. Enable it only when troubleshooting.

## Need Help?

- Check permissions: `/setup check_permissions`
- Reconfigure: `/setup configure_logging channel: #logs`
- View documentation: See `COMPREHENSIVE_LOGGING.md`

---

**Ready to monitor your bot in real-time!** 📋✨
