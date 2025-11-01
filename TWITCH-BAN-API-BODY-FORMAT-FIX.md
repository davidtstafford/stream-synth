# CRITICAL FIX: Twitch Ban API Body Format

## Error Received
```
[ModActions] Banning user: eggieberttestacc (1362524977) in channel 131323084
[ModActions] Ban response status: 400
[ModActions] ✗ Ban failed: {
  error: 'Bad Request',
  status: 400,
  message: 'Missing required parameter "user_id"'
}
```

## Root Cause
The Twitch Helix API `/moderation/bans` endpoint requires the request body to have a `data` wrapper object.

## Current Code (WRONG)
```typescript
body: JSON.stringify({
  user_id: userId,
  reason: reason || undefined
})
```

## Fixed Code (CORRECT)
```typescript
body: JSON.stringify({
  data: {
    user_id: userId,
    ...(reason && { reason }) // Only include if reason exists
  }
})
```

## Why This Matters
- Twitch changed their API format
- The `data` wrapper is now REQUIRED
- Without it, the API returns 400: "Missing required parameter"
- Even though we ARE sending `user_id`, it's not in the expected location

## Files to Fix
1. `src/backend/services/viewer-moderation-actions.ts`
   - `banUser()` method - line ~43
   - `timeoutUser()` method - line ~149

## Testing
After fix, you should see:
```
[ModActions] Banning user: TestUser (123456) in channel 987654
[ModActions] Request body: {"data":{"user_id":"123456","reason":"test"}}
[ModActions] Ban response status: 204
[ModActions] ✓ Ban successful
```

## Implementation
The fix needs to wrap the body data like this:

```typescript
const bodyData: any = { user_id: userId };
if (reason) {
  bodyData.reason = reason;
}

body: JSON.stringify({ data: bodyData })
```

Or more concisely:
```typescript
body: JSON.stringify({
  data: {
    user_id: userId,
    ...(reason && { reason })
  }
})
```
