# Channel Ban/Unban Subscription Fix

## Problem Identified

When you banned `eggieberttestacc`, the application received a `channel.chat.clear_user_messages` event but **NOT** the `channel.ban` event needed to track moderation status.

### Root Cause

The backend `EventSubManager` (`src/backend/services/eventsub-manager.ts`) had a **hardcoded list of event subscriptions** that did NOT include `channel.ban` or `channel.unban`:

```typescript
// OLD CODE (Lines 264-272)
const eventTypes = [
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.end',
  'channel.subscription.gift',
  'channel.moderator.add',    // ✅ Present
  'channel.moderator.remove',  // ✅ Present
  'channel.vip.add',          // ✅ Present
  'channel.vip.remove',       // ✅ Present
  // ❌ channel.ban MISSING
  // ❌ channel.unban MISSING
];
```

**Why this was confusing:**
- The frontend had `channel.ban` and `channel.unban` in its `DEFAULT_SUBSCRIPTIONS` array
- But the **backend** creates the actual subscriptions, not the frontend
- The two lists were out of sync

## Fix Applied

### 1. Added Ban/Unban to Event Types List

**File:** `src/backend/services/eventsub-manager.ts`  
**Lines:** 264-274

```typescript
// NEW CODE
const eventTypes = [
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.end',
  'channel.subscription.gift',
  'channel.ban',              // ✅ ADDED
  'channel.unban',            // ✅ ADDED
  'channel.moderator.add',
  'channel.moderator.remove',
  'channel.vip.add',
  'channel.vip.remove',
];
```

### 2. Added Required Condition for Ban/Unban Events

**File:** `src/backend/services/eventsub-manager.ts`  
**Lines:** 295-304

Both `channel.ban` and `channel.unban` require the `moderator_user_id` condition (same as `channel.follow`):

```typescript
// Build condition based on event type
const condition: any = { broadcaster_user_id: this.channelId };

if (eventType === 'channel.follow') {
  condition.moderator_user_id = this.channelId;
}

// Ban/unban events require moderator_user_id
if (eventType === 'channel.ban' || eventType === 'channel.unban') {
  condition.moderator_user_id = this.channelId;  // ✅ ADDED
}
```

## Expected Behavior After Fix

When you restart the app, you should see:

### In Console Logs
```
[EventSub] Subscribing to 10 event types
[EventSub] Creating subscription attempt 1/3 for channel.ban
[EventSub] Subscription created: {data: [...]}
[EventSub] Creating subscription attempt 1/3 for channel.unban
[EventSub] Subscription created: {data: [...]}
```

### When You Ban a User
1. **`channel.ban` event received** with full ban details
2. **Moderation handler triggered** to store ban in database
3. **Viewers screen auto-updates** showing red "BANNED" badge
4. **Events screen shows** the ban event

### When You Unban a User
1. **`channel.unban` event received**
2. **Moderation status cleared** in database
3. **Viewers screen auto-updates** removing the badge

## Remaining Issue

⚠️ **OAuth Token Scope**: If you still see 403 errors after restart, you need to re-authenticate:

1. **Logout** from the app
2. **Login again** to get fresh token with `moderator:read:banned_users` scope
3. The scope is already in the code at `src/backend/auth/twitch-oauth.ts:20`

## Testing Steps

1. **Restart the app** (close and reopen)
2. Check console for subscription creation logs
3. **Ban a test user** (e.g., your test account)
4. Verify:
   - ✅ `channel.ban` event appears in console
   - ✅ Events screen shows the ban
   - ✅ Viewers screen shows red "BANNED" badge
5. **Unban the test user**
6. Verify:
   - ✅ `channel.unban` event appears in console
   - ✅ Badge disappears from Viewers screen

## Files Modified

- ✅ `src/backend/services/eventsub-manager.ts` (Lines 264-274, 295-304)
- ✅ `src/backend/services/eventsub-event-router.ts` (Removed incomplete fallback)

## Build Status

✅ **Build successful** - No TypeScript errors  
✅ **Webpack compiled** - 431 KiB output  
✅ **Ready to test** - Restart required

---

**Date:** October 31, 2025  
**Issue:** Missing channel.ban/unban subscriptions in backend  
**Status:** FIXED ✅  
**Next Step:** Restart app and test banning/unbanning users
