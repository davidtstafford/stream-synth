# Browser Source Channels - Feature Summary

**Date:** November 3, 2025  
**Requested By:** User  
**Status:** 📋 DOCUMENTED & PLANNED  
**Implementation Phase:** Phase 8 (Action Editor)

---

## 🎯 Executive Summary

You asked a critical architectural question early on: **"Will each event type have its own browser source?"**

After discussion, we agreed on **Option 3: User-Defined Named Channels** as the best solution.

This allows users to:
- ✅ Create custom channel names (e.g., "main-alerts", "tts", "hype-events")
- ✅ Assign any event to any channel
- ✅ Use multiple OBS browser sources (one per channel)
- ✅ Position alerts independently across the stream

---

## 📝 Your Original Question

> **Question:**  
> "Just to check, but by the end, will each new event type have its own browser source... e.g. new follower - `http://localhost:3737/new-follower`, tts - `http://localhost:3737/tts`?
> 
> Or possibly adding ability to optionally exposing alerts to the same endpoint, so e.g. new follower - `http://localhost:3737/alerts`, tts - `http://localhost:3737/tts`, gifted sub - `http://localhost:3737/alerts`?"

---

## ✅ The Solution: User-Defined Channels

Instead of predefined endpoints per event type, users get **full control** to create their own channels and assign events however they want.

### URL Format
```
http://localhost:3737/browser-source?channel=CHANNEL_NAME
```

### User Workflow

**Step 1: Create Channels**
```
User creates:
├─ "main-alerts" (for big events)
├─ "tts" (for TTS messages)
└─ "bits-counter" (for bit donations)
```

**Step 2: Assign Events to Channels**
```
Follows → "main-alerts"
Subs → "main-alerts"
Raids → "main-alerts"
TTS Redemptions → "tts"
Bits (under 1000) → "bits-counter"
Bits (over 1000) → "main-alerts"
```

**Step 3: Add OBS Browser Sources**
```
OBS Scene:
├─ Source 1: http://localhost:3737/browser-source?channel=main-alerts (center)
├─ Source 2: http://localhost:3737/browser-source?channel=tts (bottom left)
└─ Source 3: http://localhost:3737/browser-source?channel=bits-counter (top right)
```

---

## 🏗️ How It Works

### Backend (Event Occurs)
```typescript
// EventActionProcessor builds alert payload
const payload = {
  event_type: 'channel.follow',
  channel: 'main-alerts', // ← User-assigned channel
  text: { content: '🎉 JohnDoe just followed!' },
  // ...
};

// Broadcast to ALL browser sources
io.emit('alert', payload);
```

### Browser Source (Client-Side Filtering)
```javascript
// Each browser source filters based on its URL parameter
const myChannel = new URLSearchParams(window.location.search).get('channel') || 'default';

socket.on('alert', (payload) => {
  if (payload.channel !== myChannel) {
    return; // Ignore this alert
  }
  
  displayAlert(payload); // Show it!
});
```

---

## 💡 Why This Approach?

### ✅ Advantages

**1. Ultimate Flexibility**
- Users choose their own channel names
- Assign any event to any channel
- Change assignments anytime

**2. Simple for Beginners**
- Default channel (`http://localhost:3737/browser-source`) shows all alerts
- No setup required - works out of the box

**3. Powerful for Pros**
- Create 10+ channels if needed
- Position alerts independently
- Professional multi-source setup

**4. Clean Architecture**
- Single broadcast mechanism (Socket.IO)
- Client-side filtering (no server complexity)
- Scalable to unlimited channels

### ❌ What We're NOT Doing

**Rejected: Hardcoded Event-Specific Endpoints**
```
❌ http://localhost:3737/new-follower
❌ http://localhost:3737/new-subscriber
❌ http://localhost:3737/bits
```

**Why rejected:**
- Inflexible - Can't group events together
- Requires 41+ separate browser sources
- Can't split one event type across channels (e.g., big bits vs small bits)

---

## 📊 Example Configurations

### Beginner (Single Source)
```
Channel: default
URL: http://localhost:3737/browser-source
Shows: ALL alerts
```

### Intermediate (2 Sources)
```
Channel: "alerts"
├─ Follows
├─ Subs
└─ Bits

Channel: "tts"
└─ TTS Redemptions

OBS Setup:
├─ Source 1: ?channel=alerts (center)
└─ Source 2: ?channel=tts (bottom)
```

### Advanced (4 Sources)
```
Channel: "hype-center"
├─ Subs
├─ Gifted Subs
└─ Raids

Channel: "passive-corner"
├─ Follows
└─ Small Bits (<500)

Channel: "tts-bottom"
└─ TTS Messages

Channel: "big-donations"
└─ Large Bits (≥500)

OBS Setup: 4 sources positioned independently
```

---

## 🎨 User Interface (Phase 8)

### Channel Manager

```
┌─────────────────────────────────────────────────────────────┐
│  Browser Source Channels                    [➕ Create]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📺 Default Channel                                          │
│  URL: http://localhost:3737/browser-source      [Copy URL]  │
│  Events: All unassigned                                      │
│                                                              │
│  🎉 Main Alerts                              [Edit] [Delete]│
│  URL: http://localhost:3737/browser-source?channel=main     │
│  Events: 5 assigned                             [Copy URL]  │
│                                                              │
│  💬 TTS Corner                               [Edit] [Delete]│
│  URL: http://localhost:3737/browser-source?channel=tts      │
│  Events: 1 assigned                             [Copy URL]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Action Editor - Channel Selector

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Action: channel.follow                        [ X ]   │
├─────────────────────────────────────────────────────────────┤
│  Event Type: channel.follow - New Follower                  │
│                                                              │
│  Browser Source Channel:                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎉 Main Alerts                             ▼          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Shows on: http://localhost:3737/browser-source?channel=main│
│                                                              │
│  [Manage Channels...]                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Database Schema

```sql
-- New table for channels
CREATE TABLE browser_source_channels (
  id INTEGER PRIMARY KEY,
  channel_id TEXT UNIQUE NOT NULL,  -- 'main-alerts', 'tts', etc.
  channel_name TEXT NOT NULL,       -- 'Main Alerts', 'TTS Messages'
  description TEXT,
  icon TEXT DEFAULT '📺',
  color TEXT DEFAULT '#9147ff',
  is_default BOOLEAN DEFAULT 0
);

-- Update event_actions table
ALTER TABLE event_actions 
ADD COLUMN browser_source_channel TEXT DEFAULT 'default';
```

### Alert Payload

```typescript
interface AlertPayload {
  id: string;
  event_type: string;
  channel_id: string;
  channel: string; // ← NEW: User-assigned browser source channel
  formatted: { ... };
  text?: { ... };
  sound?: { ... };
  image?: { ... };
  video?: { ... };
}
```

### Browser Source Filtering

```javascript
// browser-source.js
class AlertManager {
  constructor() {
    this.channel = new URLSearchParams(window.location.search).get('channel') || 'default';
  }

  onAlert(payload) {
    const alertChannel = payload.channel || 'default';
    
    if (alertChannel !== this.channel) {
      return; // Filter out
    }
    
    this.displayAlert(payload);
  }
}
```

---

## 📋 Implementation Checklist

### Phase 8.1: Database & Backend
- [ ] Create `browser_source_channels` table
- [ ] Add `browser_source_channel` to `event_actions`
- [ ] Create BrowserSourceChannelsRepository
- [ ] Add IPC handlers
- [ ] Update EventActionProcessor

### Phase 8.2: Browser Source
- [ ] Add channel filtering to browser-source.js
- [ ] Parse `?channel=` URL parameter
- [ ] Filter alerts by channel
- [ ] Test multi-source setup

### Phase 8.3: Frontend UI
- [ ] Create Channel Manager screen
- [ ] Create Channel Editor modal
- [ ] Add channel selector to Action Editor
- [ ] Add "Copy URL" functionality
- [ ] Create frontend service

### Phase 8.4: Testing
- [ ] Test default channel (backwards compatibility)
- [ ] Test multiple channels
- [ ] Test in OBS with real events
- [ ] Document setup guide

---

## 🎯 Benefits Summary

### For Beginners
✅ Works with ZERO configuration (default channel)  
✅ Simple one-source setup  
✅ Easy to understand

### For Intermediate Users
✅ Split alerts into 2-3 logical groups  
✅ Different positions per group  
✅ Better stream aesthetics

### For Advanced Users
✅ Unlimited channels  
✅ Complex multi-source setups  
✅ Professional-grade control  
✅ Per-event channel assignment

---

## 📚 Documentation

**Full Implementation Plan:**  
`FUTURE-PLANS/BROWSER-SOURCE-CHANNELS-PLAN.md`

**Architecture Overview:**  
`FUTURE-PLANS/EVENT-ACTIONS-ARCHITECTURE.md`

**Current Status:**  
`EVENT-ACTIONS-CURRENT-STATUS.md`

---

## ✅ Status

- **Documented:** ✅ Complete
- **Designed:** ✅ Complete
- **User Approval:** ✅ Confirmed ("I like option 3")
- **Implementation:** 📋 Planned for Phase 8
- **Testing:** 📋 Phase 10/11

---

## 🎬 Next Steps

1. ✅ **Phase 9 Complete** - Template Builder
2. ✅ **Phase 10 Complete** - Alert Preview
3. 🔄 **Phase 11 Next** - EventSub Integration
4. 📋 **Phase 8 Enhancement** - Add Channel Manager (can be done anytime)

**Note:** The channel feature can be added at any point. It's designed to be backwards compatible (default channel works without any setup).

---

## 💬 Your Confirmation

> "I like option 3 as long as the user gets to create the name and assign the events"

**✅ Confirmed and documented!**

Users will have **complete control** over:
- Channel names (custom, user-created)
- Event assignments (any event → any channel)
- Channel organization (icons, colors, descriptions)
- OBS source URLs (auto-generated, one-click copy)

---

**Thank you for this excellent architectural decision! This feature will make Stream Synth's Event Actions system incredibly flexible and professional.** 🚀
