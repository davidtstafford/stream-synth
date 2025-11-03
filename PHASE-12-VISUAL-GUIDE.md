# 🎬 Phase 12: Visual Testing Guide

**What Success Looks Like**

---

## 📺 Browser Source Setup

### Step 1: Open Browser Source
```
URL: http://localhost:7474/alert
```

**What You Should See:**

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│         (Blank transparent page)        │
│                                         │
│                                         │
└─────────────────────────────────────────┘

Browser Console:
✅ [BrowserSource] Initializing...
✅ [BrowserSource] Listening to channel: "default"
✅ [BrowserSource] Connected to server
✅ [BrowserSource] Received client ID: 12345
```

---

### Step 2: Debug Mode (Optional)
```
URL: http://localhost:7474/alert?debug=true
```

**What You Should See:**

```
┌─────────────────────────────────────────┐
│ ● Connected                             │ ← Green dot
│ Alerts Received: 0                      │
│ Queue Length: 0                         │
│ Client ID: abc123                       │
│                                         │
│                                         │
│         (Rest is blank)                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔔 Alert Appearance

### When Event Triggers

**Browser Source Changes From:**
```
┌─────────────────────────────────────────┐
│                                         │
│         (Empty/transparent)             │
│                                         │
└─────────────────────────────────────────┘
```

**To:**
```
┌─────────────────────────────────────────┐
│                                         │
│      🎉 JohnDoe just followed! ❤️      │ ← Alert text
│                                         │
└─────────────────────────────────────────┘
```

**Console Output:**
```
[BrowserSource] Alert received: channel.follow
[BrowserSource] Processing alert: JohnDoe just followed!
[BrowserSource] Added to queue (length: 1)
[BrowserSource] Displaying alert...
```

**After Duration (e.g., 5 seconds):**
```
┌─────────────────────────────────────────┐
│                                         │
│         (Fades out)                     │
│                                         │
└─────────────────────────────────────────┘

Console:
[BrowserSource] Alert dismissed
[BrowserSource] Queue now empty
```

---

## 🎮 App Console Output

### On Startup

**Expected Logs:**
```
[Main] Starting Stream Synth...
[Database] Running migrations...
[Database] Current schema version: 15
[Database] Migrations complete

[BrowserSourceServer] Initializing server on port 7474...
[BrowserSourceServer] HTTP server started
[BrowserSourceServer] Socket.IO ready
[BrowserSourceServer] Server started on port 7474

[EventActionProcessor] Initialized
[EventActionProcessor] Browser source server connected

[EventSubEventRouter] Initialized
[EventSubEventRouter] Event action processor connected

[Main] Stream Synth ready!
```

---

### When Browser Source Connects

**Expected Logs:**
```
[BrowserSourceServer] New client connected: abc123
[BrowserSourceServer] Total clients: 1
```

---

### When Event Occurs

**Expected Flow:**
```
[EventSubManager] Received event: channel.follow
↓
[EventSubEventRouter] Processing follow event: johndoe
↓
[EventSubEventRouter] Creating viewer record
↓
[EventSubEventRouter] Recording to follower_history
↓
[EventSubEventRouter] Calling storeAndEmitEvent()
↓
[EventsRepository] Storing event type: channel.follow
↓
[EventSubEventRouter→EventActions] Processing event action
↓
[EventActionProcessor] Processing event: channel.follow
↓
[EventActionProcessor] Found action config (enabled: true)
↓
[EventActionProcessor] Formatting event with shared formatter
↓
[EventActionProcessor] Processing template: {{display_name}} just followed!
↓
[EventActionProcessor] Template result: JohnDoe just followed!
↓
[EventActionProcessor] Building alert payload
↓
[EventActionProcessor] Emitting to browser source (channel: default)
↓
[BrowserSourceServer] Emitting alert to 1 client(s)
```

---

## ✅ Success Indicators

### Build
```
✅ TypeScript compilation: 0 errors
✅ Webpack bundle: ~569 KiB
✅ All files copied successfully
```

### Startup
```
✅ Browser source server starts on port 7474
✅ EventActionProcessor initializes
✅ EventSub integration connected
✅ No errors in console
```

### Browser Source
```
✅ Page loads (blank is correct)
✅ Socket.IO connects
✅ No JavaScript errors
✅ Console shows "Connected to server"
```

### Alert Flow
```
✅ Event triggers → Alert appears
✅ Template variables replaced
✅ Alert displays with styling
✅ Alert auto-dismisses
✅ Queue processes correctly
```

---

## ❌ Common Error Patterns

### Error: "Port 7474 already in use"
```
❌ [BrowserSourceServer] Error: listen EADDRINUSE: port 7474
```
**Solution:** Close other Stream Synth instances or change port

---

### Error: "Cannot find module"
```
❌ Error: Cannot find module './event-action-processor'
```
**Solution:** Run `npm run build` again

---

### Error: "Socket disconnected"
```
❌ [BrowserSource] Socket disconnected
❌ [BrowserSource] Attempting reconnection...
```
**Solution:** Check if app is still running

---

### Warning: "File not found"
```
⚠️ [EventActionProcessor] Sound file not found: C:/path/to/sound.mp3
```
**Impact:** Alert still appears, just without sound (this is OK)

---

### Error: "Template variable not replaced"
**Before Fix:**
```
Template: {{display_name}} just followed!
Output:   {{display_name}} just followed!  ❌
```

**After Fix (Current):**
```
Template: {{display_name}} just followed!
Output:   JohnDoe just followed!  ✅
```

---

## 🔍 Debug Checklist

If alerts aren't appearing:

1. **Check App Console**
   - [ ] Browser source server started?
   - [ ] EventActionProcessor initialized?
   - [ ] Any errors on startup?

2. **Check Browser Console**
   - [ ] Socket.IO connected?
   - [ ] Any JavaScript errors?
   - [ ] Alert event received?

3. **Check Database**
   - [ ] event_actions table exists?
   - [ ] Action for event_type enabled?
   - [ ] browser_source_channel matches URL parameter?

4. **Check EventSub**
   - [ ] Connected to Twitch?
   - [ ] Subscriptions active?
   - [ ] Event actually triggered?

---

## 📸 Screenshots to Take

**For documentation:**

1. Browser source page (blank)
2. Browser source with debug UI
3. Alert appearing in browser source
4. App console showing successful flow
5. Browser console showing connection

---

## 🎯 Test Scenarios

### Scenario 1: First Time Setup
1. Fresh install
2. Start app
3. Open browser source
4. Trigger event
5. **Expected:** Alert appears

### Scenario 2: Multiple Browser Sources
1. Open 2 browser tabs
2. Tab 1: `?channel=default`
3. Tab 2: `?channel=test`
4. Trigger event with channel=test
5. **Expected:** Alert only in Tab 2

### Scenario 3: Rapid Fire
1. Trigger 5 events quickly
2. **Expected:** All 5 alerts queue and display in order

### Scenario 4: Reconnection
1. Open browser source
2. Stop app
3. Start app again
4. **Expected:** Browser source reconnects automatically

---

## ✅ Phase 12 Complete When...

- [x] Build succeeds
- [ ] App starts without errors
- [ ] Browser source connects
- [ ] Test alert appears
- [ ] Real event triggers alert
- [ ] Template variables work
- [ ] No critical bugs found

---

**Ready to test! Run `npm start` and follow the guide above!** 🚀
