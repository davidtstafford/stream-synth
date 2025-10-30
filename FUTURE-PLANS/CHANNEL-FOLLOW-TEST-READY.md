# channel.follow EventSub WebSocket Test - READY

**Date:** October 30, 2025  
**Status:** ✅ **READY FOR TESTING**  
**Build:** SUCCESS (386 KiB)

---

## Summary

I've re-enabled `channel.follow` EventSub subscription with the correct configuration to test if it works via WebSocket.

---

## Changes Made

### 1. Event Types Configuration
**File:** `src/frontend/config/event-types.ts`

- ✅ Added `'channel.follow': boolean` to `EventSubscriptions` interface
- ✅ Added to `EVENT_GROUPS['Channel Events']`
- ✅ Added to `DEFAULT_SUBSCRIPTIONS` (will auto-enable)
- ✅ Added display info: "New Follower"

### 2. Subscription Creation Logic
**File:** `src/frontend/services/twitch-api.ts`

**Added Special Handling for channel.follow:**
```typescript
if (eventType === 'channel.follow') {
  // channel.follow v2 requires moderator_user_id
  condition.broadcaster_user_id = broadcasterId;
  condition.moderator_user_id = userId;
}

// Set version
if (eventType === 'channel.follow') {
  version = '2'; // v2 is current version
}
```

**This will create the subscription as:**
```json
{
  "type": "channel.follow",
  "version": "2",
  "condition": {
    "broadcaster_user_id": "YOUR_CHANNEL_ID",
    "moderator_user_id": "YOUR_USER_ID"
  },
  "transport": {
    "method": "websocket",
    "session_id": "WEBSOCKET_SESSION_ID"
  }
}
```

---

## How to Test

### Step 1: Start the App
```powershell
npm start
```

### Step 2: Connect to Twitch
1. Open the app
2. Go to **Connection** tab
3. Click **Connect to Twitch**
4. Authenticate (make sure you have `moderator:read:followers` scope)

### Step 3: Watch Console Logs

Open Developer Tools (F12) and look for:

#### ✅ **SUCCESS - Subscription Created**
```
[EventSub] Creating subscription attempt 1/3 for channel.follow
[EventSub] Subscription created: {
  "data": [{
    "id": "abc123...",
    "status": "enabled",
    "type": "channel.follow",
    "version": "2",
    "condition": {
      "broadcaster_user_id": "...",
      "moderator_user_id": "..."
    },
    "transport": {
      "method": "websocket",
      "session_id": "..."
    },
    "created_at": "2025-10-30T..."
  }]
}
```

#### ❌ **FAILURE - Various Errors**

**400 Bad Request:**
```
[EventSub] Create failed status= 400 body= {
  "error": "Bad Request",
  "status": 400,
  "message": "invalid request"
}
```

**403 Forbidden (Webhook Only):**
```
[EventSub] Create failed status= 403 body= {
  "error": "Forbidden", 
  "status": 403,
  "message": "subscription type not supported for websocket transport"
}
```

**410 Gone (Deprecated):**
```
[EventSub] Create failed status= 410 body= {
  "error": "Gone",
  "status": 410, 
  "message": "subscription type is no longer supported"
}
```

**Missing Scope:**
```
[EventSub] Create failed status= 403 body= {
  "error": "Forbidden",
  "status": 403,
  "message": "missing required scope: moderator:read:followers"
}
```

### Step 4: Test Follow Event (If Subscription Succeeds)

If the subscription creates successfully:

1. Have someone **follow your channel** (or use a test account to follow yourself)
2. Watch console for WebSocket event:

```
[WebSocket] Received event notification: {
  "metadata": {
    "message_id": "...",
    "message_type": "notification",
    "message_timestamp": "2025-10-30T...",
    "subscription_type": "channel.follow",
    "subscription_version": "2"
  },
  "payload": {
    "subscription": { ... },
    "event": {
      "user_id": "12345",
      "user_login": "testuser",
      "user_name": "TestUser",
      "broadcaster_user_id": "67890",
      "broadcaster_user_login": "yourname",
      "broadcaster_user_name": "YourName",
      "followed_at": "2025-10-30T12:34:56Z"
    }
  }
}
```

3. Check **Events** tab - should see "New Follower" event

---

## Required OAuth Scope

Make sure you have the `moderator:read:followers` scope when authenticating.

**Current Scopes (in `twitch-oauth.ts`):**
```typescript
const TWITCH_SCOPES = [
  'moderator:read:followers', // ✅ Already included!
  // ... other scopes
];
```

This scope is already in the app, so you should be good to go!

---

## Expected Results

### Scenario A: IT WORKS! 🎉
- ✅ Subscription creates with status 201
- ✅ Follow events arrive via WebSocket in real-time
- ✅ Events appear in Events tab
- ✅ No polling needed for follows

**Conclusion:** `channel.follow` IS available via WebSocket! Documentation was outdated or wrong.

**Action:** Keep it enabled, remove Phase 2 follower polling (or keep as backup)

### Scenario B: IT FAILS ❌
- ❌ Subscription fails with 403/410/400
- ❌ No follow events via WebSocket

**Conclusion:** `channel.follow` is NOT available via WebSocket (webhook-only or deprecated)

**Action:** Revert changes, rely on Phase 2 follower polling instead

---

## Reverting (If Needed)

If `channel.follow` doesn't work via WebSocket:

**File:** `src/frontend/config/event-types.ts`
```typescript
export interface EventSubscriptions {
  'channel.update': boolean;
  // 'channel.follow': boolean; - CONFIRMED: Not available via WebSocket
  'channel.subscribe': boolean;
  // ...
}
```

**File:** `src/frontend/services/twitch-api.ts`
```typescript
// Remove the special case for channel.follow
// It will be handled by Phase 2 polling instead
```

---

## Additional Debugging

### Check All Subscriptions

In Developer Tools Console:
```javascript
// Call this after connecting
fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Client-Id': 'YOUR_CLIENT_ID'
  }
})
.then(r => r.json())
.then(data => {
  const followSub = data.data.find(s => s.type === 'channel.follow');
  console.log('channel.follow subscription:', followSub);
});
```

### Force Re-create Subscription

If you want to test again:
1. Disconnect from Twitch
2. Clear browser cache
3. Reconnect to Twitch
4. Subscription will be created fresh

---

## Documentation

Full test documentation: `CHANNEL-FOLLOW-WEBSOCKET-TEST.md`

---

## Current Status

- ✅ Code changes complete
- ✅ Build successful (386 KiB)
- ✅ Uses `channel.follow` v2 with correct condition
- ✅ Uses `moderator:read:followers` scope (already in auth)
- ⏸️ **AWAITING USER TESTING**

**Ready to test!** 🚀

Just run `npm start` and connect to Twitch. Watch the console logs during connection to see if the subscription creates successfully.

**Please report back with:**
1. Did the subscription create successfully? (Yes/No)
2. What was the HTTP status code? (201, 400, 403, 410, etc.)
3. If successful, did you receive follow events via WebSocket? (Yes/No)

This will help us confirm whether `channel.follow` works via WebSocket or if we need to rely solely on polling! 🔍
