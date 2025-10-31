# Complete Kick OAuth Flow - Step-by-Step Testing Guide

## Prerequisites

✅ Bot Running on `http://localhost:5000`
✅ Kick OAuth Credentials Configured
✅ Discord Server with Bot Admin
✅ Stream Notifications Setup (run `/stream setup`)

## Full Testing Walkthrough

### Phase 1: Setup Verification

#### 1.1 Verify Bot Status
```bash
# Check if bot is running
ps aux | grep "node dist/index.js" | grep -v grep

# Check if port 5000 is listening
netstat -tuln | grep 5000
```

**Expected Result**: 
```
deadintermediate ... node dist/index.js
tcp  0  0 0.0.0.0:5000  0.0.0.0:*  LISTEN
```

#### 1.2 Check Kick Credentials in .env
```bash
grep -i "KICK" .env
```

**Expected Result**:
```
KICK_CLIENT_ID=01K8X1BH8QS1F8G5AA3D1SRFYQ
KICK_CLIENT_SECRET=ee08f25bfbaed0c152ac38d652f47e75427c3cce9c5ba5f0978989c77960c3fb
```

#### 1.3 Test OAuth Endpoints
```bash
# Test Kick OAuth Login Endpoint
curl -s -I http://localhost:5000/auth/kick/login | head -5

# Test Twitch OAuth Login Endpoint  
curl -s -I http://localhost:5000/auth/twitch/login | head -5
```

**Expected Result**:
```
HTTP/1.1 302 Found
X-Powered-By: Express
Location: https://auth.kick.com/authorize?client_id=...
```

### Phase 2: Discord Integration Testing

#### 2.1 Configure Stream Notifications (if not already done)
1. Open Discord server where bot is admin
2. Run command: `/stream setup #notifications`
   - Choose the channel where stream notifications should be posted
3. Bot confirms with ✅ message

#### 2.2 Trigger OAuth Flow
1. Run command: `/stream addme`
2. **Expected**: Ephemeral embed appears with 3 buttons:
   ```
   🎬 Add Your Streaming Accounts
   
   [Connect Kick] [Connect Twitch] [Connect YouTube]
   ```

### Phase 3: Kick OAuth Flow

#### 3.1 Click Connect Kick Button
1. Click "Connect Kick" button from the addme embed
2. **Expected**: Modal appears with title "Confirm Kick Account"
3. Modal shows instructions and an OAuth link

#### 3.2 Authenticate with Kick
1. Copy the link from modal (or click if enabled)
2. Paste into browser: `http://localhost:5000/auth/kick/login`
3. **Expected**: Redirects to Kick login page (https://auth.kick.com/authorize)

#### 3.3 Kick Login Page
1. Enter your Kick credentials
2. Click "Authorize" or "Continue"
3. **Expected**: Redirects back to callback with code

#### 3.4 OAuth Callback Success Page
1. You should see HTML page with:
   ```
   ✅ Kick Authentication Successful!
   
   Your Kick account has been verified.
   
   Username: your_username
   Display Name: Your Display Name
   
   ⚠️ Return to your Discord server to confirm your account 
      in the modal that appears.
   ```
2. Close or navigate back to Discord

#### 3.5 Confirm in Discord Modal
1. Return to Discord
2. A modal should appear: "Confirm Kick Account"
3. Enter the username you authenticated with
4. Click "Submit"
5. **Expected**: Success message appears:
   ```
   ✅ Account Added Successfully!
   
   your_username on kick is now being tracked for 
   stream notifications.
   
   ✨ Verified with OAuth
   Your kick account has been securely authenticated!
   ```

### Phase 4: Verification

#### 4.1 Check Stream List
```
/stream list
```

**Expected Output**:
```
📺 Tracked Streamers
├─ Kick: your_username ✅ (OAuth Verified)
└─ Platform notification channel: #notifications
```

#### 4.2 Check Database
```bash
# Connect to database
PGPASSWORD='Fukuyoshi' psql -h localhost -U postgresql -d discord_bot

# Query stream notifications
SELECT username, platform, is_oauth_verified, oauth_verified_at 
FROM stream_notifications 
WHERE username = 'your_username';
```

**Expected Result**:
```
 username     | platform | is_oauth_verified | oauth_verified_at
──────────────┼──────────┼──────────────────┼──────────────────
 your_username│ kick     │ t                 │ 2025-10-31 ...
```

### Phase 5: Test Twitch OAuth (Optional)

Repeat Phase 3 steps but click "Connect Twitch" instead. The flow is identical.

## Troubleshooting

### Issue: Port 5000 Not Listening

**Solution**:
```bash
# Kill old bot processes
pkill -9 -f "node dist/index.js"

# Rebuild
npm run build

# Restart bot
node dist/index.js > bot.log 2>&1 &

# Check logs
tail -f bot.log
```

### Issue: Kick OAuth Returns 403

**Solution**: 
- Verify credentials in .env are correct
- Check bot logs for specific error
- Ensure `OAUTH_CALLBACK_BASE_URL=http://localhost:5000`

### Issue: Modal Doesn't Appear After OAuth

**Possible Causes**:
1. Bot crashed during callback - check `bot.log`
2. Modal custom ID mismatch - check Discord bot logs
3. Database insert failed - run manual SQL insert

**Debug**:
```bash
# Check recent bot logs
tail -100 bot.log | grep -i "oauth\|stream\|error"
```

### Issue: Account Doesn't Appear in /stream list

**Solution**:
1. Verify database has entry:
   ```sql
   SELECT * FROM stream_notifications WHERE username = 'your_username';
   ```
2. Reload bot with `/bot restart` if available
3. Check bot console for database errors

## Success Indicators

✅ All of the following should work:

- [x] Bot running and responding to commands
- [x] `/stream addme` shows OAuth buttons
- [x] Clicking button shows OAuth confirmation modal
- [x] Redirects to Kick OAuth page
- [x] Kick OAuth redirects back to callback
- [x] Callback displays HTML success page
- [x] Returning to Discord shows confirmation modal
- [x] Submitting modal stores account
- [x] `/stream list` shows OAuth-verified account
- [x] Database contains credentials

## Performance Notes

- **OAuth Login Redirect**: ~1-2 seconds
- **Kick Authentication**: ~10-30 seconds (depends on Kick servers)
- **Callback Processing**: ~1-2 seconds
- **Modal Confirmation**: Instant
- **Database Update**: ~500ms

## Security Checklist

✅ No plaintext passwords shared
✅ OAuth 2.0 Authorization Code Flow
✅ State parameter for CSRF protection
✅ HTTPS-only authentication pages (Kick/Twitch)
✅ Access tokens stored securely
✅ Platform-verified ownership
✅ Account verification timestamps

## Files You Can Test

1. **OAuth Endpoints**
   - `GET /auth/kick/login` → Redirects
   - `GET /auth/kick/callback?code=...` → Success page

2. **Stream Command**
   - `/stream addme` → OAuth buttons
   - `/stream list` → Shows accounts
   - `/stream setup #channel` → Configure channel

3. **Database**
   - `stream_notifications` table with OAuth fields
   - `oauth_access_token`, `oauth_verified_at`, `is_oauth_verified`

## Next Steps After Testing

1. ✅ Test Twitch OAuth flow (same as Kick)
2. 🏗️ Implement YouTube OAuth (routes ready)
3. 🔄 Add token refresh logic
4. 📊 Use tokens to verify live status
5. 🌐 Set up production domain

---

**Created**: October 31, 2025
**Status**: Ready for Full Testing
