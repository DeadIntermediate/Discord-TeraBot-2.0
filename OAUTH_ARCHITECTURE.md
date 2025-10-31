# OAuth Flow Architecture & Sequence Diagrams

## 🔄 Complete Kick OAuth Flow

```
┌─────────────────┐
│   Discord User  │
└────────┬────────┘
         │
         │ 1. Run /stream addme
         ▼
    ┌─────────────────────────────────┐
    │  Discord Bot (streams command)  │
    │                                 │
    │  Shows 3 OAuth buttons:         │
    │  [Connect Kick] [Twitch] [YT]   │
    └────────┬────────────────────────┘
             │
             │ 2. User clicks "Connect Kick"
             ▼
    ┌──────────────────────────┐
    │  Discord Bot             │
    │  Shows confirmation modal│
    │  "Confirm Kick Account"  │
    │  with OAuth link         │
    └────────┬─────────────────┘
             │
             │ 3. User clicks OAuth link
             ▼
    ┌──────────────────────────────────┐
    │  Web Browser opens                │
    │  GET /auth/kick/login             │
    │  (Bot Backend - Express Server)   │
    └────────┬─────────────────────────┘
             │
             │ 4. Redirect (302)
             ▼
    ┌──────────────────────────────────┐
    │  Kick Authorization Server        │
    │  https://auth.kick.com/authorize  │
    │                                   │
    │  User logs in with:              │
    │  - Kick username                  │
    │  - Kick password                  │
    │  - Approves permissions           │
    └────────┬─────────────────────────┘
             │
             │ 5. Redirect with code
             ▼
    ┌──────────────────────────────────┐
    │  Bot Backend                      │
    │  GET /auth/kick/callback?code=... │
    │                                   │
    │  • Exchange code for token        │
    │  • Fetch user info from Kick API  │
    │  • Display success page           │
    └────────┬─────────────────────────┘
             │
             │ 6. HTML Success Page
             ▼
    ┌──────────────────────────────────┐
    │  Browser displays:                │
    │  ✅ Authentication Successful!    │
    │  Username: their_username         │
    │  Display Name: Their Name         │
    │                                   │
    │  "Return to Discord to confirm"   │
    └────────┬─────────────────────────┘
             │
             │ 7. User returns to Discord
             ▼
    ┌────────────────────────────────────┐
    │  Discord Bot                        │
    │  Shows confirmation modal:          │
    │  "Confirm Kick Account"             │
    │  [Enter your Kick username] [Submit]│
    │                                     │
    │  User enters: their_username        │
    └────────┬───────────────────────────┘
             │
             │ 8. User submits modal
             ▼
    ┌────────────────────────────────────┐
    │  Bot Backend                        │
    │  Modal submission handler:          │
    │                                     │
    │  • Verify user match                │
    │  • Store in database:               │
    │    - username                       │
    │    - platform (kick)                │
    │    - oauth_access_token             │
    │    - is_oauth_verified = true       │
    │    - oauth_verified_at = NOW()      │
    └────────┬───────────────────────────┘
             │
             │ 9. Success message
             ▼
    ┌────────────────────────────────────┐
    │  Discord User sees:                 │
    │  ✅ Account Added Successfully!     │
    │  their_username on kick             │
    │  ✨ Verified with OAuth             │
    └────────────────────────────────────┘
```

## 📊 Database Schema

```
stream_notifications table:
┌──────────────────────┬─────────────┬──────────────┐
│ Column               │ Type        │ OAuth Field? │
├──────────────────────┼─────────────┼──────────────┤
│ id                   │ VARCHAR     │              │
│ server_id            │ VARCHAR     │              │
│ user_id              │ VARCHAR     │              │
│ channel_id           │ VARCHAR     │              │
│ platform             │ TEXT        │              │
│ username             │ TEXT        │              │
│ platform_user_id     │ TEXT        │              │
│ display_name         │ TEXT        │              │
│ avatar_url           │ TEXT        │              │
│ is_live              │ BOOLEAN     │              │
│ is_active            │ BOOLEAN     │              │
├──────────────────────┼─────────────┼──────────────┤
│ oauth_access_token   │ TEXT        │     ✅       │
│ oauth_refresh_token  │ TEXT        │     ✅       │
│ oauth_token_expires  │ TIMESTAMP   │     ✅       │
│ is_oauth_verified    │ BOOLEAN     │     ✅       │
│ oauth_verified_at    │ TIMESTAMP   │     ✅       │
│ created_at           │ TIMESTAMP   │              │
└──────────────────────┴─────────────┴──────────────┘
```

## 🔐 OAuth Security Flow

```
┌───────────────────────────────────────────────────┐
│  OAuth 2.0 Authorization Code Flow (RFC 6749)    │
└───────────────┬─────────────────────────────────┘
                │
         ┌──────┴────────┐
         │               │
         ▼               ▼
    User enters    Bot initiates
    /stream addme  /auth/kick/login
         │               │
         └──────┬────────┘
                │
    Redirect to Kick OAuth Server
    https://auth.kick.com/authorize
    ?client_id=...
    &redirect_uri=http://localhost:5000/auth/kick/callback
    &response_type=code
    &scope=openid+profile+email
    &state=random_state_token
                │
                ▼
    User authenticates with Kick
    (No bot ever sees password)
                │
                ▼
    Kick redirects back with code
    http://localhost:5000/auth/kick/callback
    ?code=authorization_code
    &state=random_state_token
                │
    Verify state matches ✓
                │
                ▼
    Exchange code for token (server-to-server)
    POST https://oauth.kick.com/token
    {
      "client_id": "...",
      "client_secret": "...",  ← Bot secret, never exposed
      "code": "authorization_code",
      "grant_type": "authorization_code",
      "redirect_uri": "http://localhost:5000/auth/kick/callback"
    }
                │
                ▼
    Receive access_token
    (valid for API calls)
                │
                ▼
    Fetch user info
    GET https://api.kick.com/v1/user
    Authorization: Bearer access_token
                │
                ▼
    Display success page with user info
    (No sensitive data in HTML)
                │
                ▼
    Bot stores token securely in database
    (Encrypted at rest, behind firewall)
```

## 🔌 API Endpoints

```
┌─ OAUTH ENDPOINTS ──────────────────────────────┐
│                                                 │
│ GET /auth/kick/login                           │
│   ├─ No authentication required                │
│   ├─ Query: (none)                             │
│   └─ Response: 302 Redirect to Kick            │
│                                                 │
│ GET /auth/kick/callback                        │
│   ├─ No authentication required                │
│   ├─ Query params:                             │
│   │  └─ code: authorization code               │
│   │  └─ state: CSRF protection token           │
│   └─ Response: HTML success page               │
│                                                 │
│ GET /auth/twitch/login                         │
│   ├─ No authentication required                │
│   └─ Response: 302 Redirect to Twitch          │
│                                                 │
│ GET /auth/twitch/callback                      │
│   ├─ Query params: code, state                 │
│   └─ Response: HTML success page               │
│                                                 │
└─────────────────────────────────────────────────┘

┌─ DISCORD BOT COMMANDS ─────────────────────────┐
│                                                 │
│ /stream addme                                  │
│   └─ Response: Embed with OAuth buttons        │
│                                                 │
│ /stream add <platform> <username>              │
│   └─ Manual entry (fallback)                   │
│                                                 │
│ /stream list                                   │
│   └─ Shows all tracked streamers               │
│      (includes ✅ OAuth status)                │
│                                                 │
│ /stream remove <platform> <username>           │
│   └─ Remove tracked streamer                   │
│                                                 │
│ /stream setup <channel>                        │
│   └─ Configure notification channel            │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 🎯 Data Flow Diagram

```
User Input
    │
    ├─ Discord Command: /stream addme
    │       ▼
    │  Bot Handler (handleAddMe)
    │       │
    │       ├─ Verify guild & permissions
    │       ├─ Check notification channel
    │       ├─ Ensure user in database
    │       └─ Display OAuth embed with buttons
    │
    │
    ├─ Button: Connect Kick
    │       ▼
    │  Button Handler (handleStreamButtons)
    │       │
    │       ├─ Identify platform (kick)
    │       └─ Show OAuth modal with link
    │
    │
    ├─ OAuth Link Click
    │       ▼
    │  Route: GET /auth/kick/login
    │       │
    │       ├─ Build Kick authorization URL
    │       ├─ Add client_id, redirect_uri, scopes
    │       └─ Redirect browser to Kick
    │
    │
    ├─ Kick Authentication (platform)
    │       ▼
    │  Browser: https://auth.kick.com/authorize
    │       │
    │       ├─ User enters credentials
    │       ├─ Kick verifies user
    │       ├─ Kick redirects back with code
    │       └─ Code sent to callback endpoint
    │
    │
    ├─ OAuth Callback
    │       ▼
    │  Route: GET /auth/kick/callback?code=...
    │       │
    │       ├─ Verify state token
    │       ├─ Exchange code for access_token
    │       │  (POST to https://oauth.kick.com/token)
    │       ├─ Fetch user info
    │       │  (GET https://api.kick.com/v1/user)
    │       ├─ Display HTML success page
    │       └─ User returns to Discord
    │
    │
    ├─ Modal Confirmation
    │       ▼
    │  Modal Handler (handleStreamModal)
    │       │
    │       ├─ Verify user identity
    │       ├─ Get username input
    │       ├─ Check for duplicates
    │       ├─ Save to database (saveOAuthStreamer)
    │       │  └─ username, platform, is_oauth_verified,
    │       │     oauth_access_token, oauth_verified_at
    │       └─ Display success embed
    │
    │
    └─ Database Storage
            ▼
        stream_notifications
            │
            ├─ Column: username = "their_username"
            ├─ Column: platform = "kick"
            ├─ Column: oauth_access_token = "token_xxx"
            ├─ Column: is_oauth_verified = true
            ├─ Column: oauth_verified_at = "2025-10-31 12:15:00"
            └─ Indexed for quick lookups
```

## 🛡️ Security Considerations

```
┌──────────────────────────────────────────────────┐
│ What the Bot NEVER sees:                         │
│  ❌ User password                                 │
│  ❌ Full authentication tokens (until stored)    │
│  ❌ User's platform credentials                   │
│                                                  │
│ What is Securely Stored:                        │
│  ✅ OAuth access token (in database)            │
│  ✅ Refresh token (if provided)                  │
│  ✅ Token expiration time                        │
│  ✅ Verification timestamp                       │
│  ✅ Username (platform-verified)                 │
│                                                  │
│ What is Ephemeral:                               │
│  ⏱️ State token (CSRF protection)               │
│  ⏱️ Authorization code (single-use)              │
│  ⏱️ User session (browser cookies)               │
└──────────────────────────────────────────────────┘
```

---

**Diagram Version**: 1.0
**Created**: October 31, 2025
**Status**: Complete
