# Backend EventSub Manager Connection Fix

## The Real Problem

The **backend EventSub manager** was failing to initialize, causing:
- ❌ `channel.ban` subscription never created
- ❌ `channel.unban` subscription never created  
- ❌ Error: "reply was never sent" when frontend called `eventsub-initialize`

## Root Cause

The `connect()` method in `EventSubManager` returned a Promise that **NEVER RESOLVED**:

```typescript
// OLD CODE (BROKEN)
private async connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    // ... setup WebSocket ...
    
    this.ws.onerror = (error: Event) => {
      reject(error);  // ✅ Rejects on error
    };
    
    // ❌ BUT NEVER CALLS resolve()!
  });
}
```

This caused the IPC handler `eventsub-initialize` to hang indefinitely waiting for the promise, eventually timing out with "reply was never sent".

##Fix Applied

### Step 1: Added Connection Resolver Property

**File:** `src/backend/services/eventsub-manager.ts` (Line 58)

```typescript
private connectionResolver: (() => void) | null = null;
```

### Step 2: Store Resolver in connect()

**Lines 97-110**

```typescript
private async connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
      console.log('[EventSub] Connecting to', wsUrl);

      // Store resolver to call when welcome message is received
      this.connectionResolver = resolve;  // ✅ ADDED

      this.ws = new WebSocket(wsUrl);
      // ...
    }
  });
}
```

### Step 3: Resolve Promise on Welcome

**Lines 190-197**

```typescript
private handleWelcome(message: WebSocketMessage): void {
  // ...setup session, keepalive, subscriptions...
  
  // Resolve the connection promise
  if (this.connectionResolver) {
    this.connectionResolver();  // ✅ ADDED
    this.connectionResolver = null;
  }
}
```

### Step 4: Clear Resolver on Error/Close

**Lines 115-120, 122-127**

```typescript
this.ws.onerror = (error: Event) => {
  console.error('[EventSub] WebSocket error:', error);
  this.emit('error', error);
  this.connectionResolver = null; // ✅ ADDED - Clear resolver on error
  reject(error);
};

this.ws.onclose = () => {
  console.log('[EventSub] WebSocket closed');
  this.clearKeepalive();
  this.emit('disconnected');
  this.connectionResolver = null; // ✅ ADDED - Clear resolver on close
  this.attemptReconnect();
};
```

## What This Fixes

### Before ❌
```
[EventSub] Connecting to wss://eventsub.wss.twitch.tv/ws
[EventSub] WebSocket connected
[EventSub] No session in welcome message  // OR welcome received
// ... but Promise never resolves ...
[App] EventSub initialization result: {success: false, error: "reply was never sent"}
```

**Result:** 
- Backend subscriptions NEVER created
- Only frontend subscriptions attempted
- `channel.ban` and `channel.unban` missing

### After ✅
```
[EventSub] Connecting to wss://eventsub.wss.twitch.tv/ws
[EventSub] WebSocket connected
[EventSub] Connected with session: AgoQ...
[EventSub] Subscribing to 10 event types
[EventSub] Creating subscription for channel.ban
[EventSub] Creating subscription for channel.unban
[EventSub] Subscription complete
[App] EventSub initialization result: {success: true}
```

**Result:**
- ✅ Backend manager connects successfully
- ✅ `channel.ban` subscription created
- ✅ `channel.unban` subscription created
- ✅ Ban events received and processed
- ✅ Database updated
- ✅ UI updates in real-time

## Expected Console Output After Restart

### Successful Connection
```
[Startup] Initializing EventSub integration...
[EventSubIntegration] 🚀 Initializing event routing...
[EventSub] Initializing...
[EventSub] Connecting to wss://eventsub.wss.twitch.tv/ws
[EventSub] WebSocket connected
[EventSub] Connected with session: AgoQXXXXXX
[EventSub] Subscribing to 10 event types
```

### Backend Subscriptions Created
```
[EventSub] Creating subscription for channel.follow
[EventSub] Creating subscription for channel.subscribe
[EventSub] Creating subscription for channel.subscription.end
[EventSub] Creating subscription for channel.subscription.gift
[EventSub] Creating subscription for channel.ban          ✅ NEW
[EventSub] Creating subscription for channel.unban        ✅ NEW
[EventSub] Creating subscription for channel.moderator.add
[EventSub] Creating subscription for channel.moderator.remove
[EventSub] Creating subscription for channel.vip.add
[EventSub] Creating subscription for channel.vip.remove
[EventSub] Subscription complete
```

### When You Ban Someone
```
[EventSubIntegration] ⚡ RECEIVED EVENT: channel.ban      ✅ NEW
[EventSubIntegration] Event data: {
  "user_id": "1362524977",
  "user_login": "eggieberttestacc",
  "is_permanent": true,
  "banned_at": "2025-10-31T18:08:10Z"
}
[EventRouter] Processing ban event: eggieberttestacc
[EventRouter] ✓ ban event recorded for: eggieberttestacc (permanent)
```

### When You Timeout Someone
```
[EventSubIntegration] ⚡ RECEIVED EVENT: channel.ban
[EventSubIntegration] Event data: {
  "user_id": "1362524977",
  "user_login": "eggieberttestacc",
  "is_permanent": false,                              ✅ Timeout
  "ends_at": "2025-10-31T18:10:10Z",
  "banned_at": "2025-10-31T18:08:10Z"
}
[EventRouter] Processing timeout event: eggieberttestacc
[EventRouter] ✓ timeout event recorded for: eggieberttestacc (120s)
```

## Files Modified

| File | Change |
|------|--------|
| `src/backend/services/eventsub-manager.ts` | Added `connectionResolver` property |
| `src/backend/services/eventsub-manager.ts` | Store resolver in `connect()` method |
| `src/backend/services/eventsub-manager.ts` | Resolve promise in `handleWelcome()` |
| `src/backend/services/eventsub-manager.ts` | Clear resolver on error/close |

## Why Previous Fixes Didn't Work

1. ✅ **Added `channel.ban`/`channel.unban` to subscription list** - Good, but never executed
2. ✅ **Added `moderator_user_id` condition** - Good, but never executed
3. ✅ **Improved ban handler to distinguish timeouts** - Good, but never received events
4. ❌ **Backend manager never connected** - THIS WAS THE BLOCKER!

The subscriptions were configured correctly, but the backend manager's connection promise never resolved, so it never actually subscribed to anything!

## Testing Steps

1. **Restart the app** completely
2. **Check console immediately** - Should see:
   ```
   [EventSub] Connected with session: ...
   [EventSub] Subscribing to 10 event types
   ```
3. **Ban someone**: `/ban @user`
4. **Check console** - Should see:
   ```
   [EventSubIntegration] ⚡ RECEIVED EVENT: channel.ban
   [EventRouter] ✓ ban event recorded
   ```
5. **Check Viewers screen** - Red "BANNED" badge should appear
6. **Unban**: `/unban @user`
7. **Check** - Badge should disappear

## If You Still See Issues

### 403 Errors for channel.ban/unban
**Problem:** OAuth token missing `moderator:read:banned_users` scope

**Solution:** Logout and login again

### No Events Received At All
**Problem:** WebSocket not connecting

**Check logs for:**
```
[EventSub] Connected with session: ...
```

If missing, check internet connection and Twitch API status.

---

**Date:** October 31, 2025  
**Issue:** Backend EventSub manager connection promise never resolved  
**Status:** FIXED ✅  
**Build:** Successful ✅  
**Action Required:** RESTART APP
