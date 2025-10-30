# Testing channel.follow EventSub Subscription

**Date:** October 30, 2025  
**Status:** 🧪 **EXPERIMENTAL TEST**  
**Purpose:** Verify if `channel.follow` works via WebSocket despite documentation suggesting otherwise

---

## Background

The Twitch EventSub documentation and previous implementation marked `channel.follow` as:
- **DEPRECATED** (returning 410 Gone)
- Or **WEBHOOK ONLY** (not available via WebSocket)

However, you suspected this might not be accurate. Many subscription types that aren't explicitly marked "webhook only" in the docs DO work via WebSocket.

---

## Changes Made

### 1. Re-enabled `channel.follow` in Event Types

**File:** `src/frontend/config/event-types.ts`

#### Interface Update
```typescript
export interface EventSubscriptions {
  'channel.update': boolean;
  'channel.follow': boolean; // Re-enabled for testing
  'channel.subscribe': boolean;
  // ...
}
```

#### Event Groups Update
```typescript
export const EVENT_GROUPS: Record<string, string[]> = {
  'Channel Events': [
    'channel.update',
    'channel.follow', // Added back
    'channel.subscribe',
    // ...
  ],
  // ...
};
```

#### Default Subscriptions Update
```typescript
export const DEFAULT_SUBSCRIPTIONS: (keyof EventSubscriptions)[] = [
  'channel.chat.message',
  'channel.follow', // Enabled by default
  'channel.subscribe',
  // ...
];
```

#### Display Info Update
```typescript
export const EVENT_DISPLAY_INFO: Record<keyof EventSubscriptions, { name: string; description: string }> = {
  'channel.follow': { 
    name: 'New Follower', 
    description: 'User follows the channel (TESTING - may not work via WebSocket)' 
  },
  // ...
};
```

---

## How to Test

### Step 1: Start the Application
```bash
npm run build
npm start
```

### Step 2: Connect to Twitch
1. Go to **Connection** tab
2. Click **Connect to Twitch**
3. Authenticate with your account
4. Wait for WebSocket connection to establish

### Step 3: Check Subscription Creation

**Watch the Console for:**

#### ✅ **Success Case** (channel.follow works!)
```
[EventSub] Creating subscription for channel.follow
[EventSub] Subscription created successfully: channel.follow
```

#### ❌ **Failure Case 1** (400 Bad Request)
```
[EventSub] Creating subscription for channel.follow
[EventSub] Error creating subscription: 400 Bad Request
{
  "error": "Bad Request",
  "status": 400,
  "message": "subscription type not supported"
}
```

#### ❌ **Failure Case 2** (410 Gone - Deprecated)
```
[EventSub] Creating subscription for channel.follow
[EventSub] Error creating subscription: 410 Gone
{
  "error": "Gone",
  "status": 410,
  "message": "subscription type is deprecated"
}
```

#### ❌ **Failure Case 3** (403 Forbidden - Webhook Only)
```
[EventSub] Creating subscription for channel.follow
[EventSub] Error creating subscription: 403 Forbidden
{
  "error": "Forbidden",
  "status": 403,
  "message": "subscription type requires webhook transport"
}
```

### Step 4: Test Follow Event (If Subscription Succeeds)

If the subscription was created successfully:

1. Have someone follow your channel (or use a test account)
2. **Watch the Console for:**

```
[WebSocket] Received event notification:
{
  "metadata": {
    "message_type": "notification",
    "subscription_type": "channel.follow"
  },
  "payload": {
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

3. **Check Events Tab** - Should see a "New Follower" event

---

## Expected Outcomes

### Scenario 1: It Works! 🎉
- Subscription creates successfully (201 response)
- Follow events arrive via WebSocket
- Events appear in Events tab
- **Conclusion:** Documentation was wrong/outdated, `channel.follow` IS available via WebSocket

### Scenario 2: 400 Bad Request
- Twitch API doesn't recognize `channel.follow` as valid
- **Conclusion:** Subscription type name changed or removed

### Scenario 3: 410 Gone
- Twitch API explicitly marks it as deprecated
- **Conclusion:** `channel.follow` was removed, use polling instead (Phase 2)

### Scenario 4: 403 Forbidden
- Twitch API requires webhook transport
- **Conclusion:** `channel.follow` is webhook-only, not available via WebSocket

---

## Debugging Tips

### Enable Verbose Logging

**In `src/frontend/services/twitch-api.ts`**, the subscription creation already logs extensively:

```typescript
console.log('[EventSub] Creating subscription for', eventType);
console.log('[EventSub] Request payload:', JSON.stringify(body, null, 2));
console.log('[EventSub] Response status:', subscriptionResponse.status);
console.log('[EventSub] Response body:', JSON.stringify(responseData, null, 2));
```

### Check Network Tab

Open Developer Tools → Network tab:
1. Filter by "eventsub"
2. Look for POST request to `https://api.twitch.tv/helix/eventsub/subscriptions`
3. Check request payload for `channel.follow`
4. Check response status and body

### Check WebSocket Messages

In Developer Tools Console:
```javascript
// The WebSocket connection logs all messages
// Look for messages with subscription_type: "channel.follow"
```

---

## Twitch EventSub API Reference

### channel.follow Subscription (v2)

**Endpoint:** `POST https://api.twitch.tv/helix/eventsub/subscriptions`

**Payload:**
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

**Required Scopes:**
- `moderator:read:followers`

**Note:** Version 2 of `channel.follow` requires BOTH:
- `broadcaster_user_id` (the channel being followed)
- `moderator_user_id` (the user creating the subscription, must have moderator:read:followers scope)

This is different from v1 which only required `broadcaster_user_id`.

---

## Reverting Changes (If It Doesn't Work)

If testing confirms `channel.follow` doesn't work via WebSocket:

```typescript
// src/frontend/config/event-types.ts

export interface EventSubscriptions {
  'channel.update': boolean;
  // 'channel.follow': boolean; - CONFIRMED: Not available via WebSocket
  'channel.subscribe': boolean;
  // ...
}

export const EVENT_GROUPS = {
  'Channel Events': [
    'channel.update',
    // 'channel.follow', - CONFIRMED: Not available via WebSocket
    'channel.subscribe',
    // ...
  ],
  // ...
};

export const DEFAULT_SUBSCRIPTIONS = [
  'channel.chat.message',
  // 'channel.follow', - CONFIRMED: Not available via WebSocket
  'channel.subscribe',
  // ...
];
```

And rely on **Phase 2: Follower Polling** instead (which already works).

---

## Current Status

- ✅ Code changes complete
- ✅ Build successful (386 KiB)
- ⏸️ **AWAITING USER TESTING**

**Next Steps:**
1. User runs the app
2. User connects to Twitch
3. User observes console logs for subscription creation
4. User tests with actual follow event (if subscription succeeds)
5. Report results

---

## Additional Notes

### Why This Matters

If `channel.follow` works via WebSocket:
- **Real-time follow events** without polling
- Lower API usage
- Faster event detection
- No need for Phase 2 follower polling

If it doesn't work:
- Phase 2 follower polling is still valid and working
- Confirms documentation accuracy
- No harm done, easy to revert

### Version Differences

The `channel.follow` subscription has TWO versions:

**Version 1 (Deprecated?):**
```json
{
  "type": "channel.follow",
  "version": "1",
  "condition": {
    "broadcaster_user_id": "12345"
  }
}
```

**Version 2 (Current):**
```json
{
  "type": "channel.follow",
  "version": "2",
  "condition": {
    "broadcaster_user_id": "12345",
    "moderator_user_id": "12345"
  }
}
```

If v1 fails, we could try v2 with the `moderator_user_id` condition.

---

**Test Results:** (To be filled in by user)

- [ ] Subscription creation: _______ (Success/Failure/Error)
- [ ] Error code (if any): _______
- [ ] Follow event received: _______ (Yes/No)
- [ ] Conclusion: _______________________________
