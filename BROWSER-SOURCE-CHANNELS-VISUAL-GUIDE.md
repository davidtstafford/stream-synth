# Browser Source Channels - Visual Architecture

**Quick Reference:** How the browser source channel system works end-to-end

---

## 🎯 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TWITCH EVENT OCCURS                          │
│                      (e.g., new follower)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  EventSubEventRouter receives event                  │
│                                                                      │
│  1. Parse event: type = "channel.follow"                            │
│  2. Extract data: { user_name: "JohnDoe", ... }                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              EventActionProcessor.processEvent()                     │
│                                                                      │
│  1. Load action config for "channel.follow"                         │
│     ┌──────────────────────────────────────────────┐                │
│     │ Action Config (from database):               │                │
│     │ ──────────────────────────────               │                │
│     │ event_type: "channel.follow"                 │                │
│     │ browser_source_channel: "main-alerts" ✅     │                │
│     │ text_template: "🎉 {{user_name}} followed!" │                │
│     │ text_position: "top-center"                  │                │
│     │ ...                                           │                │
│     └──────────────────────────────────────────────┘                │
│                                                                      │
│  2. Process template with event data                                │
│  3. Build alert payload with channel info                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Socket.io Server (Backend)                         │
│                                                                      │
│  Broadcast to ALL connected browser sources:                        │
│                                                                      │
│  io.emit('alert', {                                                 │
│    event_type: 'channel.follow',                                    │
│    channel: 'main-alerts', ← ← ← ← CHANNEL INFO                    │
│    text: {                                                          │
│      content: '🎉 JohnDoe followed!',                              │
│      position: 'top-center',                                        │
│      duration: 5000                                                 │
│    },                                                               │
│    // ... image, video, sound, etc.                                 │
│  });                                                                │
└────────────┬────────────────────────┬───────────────────────────────┘
             │                        │
             │                        │ (All browser sources receive it)
             │                        │
      ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
      │ Browser     │         │ Browser     │         │ Browser     │
      │ Source 1    │         │ Source 2    │         │ Source 3    │
      │             │         │             │         │             │
      │ channel=    │         │ channel=    │         │ channel=    │
      │ main-alerts │         │ tts         │         │ bits        │
      └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
             │                       │                        │
             ▼                       ▼                        ▼
      ┌────────────┐          ┌────────────┐          ┌────────────┐
      │ Filter:    │          │ Filter:    │          │ Filter:    │
      │            │          │            │          │            │
      │ if (       │          │ if (       │          │ if (       │
      │   payload  │          │   payload  │          │   payload  │
      │   .channel │          │   .channel │          │   .channel │
      │   ===      │          │   ===      │          │   ===      │
      │   'main-   │          │   'tts'    │          │   'bits'   │
      │   alerts'  │          │ )          │          │ )          │
      │ )          │          │            │          │            │
      └─────┬──────┘          └─────┬──────┘          └─────┬──────┘
            │                       │                        │
            ✅ MATCH!               ❌ NO MATCH              ❌ NO MATCH
            │                       │                        │
            ▼                       ▼                        ▼
      ┌────────────┐          ┌────────────┐          ┌────────────┐
      │ SHOW       │          │ IGNORE     │          │ IGNORE     │
      │ ALERT!     │          │ (filtered  │          │ (filtered  │
      │            │          │  out)      │          │  out)      │
      │ 🎉 JohnDoe│          │            │          │            │
      │ followed!  │          │            │          │            │
      └────────────┘          └────────────┘          └────────────┘
```

---

## 🎨 User Workflow: Setting Up Channels

### Step 1: Create Channels

```
┌──────────────────────────────────────────────────────────────┐
│           Stream Synth → Browser Source Channels             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📺 Your Channels                           [➕ New Channel] │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  🎉 main-alerts                                     [Edit]   │
│     Follows, subs, raids - center screen                     │
│     URL: http://localhost:3737/browser-source?channel=main-  │
│          alerts                                     [Copy]   │
│                                                              │
│  💬 tts                                             [Edit]   │
│     TTS messages only - lower third                          │
│     URL: http://localhost:3737/browser-source?channel=tts    │
│                                                     [Copy]   │
│                                                              │
│  🎊 hype-events                                     [Edit]   │
│     Big moments - takeover screen                            │
│     URL: http://localhost:3737/browser-source?channel=hype-  │
│          events                                     [Copy]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Step 2: Assign Events to Channels

```
┌──────────────────────────────────────────────────────────────┐
│              Edit Action: New Follower                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Event Type: Channel Follow                                  │
│                                                              │
│  📺 Browser Source Channel:                                  │
│     ┌────────────────────────────────────────┐              │
│     │ main-alerts ▼                          │              │
│     └────────────────────────────────────────┘              │
│     Options:                                                 │
│       • default (all unassigned)                             │
│       • main-alerts  ← SELECTED                              │
│       • tts                                                  │
│       • hype-events                                          │
│       • bits                                                 │
│                                                              │
│  💬 Text Settings                                            │
│     ☑ Enable Text Alert                                     │
│     Template: "🎉 {{user_name}} just followed!"            │
│     Position: Top Center                                     │
│     Duration: 5000 ms                                        │
│                                                              │
│  [... rest of form ...]                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Step 3: Add to OBS

```
┌─────────────────────────────────────────────────────────────┐
│                      OBS Studio                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Sources (Scene: Main Stream)                               │
│  ───────────────────────────────────────────────────        │
│                                                             │
│  👁 Game Capture                                            │
│  👁 Webcam                                                  │
│  👁 Chat Box                                                │
│  👁 Browser Source - Main Alerts        ← ← ← ← ← ← ← ←    │
│     └─ URL: http://localhost:3737/browser-source?channel=   │
│              main-alerts                                    │
│     └─ Position: Center (960x540, 1920x1080)                │
│                                                             │
│  👁 Browser Source - TTS                ← ← ← ← ← ← ← ←    │
│     └─ URL: http://localhost:3737/browser-source?channel=   │
│              tts                                            │
│     └─ Position: Lower Third (0x900, 1920x180)              │
│                                                             │
│  👁 Browser Source - Hype Events        ← ← ← ← ← ← ← ←    │
│     └─ URL: http://localhost:3737/browser-source?channel=   │
│              hype-events                                    │
│     └─ Position: Fullscreen (0x0, 1920x1080)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation: Client-Side Filtering

### Browser Source HTML (Simplified)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Stream Synth Browser Source</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div id="alert-container"></div>

  <script>
    // 1. Parse channel from URL
    const urlParams = new URLSearchParams(window.location.search);
    const myChannel = urlParams.get('channel') || 'default';
    
    console.log(`📺 Browser Source listening to channel: ${myChannel}`);
    
    // 2. Connect to Socket.io
    const socket = io('http://localhost:3737');
    
    // 3. Listen for alerts
    socket.on('alert', (payload) => {
      console.log('📩 Received alert:', payload);
      
      // 4. FILTER: Only show if channel matches
      if (payload.channel !== myChannel) {
        console.log(`⏭️ Skipping - wrong channel (want: ${myChannel}, got: ${payload.channel})`);
        return;
      }
      
      console.log('✅ Channel match! Displaying alert...');
      
      // 5. Display the alert
      displayAlert(payload);
    });
    
    function displayAlert(payload) {
      // Create alert element
      const alertEl = document.createElement('div');
      alertEl.className = `alert position-${payload.text.position}`;
      alertEl.innerHTML = payload.text.content;
      
      // Show alert
      document.getElementById('alert-container').appendChild(alertEl);
      
      // Auto-remove after duration
      setTimeout(() => {
        alertEl.classList.add('fade-out');
        setTimeout(() => alertEl.remove(), 500);
      }, payload.text.duration);
    }
  </script>
</body>
</html>
```

---

## 🎯 Example: Multi-Channel Setup

### Scenario: Streamer wants different alert zones

```
┌────────────────────────────────────────────────────────────┐
│                    STREAM LAYOUT                           │
│                  (1920x1080 canvas)                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🎊 HYPE EVENTS (channel: hype-events)                │ │ Top Center
│  │ Fullscreen takeover for huge moments                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌────────────────┐                                       │
│  │ 🎰 BITS        │                                       │ Top Right
│  │ (channel:bits) │  ← Running total for bit donations   │
│  └────────────────┘                                       │
│                                                            │
│                      [ GAME CAPTURE ]                      │ Center
│                                                            │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🎉 MAIN ALERTS (channel: main-alerts)                │ │ Center
│  │ Follows, subs, raids - brief center popup            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 💬 TTS (channel: tts)                                │ │ Lower Third
│  │ Scrolling text-to-speech messages                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### OBS Sources
```
1. Browser Source (hype-events)
   URL: http://localhost:3737/browser-source?channel=hype-events
   Size: 1920x1080
   Position: 0, 0
   
2. Browser Source (bits)
   URL: http://localhost:3737/browser-source?channel=bits
   Size: 300x150
   Position: 1620, 0
   
3. Browser Source (main-alerts)
   URL: http://localhost:3737/browser-source?channel=main-alerts
   Size: 800x200
   Position: 560, 440
   
4. Browser Source (tts)
   URL: http://localhost:3737/browser-source?channel=tts
   Size: 1920x180
   Position: 0, 900
```

### Event Assignments
```
Event Type              → Channel
──────────────────────────────────────────
channel.follow          → main-alerts
channel.subscribe       → main-alerts
channel.raid            → hype-events (big ones)
channel.cheer (< 1000)  → bits
channel.cheer (≥ 1000)  → hype-events
TTS Redemption          → tts
```

---

## ✨ Key Benefits Visualized

### Without Channels (Old Way)
```
All Events → Single Browser Source → All Alerts Overlap
```
**Problem:** Can't position different alert types separately!

### With Channels (New Way)
```
Event → Assigned Channel → Specific Browser Source → Perfect Placement
```
**Solution:** Full control over where each type of alert appears!

---

## 🚀 Ready to Implement

When you're ready to add this feature:

1. **Start here:** `BROWSER-SOURCE-CHANNELS-PLAN.md`
2. **Follow the database schema** (Section 3)
3. **Implement backend** (Section 4)
4. **Build frontend UI** (Section 5)
5. **Update browser source client** (Section 6)
6. **Test with multiple OBS sources** (Section 8)

**Estimated Time:** 3-4 hours (fully documented, just needs execution)

---

**Status:** 🟢 **Architecture locked in, documentation complete, ready when you are!**
