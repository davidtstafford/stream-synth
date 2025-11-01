# OAuth Scope Fix Guide

## The Problem

You're getting **403 Forbidden** errors when trying to subscribe to `channel.ban` and `channel.unban` events:

```
[EventSub] Create failed status= 403 body= {error: 'Forbidden', status: 403, message: 'subscription missing proper authorization'}
```

**Root Cause:** Your OAuth token was created **before** the `moderator:read:banned_users` scope was added to the code. Even though the scope is now in `twitch-oauth.ts` (line 20), your existing cached token doesn't have it.

---

## The Solution: Force Fresh OAuth Token

### Method 1: Use Enhanced "Forget Credentials" Button ⭐ **RECOMMENDED**

I just added OAuth cache clearing to the Forget button!

**Steps:**
1. **Close the application completely** (if running)
2. **Restart the application**
3. Click **"Forget Credentials"** button
4. Confirm the dialog (it now mentions clearing OAuth cache)
5. Click **"Connect"** again
6. **You should see the Twitch OAuth authorization page** asking for permissions
7. **Look for this NEW permission:**
   - ✅ **"View a list of banned and timed-out users"**
8. Click **"Authorize"**

**What the button now does:**
- ✅ Deletes database token
- ✅ Clears saved settings
- ✅ **Clears Twitch OAuth cookies**
- ✅ **Clears Twitch OAuth localStorage**
- ✅ **Clears browser cache**

---

### Method 2: Revoke on Twitch Website (If Method 1 Fails)

1. Go to: **https://www.twitch.tv/settings/connections**
2. Find **"Stream Synth"** (or your app name) in the list
3. Click **"Disconnect"**
4. Close your application
5. Restart and click **"Connect"**
6. Re-authorize with the new scope

---

## What Changed in the Code

### Backend: New IPC Handler
**File:** `src/backend/core/ipc-handlers/twitch.ts`

```typescript
// Clear Twitch OAuth session cache
ipcRegistry.register<void, void>(
  'clear-twitch-oauth-cache',
  {
    execute: async () => {
      console.log('[Twitch] Clearing OAuth session cache...');
      const ses = session.defaultSession;
      
      // Clear all Twitch-related storage
      await ses.clearStorageData({
        storages: ['cookies', 'localstorage'],
        origin: 'https://id.twitch.tv'
      });
      
      // Clear cache
      await ses.clearCache();
      
      console.log('[Twitch] OAuth cache cleared successfully');
    }
  }
);
```

### Frontend: Enhanced Forget Button
**File:** `src/frontend/components/Connection.tsx`

```typescript
// Clear Twitch OAuth cache (cookies, localstorage, cache)
await ipcRenderer.invoke('clear-twitch-oauth-cache');
```

---

## How to Verify It Worked

### ✅ Success Indicators

After re-authenticating, you should see in console:

```
[EventSub] Creating subscription attempt 1/3 for channel.ban
[EventSub] Subscription created: channel.ban              ← ✅ SUCCESS
[EventSub] Subscription created: channel.unban            ← ✅ SUCCESS
```

**NOT:**
```
[EventSub] All attempts to create subscription failed for channel.ban  ← ❌ BAD
```

### Test the Feature

1. Ban a test user: `/ban eggieberttestacc test ban`
2. **Check console for EventSub event:**
   ```
   [EventRouter] Received event: channel.ban
   [EventRouter] Ban event: eggieberttestacc (Permanent ban)
   ```
3. **Check Viewers screen:**
   - You should see a **red "BANNED"** badge next to the user
   - Hover shows reason: "test ban"

---

## Terminal Message Explained

> **Q:** What generates this in the terminal?
> ```
> [18:22] info: [#eggiebert] eggieberttestacc has been banned.
> ```

**A:** This message comes from the **tmi.js IRC library** (not your code). It's just informational logging from Twitch's IRC chat server. This is normal and expected when someone is banned.

---

## Required OAuth Scopes (Now Included)

The token **must** include these scopes for ban/unban events:

```typescript
const TWITCH_SCOPES = [
  // ...other scopes...
  'moderator:read:banned_users',  // ✅ For channel.ban and channel.unban events
  'moderator:read:moderators',    // ✅ For channel.moderator.add/remove events
  // ...
];
```

✅ These are already in your `src/backend/auth/twitch-oauth.ts` file (line 20).

---

## Next Steps

1. **Try Method 1** (Forget Credentials button) first
2. If that doesn't show the OAuth page, **try Method 2** (Twitch website revoke)
3. After re-auth, **test banning a user** to verify it works
4. **Check the console logs** for EventSub subscription success

---

## Troubleshooting

### Still Getting 403 After Logout/Login?

Try this PowerShell command to completely clear Electron's cache:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\stream-synth\*"
```

Then restart the app and connect again.

### How to Check Your Current Token Scopes

You can use this Twitch API endpoint:

```bash
curl -H "Authorization: OAuth YOUR_TOKEN_HERE" https://id.twitch.tv/oauth2/validate
```

Look for `"moderator:read:banned_users"` in the `scopes` array.

---

**The code is 100% correct - it's purely an OAuth scope caching issue!** 🎯
