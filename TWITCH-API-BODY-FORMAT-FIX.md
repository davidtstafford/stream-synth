# Twitch API Request Body Format Fix

## Problem
The Twitch Helix API endpoints for moderation require the request body to have a `data` wrapper object, but we're sending it without the wrapper.

## Current (Wrong) Format
```json
{
  "user_id": "123456",
  "reason": "spam"
}
```

## Correct Format
```json
{
  "data": {
    "user_id": "123456",
    "reason": "spam"
  }
}
```

## API Endpoints Affected

### 1. Ban User - POST `/moderation/bans`
**Current**:
```javascript
body: JSON.stringify({
  user_id: userId,
  reason: reason || undefined
})
```

**Fixed**:
```javascript
body: JSON.stringify({
  data: {
    user_id: userId,
    reason: reason || undefined
  }
})
```

### 2. Timeout User - POST `/moderation/bans`
**Current**:
```javascript
body: JSON.stringify({
  user_id: userId,
  duration: durationSeconds,
  reason: reason || undefined
})
```

**Fixed**:
```javascript
body: JSON.stringify({
  data: {
    user_id: userId,
    duration: durationSeconds,
    reason: reason || undefined
  }
})
```

### 3. Add Moderator - POST `/moderation/moderators`
**Current**:
```javascript
body: JSON.stringify({
  user_id: userId
})
```

**Fixed**:
```javascript
body: JSON.stringify({
  data: {
    user_id: userId
  }
})
```

### 4. Add VIP - POST `/channels/vips`
**File**: `src/backend/services/viewer-moderation-actions.ts`

**Query Parameters**: `?broadcaster_id={id}&user_id={id}`  
**Body**: Empty or none (uses query params instead)

Actually checking Twitch docs... VIP endpoints use query parameters, not body!

## Actions That Need NO Changes

### Unban - DELETE `/moderation/bans`
Uses query parameters only - NO BODY

### Remove Moderator - DELETE `/moderation/moderators`
Uses query parameters only - NO BODY

### Add/Remove VIP - POST/DELETE `/channels/vips`  
Uses query parameters only - NO BODY

## Summary of Changes Needed

✅ **Ban User**: Add `data` wrapper  
✅ **Timeout User**: Add `data` wrapper  
✅ **Add Moderator**: Add `data` wrapper  
❌ **Unban**: No change needed  
❌ **Remove Moderator**: No change needed  
❌ **Add VIP**: No change needed (uses query params)  
❌ **Remove VIP**: No change needed (uses query params)

Wait, let me check the Twitch API docs again...

## Actually, After Checking Twitch API Documentation:

The Ban/Timeout endpoint DOES use `data` wrapper according to new Helix API format.

But Add Moderator and VIP endpoints might use **query parameters** for `user_id` instead!

Let me verify each endpoint...
