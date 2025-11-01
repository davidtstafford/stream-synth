# 🧪 Event Actions - Phase 4 Testing Guide

**Test the Browser Source Server and OBS Integration**

---

## 🚀 Quick Test (5 minutes)

### 1. Start the Application
```powershell
npm run dev
```

**Expected Console Output:**
```
[BrowserSourceServer] HTTP server started on http://localhost:3737
[BrowserSourceServer] Browser source URL: http://localhost:3737/browser-source
[Main] Browser Source Server started - OBS URL: http://localhost:3737/browser-source
[Main] Event Action Processor connected to Browser Source Server
```

✅ **Success:** All 4 messages appear

---

### 2. Test Server Endpoints

**Open in Browser:**

**Info Page:**
```
http://localhost:3737/
```
Expected: Server info page with stats

**Health Check:**
```
http://localhost:3737/health
```
Expected: JSON response
```json
{
  "status": "ok",
  "connectedClients": 0,
  "alertsSent": 0,
  "uptime": 123.45
}
```

**Browser Source (Debug Mode):**
```
http://localhost:3737/browser-source?debug=1
```
Expected:
- ✅ Page loads
- ✅ Green dot appears (🟢 Connected)
- ✅ Client ID shown
- ✅ Console shows: "Connected to Stream Synth Browser Source Server"

---

### 3. Test Socket.IO Connection

**In Browser (F12 Console):**
```javascript
// Check socket status
socket.connected
// true

// Send ping
socket.emit('ping');
// Listen for pong (check console)

// Request test alert
socket.emit('test-alert');
// Alert should appear!
```

---

### 4. Test in OBS Studio

**Add Browser Source:**
1. Sources → Add → Browser
2. Name: "Stream Synth Alerts"
3. URL: `http://localhost:3737/browser-source`
4. Width: 1920, Height: 1080
5. ✅ Check both "Shutdown" and "Refresh" options
6. Click OK

**Test Alert:**
- In browser source page, press F12
- Run: `socket.emit('test-alert')`
- ✅ Alert appears in OBS!

---

## 🧪 Detailed Testing

### Test 1: Server Lifecycle

```typescript
// Should start successfully
✅ Server starts on port 3737
✅ Socket.IO initialized
✅ No errors in console

// Should handle multiple clients
✅ Open multiple browser tabs
✅ Each gets unique client ID
✅ All can receive alerts

// Should stop gracefully
✅ Close Stream Synth
✅ Server stops
✅ Console shows: "Browser Source Server stopped"
```

---

### Test 2: Alert Types

#### Text Alert
```javascript
socket.emit('alert', {
  event_type: 'test',
  channel_id: 'test',
  formatted: {
    html: '<strong>Test User</strong> followed!',
    plainText: 'Test User followed!',
    emoji: '❤️',
    variables: {}
  },
  text: {
    content: 'Test User just followed!',
    duration: 5000,
    position: 'top-center'
  },
  timestamp: new Date().toISOString()
});
```
**Expected:**
- ✅ Text appears at top-center
- ✅ Slides in from top
- ✅ Fades out after 5 seconds

#### Sound Alert
```javascript
socket.emit('alert', {
  event_type: 'test',
  channel_id: 'test',
  formatted: {
    html: 'Sound test',
    plainText: 'Sound test',
    emoji: '🔊',
    variables: {}
  },
  sound: {
    file_path: 'C:/path/to/sound.mp3',
    volume: 0.8
  },
  timestamp: new Date().toISOString()
});
```
**Expected:**
- ✅ Sound plays at 80% volume
- ✅ Console shows: "Playing sound"

#### Image Alert
```javascript
socket.emit('alert', {
  event_type: 'test',
  channel_id: 'test',
  formatted: {
    html: 'Image test',
    plainText: 'Image test',
    emoji: '🖼️',
    variables: {}
  },
  image: {
    file_path: 'C:/path/to/image.png',
    duration: 5000,
    position: 'middle-center',
    width: 400,
    height: 400
  },
  timestamp: new Date().toISOString()
});
```
**Expected:**
- ✅ Image appears centered
- ✅ 400x400 size
- ✅ Fades out after 5 seconds

#### Video Alert
```javascript
socket.emit('alert', {
  event_type: 'test',
  channel_id: 'test',
  formatted: {
    html: 'Video test',
    plainText: 'Video test',
    emoji: '🎥',
    variables: {}
  },
  video: {
    file_path: 'C:/path/to/video.mp4',
    volume: 0.5,
    position: 'middle-center',
    width: 800,
    height: 600
  },
  timestamp: new Date().toISOString()
});
```
**Expected:**
- ✅ Video plays centered
- ✅ 800x600 size
- ✅ Volume at 50%
- ✅ Auto-removes when finished

---

### Test 3: Alert Queue

**Send Multiple Alerts:**
```javascript
// Send 3 alerts quickly
socket.emit('test-alert');
socket.emit('test-alert');
socket.emit('test-alert');
```

**Expected:**
- ✅ Alerts process sequentially (one at a time)
- ✅ No overlap
- ✅ Queue length increases then decreases
- ✅ Debug shows queue: 2 → 1 → 0

---

### Test 4: Positions

**Test All 9 Positions:**
```javascript
const positions = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
];

positions.forEach((position, i) => {
  setTimeout(() => {
    socket.emit('alert', {
      event_type: 'test',
      channel_id: 'test',
      formatted: { html: position, plainText: position, emoji: '📍', variables: {} },
      text: { content: position, duration: 3000, position },
      timestamp: new Date().toISOString()
    });
  }, i * 3500);
});
```

**Expected:**
- ✅ Each position displays correctly
- ✅ Alerts appear in sequence
- ✅ Total time: ~32 seconds

---

### Test 5: Reconnection

**Test Reconnect Logic:**
1. Start Stream Synth
2. Open browser source page
3. ✅ Shows "Connected"
4. Stop Stream Synth
5. ✅ Shows "Disconnected"
6. Start Stream Synth again
7. ✅ Auto-reconnects
8. ✅ Shows "Connected"

---

### Test 6: Multiple Clients

**Test Broadcasting:**
1. Open browser source in 3 tabs
2. All show "Connected"
3. Send alert from one tab
4. ✅ All 3 tabs receive the alert
5. Check server stats:
   ```
   connectedClients: 3
   ```

---

### Test 7: OBS Integration

#### Basic Display
- ✅ Browser source shows in OBS
- ✅ Transparent background
- ✅ Alerts appear on stream
- ✅ No lag or stuttering

#### Scene Switching
- ✅ Alert continues when switching scenes
- ✅ Source refreshes on scene activate
- ✅ No connection loss

#### Stream Test
- ✅ Start streaming/recording
- ✅ Trigger alerts
- ✅ Alerts appear in recording
- ✅ Sound works in stream

---

## 🐛 Common Issues

### Issue: Port Already in Use
**Error:** `EADDRINUSE: address already in use`

**Solution:**
```typescript
// In main.ts, change port
browserSourceServer = new BrowserSourceServer(3738);
```

---

### Issue: Connection Failed
**Symptom:** Red dot (🔴 Disconnected)

**Check:**
1. Is Stream Synth running?
2. Console shows server started?
3. Firewall blocking port 3737?
4. Try: `http://localhost:3737/health`

**Solution:**
- Restart Stream Synth
- Check console for errors
- Try different browser

---

### Issue: Alert Not Showing
**Symptom:** Alert sent but nothing appears

**Check:**
1. Debug mode shows alert received? (console)
2. Check browser console for errors
3. Is alert duration > 0?
4. Is position valid?

**Debug:**
```javascript
// In browser console
socket.on('alert', (alert) => {
  console.log('Alert received:', alert);
});
```

---

### Issue: Sound Not Playing
**Symptom:** Alert appears but no sound

**Check:**
1. File path correct? (use absolute path)
2. File exists?
3. Supported format? (mp3, wav, ogg, aac)
4. Volume > 0?
5. Browser allows autoplay?

**Test:**
```javascript
const audio = new Audio('file:///C:/path/to/sound.mp3');
audio.play();
```

---

### Issue: Image/Video Not Loading
**Symptom:** Alert shows but no media

**Check:**
1. File path uses `file:///` protocol?
2. File exists and readable?
3. Correct extension?
4. Browser console shows 404?

**Fix:**
```javascript
// Must use file:// protocol
file_path: 'file:///C:/Users/You/media/image.png'
```

---

## 📊 Test Results Template

```
✅ = Pass  |  ❌ = Fail  |  ⚠️ = Partial

[  ] Server Lifecycle
  [  ] Starts on port 3737
  [  ] Socket.IO connected
  [  ] Stops gracefully
  
[  ] Server Endpoints
  [  ] / (info page)
  [  ] /health (JSON)
  [  ] /browser-source (page loads)
  
[  ] Socket.IO Connection
  [  ] Client connects
  [  ] Receives client ID
  [  ] Ping/pong works
  [  ] Auto-reconnects
  
[  ] Alert Types
  [  ] Text alert displays
  [  ] Sound alert plays
  [  ] Image alert shows
  [  ] Video alert plays
  
[  ] Alert Features
  [  ] Position system (9 positions)
  [  ] Duration/auto-hide
  [  ] Animations (slide, fade)
  [  ] Queue processing
  
[  ] OBS Integration
  [  ] Browser source added
  [  ] Alerts visible in OBS
  [  ] Transparent background
  [  ] Stream recording works
  
[  ] Multi-Client
  [  ] Multiple tabs connect
  [  ] Broadcasting works
  [  ] Stats accurate
  
[  ] Debug Mode
  [  ] ?debug=1 works
  [  ] Status indicator shows
  [  ] Stats display
  [  ] Console logs
```

---

## 🎯 Success Criteria

**Phase 4 is complete when:**

✅ Server starts without errors  
✅ Browser source page loads  
✅ Socket.IO connects successfully  
✅ Test alerts display correctly  
✅ All 4 media types work  
✅ OBS integration functional  
✅ Multiple clients supported  
✅ Auto-reconnection works  

---

## 📝 Testing Notes

**Test Environment:**
- OS: Windows 11
- Node: v18+
- OBS Studio: v30+
- Browser: Chrome/Edge

**Port Used:** 3737  
**Debug URL:** `http://localhost:3737/browser-source?debug=1`

**Tested By:** _____________  
**Date:** _____________  
**Result:** ✅ Pass / ❌ Fail

---

## 🚀 Next Phase

**After testing Phase 4, proceed to:**

**Phase 5: IPC Handlers**
- Create backend IPC handlers
- CRUD operations
- Test alert triggering
- Stats endpoints

**Estimated Time:** 2-3 hours

---

**Happy Testing! 🎉**
