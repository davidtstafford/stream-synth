# Auto-Reconnect Testing Guide

## ✅ What's Been Implemented

### Features Added:

1. **Auto-Save on Connection**
   - OAuth token saved (encrypted)
   - Session created in database
   - Settings saved for reconnect

2. **Auto-Reconnect on Startup**
   - Checks for saved session
   - Validates token with Twitch
   - Auto-connects to WebSocket
   - Restores monitored channel

3. **Event Subscription Persistence**
   - Saves each event toggle to database
   - Restores subscriptions on reconnect
   - Per user/channel preferences

4. **Channel Switching**
   - Updates saved channel when changed
   - Maintains separate preferences per channel

## 🧪 Testing Steps

### Test 1: First Time Login
1. ✅ Launch app - should show login screen (no saved session)
2. ✅ Click "Connect to Twitch"
3. ✅ Authorize the app
4. ✅ Should auto-connect to your own channel
5. ✅ Event subscriptions show up
6. ✅ Toggle some events on/off

**Expected Console Output:**
```
Initializing database at: ~/Library/Application Support/stream-synth/stream-synth.db
Database migrations completed
Database initialized successfully
✅ Subscribed to channel.chat.message
```

### Test 2: Auto-Reconnect
1. ✅ Close the app (Cmd+Q or click X)
2. ✅ Relaunch the app
3. ✅ Should show "Restoring previous session..." message
4. ✅ Should auto-login without OAuth popup
5. ✅ Should connect to WebSocket automatically
6. ✅ Should restore your event subscriptions

**Expected Console Output:**
```
Restoring saved events: ["channel.follow", "channel.subscribe", ...]
✅ Subscribed to channel.follow
✅ Subscribed to channel.subscribe
```

### Test 3: Token Expiration
1. ✅ Manually invalidate token (or wait ~60 days for real expiration)
2. ✅ Relaunch app
3. ✅ Should show "Previous session expired. Please log in again."
4. ✅ Should clear saved state
5. ✅ Should show login screen

### Test 4: Channel Switching
1. ✅ Login as normal
2. ✅ Click "Change Channel"
3. ✅ Search for another channel
4. ✅ Select it
5. ✅ Toggle different events for this channel
6. ✅ Close and relaunch app
7. ✅ Should restore the last selected channel
8. ✅ Should restore events for that specific channel

### Test 5: Broadcaster vs Moderator
1. ✅ Login and monitor your own channel
2. ✅ Enable some broadcaster-only events (polls, predictions, etc.)
3. ✅ Close app
4. ✅ Relaunch - should restore broadcaster events (green labels)
5. ✅ Click "Change Channel" and select someone else's channel
6. ✅ Broadcaster events should be disabled (red labels, 50% opacity)
7. ✅ Close and relaunch
8. ✅ Should reconnect to the other person's channel
9. ✅ Broadcaster events still disabled

## 🗄️ Database Files

**SQLite Database:**
```
~/Library/Application Support/stream-synth/stream-synth.db
```

**Encrypted Tokens:**
```
~/Library/Application Support/stream-synth/secure-tokens.json
```

You can inspect the database with:
```bash
sqlite3 ~/Library/Application\ Support/stream-synth/stream-synth.db

# View settings
SELECT * FROM app_settings;

# View current session
SELECT * FROM connection_sessions WHERE is_current = 1;

# View event subscriptions
SELECT * FROM event_subscriptions;

# View recent sessions
SELECT * FROM connection_sessions ORDER BY connected_at DESC LIMIT 5;
```

## 🔍 Debugging

**Check Console for:**
- "Restoring previous session..." - Auto-reconnect started
- "No saved session found" - First time login
- "Token expired" - Need to re-authenticate
- "Restoring saved events: [...]" - Event preferences loaded
- "✅ Subscribed to X" - Event successfully subscribed

**Common Issues:**

1. **"No module named 'better-sqlite3'"**
   - Run: `npx electron-rebuild -f -w better-sqlite3`

2. **Token keeps expiring**
   - Twitch OAuth tokens expire after ~60 days
   - App will auto-clear and ask for re-login

3. **Events not restoring**
   - Check database: `SELECT * FROM event_subscriptions;`
   - Make sure sessionId is set before trying to restore

4. **Auto-reconnect loops**
   - Check token validity in database
   - May need to clear: `DELETE FROM oauth_tokens;`

## 🎯 Success Criteria

✅ **Auto-Reconnect Works When:**
- App launches → auto-connects without login
- Shows "Reconnected as [username]!"
- Event subscriptions automatically restored
- No OAuth popup shown

✅ **Token Management Works When:**
- Expired tokens are detected and cleared
- Invalid tokens trigger re-login
- Tokens persist across app restarts

✅ **State Persistence Works When:**
- Event preferences saved on toggle
- Channel selection saved when changed
- Session history tracked in database
- Each user/channel has separate preferences

## 📤 Future Enhancements

Ideas for later:
- [ ] "Recent Channels" dropdown (already have session history!)
- [ ] Export settings button
- [ ] Import backup feature
- [ ] "Remember me" checkbox (to opt-out of auto-reconnect)
- [ ] Token refresh before expiration
- [ ] Multiple account support

---

**Status:** Auto-reconnect fully implemented ✅  
**Ready for:** Production testing and user feedback
