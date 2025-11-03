# Browser Source Channels - Implementation Plan

**Date:** November 3, 2025  
**Feature:** User-Defined Browser Source Channels  
**Status:** 📋 PLANNED (Phase 8 Implementation)

---

## 🎯 Overview

Users can create **named channels** for browser sources, allowing them to split alerts across multiple OBS browser sources with complete control over which events appear where.

### Key Concept
Instead of one browser source showing all alerts, users can:
1. **Create custom channels** (e.g., "main-alerts", "tts", "hype-events")
2. **Assign events to channels** (e.g., follows → "main-alerts", TTS → "tts")
3. **Add multiple OBS sources** (one per channel)
4. **Position independently** (different screen locations per channel)

---

## 🏗️ Architecture

### Browser Source URL Format
```
http://localhost:3737/browser-source?channel=CHANNEL_NAME
```

**Examples:**
- `http://localhost:3737/browser-source` → Default channel (all unassigned)
- `http://localhost:3737/browser-source?channel=main-alerts` → Only "main-alerts" channel
- `http://localhost:3737/browser-source?channel=tts` → Only "tts" channel
- `http://localhost:3737/browser-source?channel=hype-events` → Only "hype-events" channel

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    TWITCH EVENT OCCURS                       │
│                  (e.g., new follower)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              EventActionProcessor.processEvent()             │
│                                                              │
│  1. Load action config for "channel.follow"                 │
│  2. Config says: channel = "main-alerts" ✅                 │
│  3. Build alert payload with channel field                  │
│  4. Emit to browser source with channel info                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Browser Source Server (Socket.IO)                 │
│                                                              │
│  io.emit('alert', {                                         │
│    event_type: 'channel.follow',                            │
│    channel: 'main-alerts', ← Channel info included          │
│    text: { ... },                                           │
│    sound: { ... }                                           │
│  });                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ OBS Source 1 │ │ OBS Source 2 │ │ OBS Source 3 │
│              │ │              │ │              │
│ ?channel=    │ │ ?channel=    │ │ ?channel=    │
│ main-alerts  │ │ tts          │ │ hype-events  │
│              │ │              │ │              │
│ ✅ SHOWS     │ │ ❌ FILTERS   │ │ ❌ FILTERS   │
│ (matches)    │ │ (no match)   │ │ (no match)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 📊 Database Schema

### New Table: `browser_source_channels`

```sql
CREATE TABLE IF NOT EXISTS browser_source_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,        -- e.g., "main-alerts", "tts", "hype-events"
  channel_name TEXT NOT NULL,             -- Display name: "Main Alerts", "TTS Messages"
  description TEXT,                       -- User notes: "Center screen big events"
  icon TEXT DEFAULT '📺',                 -- Emoji icon for UI
  color TEXT DEFAULT '#9147ff',           -- Hex color for UI organization
  is_default BOOLEAN DEFAULT 0,           -- Is this the default channel?
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Default channel for new installs
INSERT INTO browser_source_channels (channel_id, channel_name, description, is_default, created_at, updated_at)
VALUES ('default', 'Default Channel', 'All unassigned alerts', 1, datetime('now'), datetime('now'));
```

### Update `event_actions` Table

```sql
ALTER TABLE event_actions 
ADD COLUMN browser_source_channel TEXT DEFAULT 'default';

-- Add foreign key reference (conceptual, SQLite doesn't enforce)
-- FOREIGN KEY (browser_source_channel) REFERENCES browser_source_channels(channel_id)
```

---

## 🎨 User Interface (Phase 8)

### 1. Channel Manager Screen

**New Screen: Event Actions → Manage Channels**

```
┌─────────────────────────────────────────────────────────────┐
│  Browser Source Channels                    [➕ Create]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📺 Default Channel                         [Edit] [🗑️] │ │
│  │ URL: http://localhost:3737/browser-source              │ │
│  │ Events: All unassigned alerts                [Copy URL]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎉 Main Alerts                             [Edit] [🗑️] │ │
│  │ URL: http://localhost:3737/browser-source?channel=main │ │
│  │ Events: 5 actions assigned                  [Copy URL]│ │
│  │ Description: Center screen - big events                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💬 TTS Messages                            [Edit] [🗑️] │ │
│  │ URL: http://localhost:3737/browser-source?channel=tts  │ │
│  │ Events: 1 action assigned                   [Copy URL]│ │
│  │ Description: Bottom left corner - TTS only             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💎 Passive Alerts                          [Edit] [🗑️] │ │
│  │ URL: http://localhost:3737/browser-source?channel=bits │ │
│  │ Events: 2 actions assigned                  [Copy URL]│ │
│  │ Description: Top right - small notifications           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Create/Edit Channel Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Create Browser Source Channel                      [ X ]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Channel Name:                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Main Alerts                                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Channel ID: (auto-generated from name)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ main-alerts                                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Description: (optional)                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Center screen - followers, subs, raids                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Icon:  📺 [Change]    Color: ███ #9147ff [Pick Color]     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📋 Browser Source URL:                                 │ │
│  │ http://localhost:3737/browser-source?channel=main      │ │
│  │                                          [Copy URL]     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Cancel ]                                      [ Create ]  │
└─────────────────────────────────────────────────────────────┘
```

### 3. Channel Selector in Action Editor

**Edit Action → General Tab**

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Action: channel.follow                        [ X ]   │
├─────────────────────────────────────────────────────────────┤
│  [ General ] [ Text Alert ] [ Sound ] [ Image ] [ Video ]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Event Type:                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ channel.follow - New Follower              ▼          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Browser Source Channel:                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎉 Main Alerts                             ▼          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ↳ Shows on: http://localhost:3737/browser-source?channel=main
│                                                              │
│  Available channels:                                         │
│  • 📺 Default Channel (all unassigned)                      │
│  • 🎉 Main Alerts (5 events)                                │
│  • 💬 TTS Messages (1 event)                                │
│  • 💎 Passive Alerts (2 events)                             │
│  [Manage Channels...]                                        │
│                                                              │
│  ☑ Enable this action                                       │
│                                                              │
│  ... (rest of form)                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Implementation Details

### Phase 8.1: Database & Backend

**1. Create Repository** (`browser-source-channels.ts`)

```typescript
export interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  channel_name: string;
  description: string | null;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export class BrowserSourceChannelsRepository extends BaseRepository {
  constructor() {
    super('browser_source_channels');
  }

  getAll(): BrowserSourceChannel[] {
    return this.db.prepare(`
      SELECT * FROM browser_source_channels 
      ORDER BY is_default DESC, channel_name ASC
    `).all() as BrowserSourceChannel[];
  }

  getByChannelId(channelId: string): BrowserSourceChannel | null {
    return this.db.prepare(`
      SELECT * FROM browser_source_channels WHERE channel_id = ?
    `).get(channelId) as BrowserSourceChannel | null;
  }

  create(input: Omit<BrowserSourceChannel, 'id' | 'created_at' | 'updated_at'>): number {
    // Validate channel_id is URL-safe
    if (!/^[a-z0-9-_]+$/.test(input.channel_id)) {
      throw new Error('Channel ID must contain only lowercase letters, numbers, hyphens, and underscores');
    }

    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO browser_source_channels 
      (channel_id, channel_name, description, icon, color, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.channel_id,
      input.channel_name,
      input.description,
      input.icon,
      input.color,
      input.is_default ? 1 : 0,
      now,
      now
    );

    return result.lastInsertRowid as number;
  }

  // ... update, delete, etc.
}
```

**2. Add IPC Handlers** (`browser-source-channels.ts`)

```typescript
export function registerBrowserSourceChannelHandlers(registry: IPCHandlerRegistry) {
  const repo = new BrowserSourceChannelsRepository();

  registry.register('browser-source-channels:list', {
    execute: async () => {
      return { success: true, data: repo.getAll() };
    }
  });

  registry.register('browser-source-channels:create', {
    schema: z.object({
      channel_id: z.string().regex(/^[a-z0-9-_]+$/),
      channel_name: z.string().min(1).max(50),
      description: z.string().optional(),
      icon: z.string().default('📺'),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#9147ff')
    }),
    execute: async (input) => {
      const id = repo.create({ ...input, is_default: false });
      return { success: true, data: { id } };
    }
  });

  // ... update, delete handlers
}
```

**3. Update EventActionProcessor**

```typescript
// event-action-processor.ts
private buildAlertPayload(action: EventAction, formatted: FormattedEvent): AlertPayload {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    event_type: action.event_type,
    channel_id: action.channel_id,
    channel: action.browser_source_channel || 'default', // ← Add channel field
    formatted,
    text: action.text_enabled ? { ... } : undefined,
    sound: action.sound_enabled ? { ... } : undefined,
    image: action.image_enabled ? { ... } : undefined,
    video: action.video_enabled ? { ... } : undefined,
    timestamp: new Date().toISOString()
  };
}
```

### Phase 8.2: Browser Source Filtering

**Update `browser-source.js`:**

```javascript
class AlertManager {
  constructor() {
    this.channel = this.parseChannelFromURL();
    this.alertQueue = [];
    this.currentAlert = null;
    
    console.log(`[AlertManager] Initialized for channel: ${this.channel}`);
  }

  parseChannelFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('channel') || 'default';
  }

  shouldDisplayAlert(payload) {
    // If payload has no channel, show on default only
    const alertChannel = payload.channel || 'default';
    
    // Only show if channels match
    const shouldShow = alertChannel === this.channel;
    
    if (!shouldShow) {
      console.log(`[AlertManager] Filtered out: ${payload.event_type} (channel: ${alertChannel}, listening: ${this.channel})`);
    }
    
    return shouldShow;
  }

  onAlert(payload) {
    if (!this.shouldDisplayAlert(payload)) {
      return; // Skip this alert
    }

    console.log(`[AlertManager] Displaying: ${payload.event_type} on channel: ${this.channel}`);
    this.alertQueue.push(payload);
    
    if (!this.currentAlert) {
      this.showNextAlert();
    }
  }

  // ... rest of alert display logic
}

// Initialize
const alertManager = new AlertManager();

socket.on('alert', (payload) => {
  alertManager.onAlert(payload);
});
```

### Phase 8.3: Frontend Service

**Create `browser-source-channels.ts` service:**

```typescript
import { ipcRenderer } from 'electron';

export interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  channel_name: string;
  description: string | null;
  icon: string;
  color: string;
  is_default: boolean;
}

export class BrowserSourceChannelsService {
  async list(): Promise<BrowserSourceChannel[]> {
    const result = await ipcRenderer.invoke('browser-source-channels:list');
    if (!result.success) {
      throw new Error(result.error || 'Failed to list channels');
    }
    return result.data;
  }

  async create(input: {
    channel_id: string;
    channel_name: string;
    description?: string;
    icon?: string;
    color?: string;
  }): Promise<number> {
    const result = await ipcRenderer.invoke('browser-source-channels:create', input);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create channel');
    }
    return result.data.id;
  }

  getBrowserSourceURL(channelId: string): string {
    if (channelId === 'default') {
      return 'http://localhost:3737/browser-source';
    }
    return `http://localhost:3737/browser-source?channel=${encodeURIComponent(channelId)}`;
  }

  copyURLToClipboard(channelId: string): void {
    const url = this.getBrowserSourceURL(channelId);
    navigator.clipboard.writeText(url);
  }
}

export const browserSourceChannelsService = new BrowserSourceChannelsService();
```

---

## 🎬 User Workflow Example

### Setup Process

**1. User creates channels:**
```
"Main Alerts" (main-alerts)
├─ Followers
├─ Subscribers  
├─ Gifted Subs
└─ Raids

"TTS Corner" (tts)
└─ TTS Channel Point Redemption

"Bit Counter" (bits)
├─ Bits (under 1000)
└─ Hype Train
```

**2. User adds OBS browser sources:**
```
OBS Scene 1 (Gameplay):
├─ Source 1: "Main Alerts" → http://localhost:3737/browser-source?channel=main-alerts
│  Position: Center (1920x1080, centered)
│  
├─ Source 2: "TTS" → http://localhost:3737/browser-source?channel=tts
│  Position: Bottom Left (640x200, x:50 y:880)
│  
└─ Source 3: "Bits" → http://localhost:3737/browser-source?channel=bits
   Position: Top Right (400x150, x:1470 y:50)
```

**3. New follower occurs:**
```
Event: channel.follow
Action Config: browser_source_channel = "main-alerts"
Result: Only OBS Source 1 displays the alert
```

**4. TTS redeemed:**
```
Event: channel.channel_points_custom_reward_redemption.add
Action Config: browser_source_channel = "tts"
Result: Only OBS Source 2 displays the alert
```

---

## 📋 Implementation Checklist

### Phase 8.1: Database Foundation
- [ ] Create migration v16: `browser_source_channels` table
- [ ] Add `browser_source_channel` column to `event_actions`
- [ ] Seed default channel
- [ ] Create BrowserSourceChannelsRepository
- [ ] Add IPC handlers

### Phase 8.2: Backend Integration
- [ ] Update EventActionProcessor to include channel in payload
- [ ] Update AlertPayload interface
- [ ] Update browser-source.js filtering logic
- [ ] Test channel filtering

### Phase 8.3: Frontend UI
- [ ] Create Channel Manager screen
- [ ] Create Channel Editor modal
- [ ] Add channel selector to Action Editor
- [ ] Create frontend service wrapper
- [ ] Add "Copy URL" functionality
- [ ] Add channel stats display

### Phase 8.4: Testing
- [ ] Test default channel (backwards compatibility)
- [ ] Test multiple channels
- [ ] Test channel filtering
- [ ] Test OBS integration
- [ ] Document setup guide

---

## 🎯 Benefits

### For Users
✅ **Complete Control** - Position different alerts in different locations  
✅ **Professional Setup** - Multiple browser sources like pro streamers  
✅ **Organized** - Group related events together  
✅ **Flexible** - Change assignments anytime

### For Developers
✅ **Backwards Compatible** - Default channel handles old behavior  
✅ **Scalable** - Add unlimited channels  
✅ **Clean Architecture** - Single broadcast, client-side filtering  
✅ **Minimal Changes** - Builds on existing infrastructure

---

## 📊 Example Configurations

### Beginner Setup
```
Channels: 1 (default)
OBS Sources: 1
└─ http://localhost:3737/browser-source
```

### Intermediate Setup
```
Channels: 2
├─ "alerts" (follows, subs, bits)
└─ "tts" (TTS only)

OBS Sources: 2
├─ http://localhost:3737/browser-source?channel=alerts (center)
└─ http://localhost:3737/browser-source?channel=tts (bottom)
```

### Advanced Setup
```
Channels: 4
├─ "hype-center" (big events)
├─ "passive-corner" (small events)
├─ "tts-bottom" (TTS)
└─ "special-events" (custom redemptions)

OBS Sources: 4 (positioned independently)
```

---

## 🚀 Next Steps

1. **Phase 8 Implementation** - Build Channel Manager + Editor
2. **Phase 9 Integration** - Add to Template Builder
3. **Phase 10 Testing** - Preview alerts on specific channels
4. **Phase 11 Go Live** - Deploy with real events
5. **Phase 12 Documentation** - User guide for OBS setup

---

**Status:** 📋 Ready for Phase 8 implementation  
**Priority:** HIGH - Core feature for professional streaming setup
