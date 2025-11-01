# Unfollow Events - Why They Don't Appear

## The Issue
You unfollowed and refollowed a channel, but only the follow event appeared in the Events screen.

## Why Unfollows Don't Show Up

### Twitch EventSub Limitation
**Twitch does NOT provide an "unfollow" event type in EventSub.**

Available follower-related events:
- ✅ `channel.follow` - Fires when someone follows
- ❌ `channel.unfollow` - **DOES NOT EXIST**

### Official Twitch Documentation
From [Twitch EventSub Documentation](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/):

> **channel.follow**
> A specified channel receives a follow.

There is no corresponding unfollow event.

## Why This Limitation Exists

1. **Privacy Concerns** - Twitch considers unfollows to be private user actions
2. **API Design** - EventSub is designed for real-time positive engagement events
3. **Rate Limiting** - Unfollow events could be spammy and expensive to process

## How to Detect Unfollows

### Option 1: Periodic Polling (Currently Implemented)
The app already has a follower polling system that runs every 2 hours:

**File:** `src/backend/services/polling-manager.ts`
```typescript
{
  type: 'followers',
  interval: 7200000, // 2 hours
  enabled: true
}
```

**What it does:**
- Fetches current followers list from Twitch API
- Compares with database
- Detects who unfollowed by diff
- Records unfollow events

**Limitation:** Only detects unfollows every 2 hours, not in real-time.

### Option 2: Manual Refresh
You can manually trigger a follower sync:

1. Go to **Viewers** screen
2. Click "Sync from Twitch" button
3. This will update all follower statuses

### Option 3: Increase Polling Frequency
You can make unfollow detection more frequent:

**File:** `src/backend/services/polling-manager.ts`
```typescript
{
  type: 'followers',
  interval: 300000, // 5 minutes instead of 2 hours
  enabled: true
}
```

**Trade-off:** More API calls = higher rate limit usage

## What Gets Recorded

When the polling system detects an unfollow:

1. **follower_history table**
   ```sql
   INSERT INTO follower_history (
     viewer_id,
     action,        -- 'unfollow'
     followed_at,   -- NULL
     unfollowed_at  -- Current timestamp
   )
   ```

2. **events table**
   ```sql
   INSERT INTO events (
     event_type,  -- 'follower.unfollow' (custom event)
     channel_id,
     viewer_id
   )
   ```

3. **Viewer status updated**
   ```sql
   UPDATE viewers
   SET is_follower = 0
   WHERE id = ?
   ```

## Current Implementation Status

✅ **Follower polling is active** - Runs every 2 hours
✅ **Unfollow detection works** - Via polling comparison
✅ **Events are recorded** - In database
❌ **Not real-time** - Up to 2 hour delay

## Testing Unfollow Detection

1. **Unfollow the channel**
2. **Wait 2 hours** OR **manually trigger sync**:
   - Go to Viewers screen
   - Click "Sync from Twitch"
3. **Check Events screen** - Should see unfollow event
4. **Check Viewer** - `is_follower` should be `false`

## Alternative: WebSocket Follower Monitoring (Advanced)

Some third-party services provide follower webhooks, but they require:
- External service subscription (e.g., StreamLabs, StreamElements)
- Additional API integration
- May violate Twitch ToS

**Not recommended.**

## Summary

| Feature | Real-time? | Method |
|---------|-----------|---------|
| **Follows** | ✅ Yes | EventSub `channel.follow` |
| **Unfollows** | ❌ No | Polling every 2 hours |

**This is a Twitch platform limitation, not an app bug.**

## Recommendations

### For Most Users
Keep the current 2-hour polling interval. Unfollows aren't typically time-sensitive.

### For Power Users
Reduce polling interval to 5-15 minutes for faster unfollow detection:

```typescript
// src/backend/services/polling-manager.ts
{
  type: 'followers',
  interval: 300000, // 5 minutes
  enabled: true
}
```

### For Real-time Needs
Consider that unfollows are rarely actionable in real-time. The 2-hour delay is acceptable for most use cases.

---

**Last Updated:** November 1, 2025  
**Status:** ⚠️ PLATFORM LIMITATION - WORKING AS DESIGNED
