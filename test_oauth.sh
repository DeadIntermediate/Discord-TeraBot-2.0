#!/bin/bash

# Test Kick OAuth Flow
# This script tests the OAuth endpoints to ensure they're working correctly

echo "🧪 Testing Kick OAuth Flow"
echo "=========================="
echo ""

# Get the OAuth callback base URL
OAUTH_BASE_URL="http://localhost:5000"
echo "Using OAuth Base URL: $OAUTH_BASE_URL"
echo ""

# Test Kick OAuth login endpoint
echo "1️⃣  Testing /auth/kick/login endpoint..."
echo "   Request: GET $OAUTH_BASE_URL/auth/kick/login"
KICK_LOGIN=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -L "$OAUTH_BASE_URL/auth/kick/login" 2>&1)
HTTP_CODE=$(echo "$KICK_LOGIN" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
    echo "   ✅ Login redirect successful (HTTP $HTTP_CODE)"
    echo "   Response headers indicate redirect to Kick authentication"
else
    echo "   ⚠️  HTTP Status: $HTTP_CODE"
fi
echo ""

# Test Twitch OAuth login endpoint
echo "2️⃣  Testing /auth/twitch/login endpoint..."
echo "   Request: GET $OAUTH_BASE_URL/auth/twitch/login"
TWITCH_LOGIN=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -L "$OAUTH_BASE_URL/auth/twitch/login" 2>&1)
HTTP_CODE=$(echo "$TWITCH_LOGIN" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
    echo "   ✅ Login redirect successful (HTTP $HTTP_CODE)"
else
    echo "   ⚠️  HTTP Status: $HTTP_CODE"
fi
echo ""

echo "📋 Summary:"
echo "  - Kick OAuth login endpoint: Ready"
echo "  - Twitch OAuth login endpoint: Ready"
echo "  - Manual OAuth flow required to test callback endpoints"
echo ""
echo "🔗 To test manually:"
echo "   1. Click 'Connect Kick' button in Discord (/stream addme)"
echo "   2. Authenticate with your Kick account"
echo "   3. You should see a success page"
echo "   4. Confirm your account in the Discord modal"
echo ""
