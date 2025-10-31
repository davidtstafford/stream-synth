# 🔧 SCOPE FIX - channel:moderate Required

## The Root Cause

The Twitch EventSub documentation clearly states:

> **`channel.ban` and `channel.unban` events require `channel:moderate` scope**

We were using the **WRONG scope**:
- ❌ `moderator:read:banned_users` (was used)
- ✅ `channel:moderate` (correct scope)

## What Was Fixed

**File:** `src/backend/auth/twitch-oauth.ts`

```typescript
// BEFORE (WRONG):
'moderator:read:banned_users',  // ❌ This doesn't work for EventSub ban/unban

// AFTER (CORRECT):
'channel:moderate',             // ✅ Required for channel.ban and channel.unban events
```

## What You Need to Do

### Step 1: Close the App
Close Stream Synth completely.

### Step 2: Click "Forget Credentials"
1. Launch Stream Synth
2. Click **"Forget Credentials"** button
3. Confirm the dialog

### Step 3: Re-Authorize with Correct Scope
1. Click **"Connect"**
2. You should see the Twitch OAuth page with a **NEW permission**:
   - ✅ **"Manage your channel's moderation settings including bans, timeouts, and automod"**

This is the `channel:moderate` scope!

### Step 4: Test
After connecting:
```
/ban eggieberttestacc test ban
```

**Expected console output:**
```
[EventSub] ✅ Subscription created: channel.ban
[EventSub] ✅ Subscription created: channel.unban
[EventRouter] Received event: channel.ban
```

**Expected in Viewers screen:**
- 🔴 Red "BANNED" badge next to eggieberttestacc
- Hover shows reason: "test ban"

## Twitch Documentation Reference

From Twitch EventSub docs:

### channel.ban
> **Authorization**: Must have `channel:moderate` scope.

**Condition:**
```json
{
  "broadcaster_user_id": "1337"
}
```

**NO `moderator_user_id` needed in condition!**

### channel.unban
> **Authorization**: Must have `channel:moderate` scope.

**Condition:**
```json
{
  "broadcaster_user_id": "1337"
}
```

## Additional Fix Needed?

Looking at the Twitch docs, the **condition** for ban/unban events should **ONLY** have `broadcaster_user_id`, NOT `moderator_user_id`.

Let me check if we're sending the wrong condition...

---

**Build Status:** ✅ Compiled successfully
**Next Step:** Forget credentials → Re-authorize → Test
