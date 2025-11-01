# Channel Ban/Timeout Unified Handler Fix

## Critical Discovery

According to Twitch EventSub documentation:

> **"channel.ban will notify on timeouts as well as bans"**

This means **ONE subscription** (`channel.ban`) covers **BOTH**:
- ✅ Permanent bans (`is_permanent: true`)
- ✅ Temporary timeouts (`is_permanent: false`)

## Problems Fixed

### 1. Missing Subscription (Primary Issue)
**File:** `src/backend/services/eventsub-manager.ts`

The backend wasn't subscribing to `channel.ban` or `channel.unban` at all!

**Fixed by adding:**
```typescript
const eventTypes = [
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.end',
  'channel.subscription.gift',
  'channel.ban',              // ✅ ADDED
  'channel.unban',            // ✅ ADDED
  'channel.moderator.add',
  // ...
];
```

**And adding required condition:**
```typescript
// Ban/unban events require moderator_user_id
if (eventType === 'channel.ban' || eventType === 'channel.unban') {
  condition.moderator_user_id = this.channelId;
}
```

### 2. Ban Handler Didn't Distinguish Bans from Timeouts
**File:** `src/backend/services/eventsub-event-router.ts`

The `handleBanEvent` was treating ALL `channel.ban` events as permanent bans, ignoring timeouts.

**Fixed by:**
- ✅ Checking `is_permanent` field to distinguish ban vs timeout
- ✅ Extracting `ends_at` for timeout expiration
- ✅ Calculating `duration_seconds` for timeouts
- ✅ Recording correct `action` type ('ban' or 'timeout')

## Twitch EventSub Payload Structure

### channel.ban Event Payload

```json
{
  "subscription": { /* ... */ },
  "event": {
    "user_id": "1234",
    "user_login": "cool_user",
    "user_name": "Cool_User",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cooler_user",
    "broadcaster_user_name": "Cooler_User",
    "moderator_user_id": "1339",
    "moderator_user_login": "mod_user",
    "moderator_user_name": "Mod_User",
    "reason": "Offensive language",
    "banned_at": "2020-07-15T18:15:11.17106713Z",
    "ends_at": "2020-07-15T18:16:11.17106713Z",      // ⏱️ Present for TIMEOUTS
    "is_permanent": false                             // 🔑 KEY FIELD
  }
}
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `is_permanent` | boolean | **`true`** = Ban, **`false`** = Timeout |
| `ends_at` | ISO 8601 | Timeout expiration time (only for timeouts) |
| `banned_at` | ISO 8601 | When the action occurred |
| `reason` | string | Moderator's reason (optional) |

## Updated Handler Logic

### Before (Wrong ❌)
```typescript
// Always treated as 'ban'
this.moderationHistoryRepo.record({
  action: 'ban',  // ❌ Always 'ban'
  // Missing duration_seconds
});
```

### After (Correct ✅)
```typescript
const isPermanent = event.is_permanent ?? true;
const actionType = isPermanent ? 'ban' : 'timeout';

// Calculate duration for timeouts
let durationSeconds: number | undefined;
if (!isPermanent && endsAt && bannedAt) {
  const start = new Date(bannedAt).getTime();
  const end = new Date(endsAt).getTime();
  durationSeconds = Math.floor((end - start) / 1000);
}

this.moderationHistoryRepo.record({
  action: actionType,          // ✅ 'ban' or 'timeout'
  duration_seconds: durationSeconds,  // ✅ Timeout duration
  // ...
});
```

## Database Storage

The `moderation_history` table now correctly stores:

### Permanent Ban
```sql
INSERT INTO moderation_history (
  action,              -- 'ban'
  duration_seconds,    -- NULL
  reason,              -- 'Offensive language'
  action_at            -- '2020-07-15T18:15:11Z'
)
```

### Temporary Timeout (60 seconds)
```sql
INSERT INTO moderation_history (
  action,              -- 'timeout'
  duration_seconds,    -- 60
  reason,              -- 'Slow down'
  action_at            -- '2020-07-15T18:15:11Z'
)
```

## UI Display Logic

The `current_moderation_status` VIEW calculates display status:

```sql
CASE 
  WHEN mh.action = 'ban' THEN 'banned'
  WHEN mh.action = 'timeout' THEN 'timed_out'
  WHEN mh.action = 'unban' THEN 'active'
  WHEN mh.action = 'timeout_lifted' THEN 'active'
END AS current_status
```

And expiration for timeouts:

```sql
CASE 
  WHEN mh.action = 'timeout' THEN 
    datetime(mh.action_at, '+' || mh.duration_seconds || ' seconds')
  ELSE NULL
END AS timeout_expires_at
```

## Frontend IPC Event

The frontend now receives detailed moderation events:

```typescript
window.ipc.on('eventsub:moderation-changed', (event) => {
  console.log({
    eventType: 'timeout',           // or 'ban'
    userId: '1234',
    userLogin: 'cool_user',
    isPermanent: false,             // ✅ NEW
    durationSeconds: 60,            // ✅ NEW
    expiresAt: '2020-07-15T18:16:11.17106713Z', // ✅ NEW
    reason: 'Slow down'
  });
});
```

## Testing Scenarios

### Test 1: Permanent Ban
1. **Action:** `/ban @eggieberttestacc Offensive language`
2. **Expected Event:**
   ```json
   {
     "is_permanent": true,
     "ends_at": null,
     "reason": "Offensive language"
   }
   ```
3. **Expected Database:**
   - `action`: `'ban'`
   - `duration_seconds`: `NULL`
   - `moderation_status`: `'banned'`
   - `moderation_expires_at`: `NULL`
4. **Expected UI:** Red "BANNED" badge (no expiration)

### Test 2: 60-Second Timeout
1. **Action:** `/timeout @eggieberttestacc 60 Slow down`
2. **Expected Event:**
   ```json
   {
     "is_permanent": false,
     "ends_at": "2025-10-31T17:10:11Z",
     "banned_at": "2025-10-31T17:09:11Z",
     "reason": "Slow down"
   }
   ```
3. **Expected Database:**
   - `action`: `'timeout'`
   - `duration_seconds`: `60`
   - `moderation_status`: `'timed_out'`
   - `moderation_expires_at`: `'2025-10-31T17:10:11Z'`
4. **Expected UI:** Orange "TIMED OUT" badge with "Expires in 60s" tooltip

### Test 3: Unban
1. **Action:** `/unban @eggieberttestacc`
2. **Expected Event:** `channel.unban`
3. **Expected Database:**
   - `action`: `'unban'`
   - `moderation_status`: `'active'`
4. **Expected UI:** Badge removed

## Files Modified

1. ✅ **`src/backend/services/eventsub-manager.ts`**
   - Lines 264-274: Added `channel.ban` and `channel.unban` to subscription list
   - Lines 300-303: Added `moderator_user_id` condition

2. ✅ **`src/backend/services/eventsub-event-router.ts`**
   - Lines 461-542: Completely rewrote `handleBanEvent` to:
     - Check `is_permanent` field
     - Calculate `duration_seconds` for timeouts
     - Record correct `action` type
     - Send detailed IPC event to frontend

## Next Steps

1. **Restart the app** - New subscriptions created on initialization
2. **Check console** - Should see:
   ```
   [EventSub] Creating subscription attempt 1/3 for channel.ban
   [EventSub] Subscription created
   ```
3. **Test timeout** - `/timeout @user 60`
4. **Test ban** - `/ban @user`
5. **Test unban** - `/unban @user`

## Expected Console Output

### Timeout Event
```
[EventRouter] Processing timeout event: eggieberttestacc
[EventRouter] ✓ timeout event recorded for: eggieberttestacc (60s)
```

### Ban Event
```
[EventRouter] Processing ban event: eggieberttestacc
[EventRouter] ✓ ban event recorded for: eggieberttestacc (permanent)
```

---

**Date:** October 31, 2025  
**Issue:** channel.ban not subscribed + handler didn't distinguish timeouts  
**Status:** FIXED ✅  
**Build:** Successful ✅  
**Ready:** Restart required to test
