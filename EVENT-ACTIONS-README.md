# Event Actions System - Complete Technical Documentation

**Last Updated:** November 3, 2025  
**Feature Status:** ✅ Backend Integration Complete | ⏳ Frontend UI Pending  
**Build Status:** ✅ Passing (569 KiB, 0 TypeScript errors)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Data Flow](#data-flow)
5. [Browser Source Server](#browser-source-server)
6. [Event Action Processor](#event-action-processor)
7. [Template Variables](#template-variables)
8. [Browser Source Channels](#browser-source-channels)
9. [File Structure](#file-structure)
10. [Integration Points](#integration-points)
11. [Testing](#testing)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The **Event Actions System** allows Stream Synth to trigger customizable alerts (text, sound, image, video) when Twitch events occur. These alerts can be displayed in:

1. **Browser Source (OBS)** - Overlay alerts on stream via OBS browser source
2. **In-App Alerts** - Display alerts directly within Stream Synth (future feature)

### Key Features

✅ **Real-Time Event Processing** - Integrates with EventSub for instant alerts  
✅ **Template System** - Dynamic text with variable substitution (`{{username}}`, `{{display_name}}`, etc.)  
✅ **Multi-Media Support** - Text, sound files, images, videos  
✅ **Browser Source Server** - Socket.IO server on port 7474  
✅ **Channel Filtering** - Multiple browser sources with independent alert channels  
✅ **Queueing System** - Sequential alert display with auto-dismiss  
✅ **Shared Formatter** - Consistent event formatting across all screens  

### Current Status

**Completed (Phases 10.5 - 11):**
- ✅ Database schema with browser source channels
- ✅ Browser Source Server (HTTP + Socket.IO on port 7474)
- ✅ Event Action Processor service
- ✅ EventSub integration (real events → alerts)
- ✅ Template variable system with aliases
- ✅ Channel filtering infrastructure
- ✅ Shared event formatter
- ✅ Browser source client (HTML/CSS/JS)
- ✅ Debug UI toggle (`?debug=true`)

**Pending (Future Phases):**
- ⏳ Frontend UI (Event Actions configuration screen)
- ⏳ In-app alert popup component
- ⏳ Media file picker
- ⏳ Visual template builder
- ⏳ Channel management UI

---

## Architecture

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TWITCH EVENTSUB                          │
│                    (WebSocket Events Stream)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EventSubManager.handleMessage()                │
│              (src/backend/services/eventsub-manager.ts)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                EventSubEventRouter.routeEvent()                  │
│           (src/backend/services/eventsub-event-router.ts)        │
│                                                                  │
│  switch (eventType) {                                           │
│    case 'channel.follow': handleFollowEvent();                  │
│    case 'channel.subscribe': handleSubscribeEvent();            │
│    // ... 41+ event types                                       │
│  }                                                               │
│                                                                  │
│  Each handler calls: storeAndEmitEvent(...)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     storeAndEmitEvent()                          │
│                                                                  │
│  1. Store to database (EventsRepository)                        │
│  2. Emit to frontend (webContents.send('event:stored'))         │
│  3. Process Event Actions (NEW) ──────┐                         │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           EventActionProcessor.processEvent()                    │
│        (src/backend/services/event-action-processor.ts)          │
│                                                                  │
│  1. Query EventActionsRepository for config                     │
│  2. If disabled → return early                                  │
│  3. Format event using shared formatter                         │
│  4. Process template variables ({{username}}, etc.)             │
│  5. Validate media files exist                                  │
│  6. Build alert payload                                         │
│  7. Emit to destinations ↓                                      │
└───────────────────┬────────────────────────┬────────────────────┘
                    │                        │
          ┌─────────▼────────┐    ┌──────────▼────────┐
          │   In-App Alert   │    │  Browser Source   │
          │  (Future)        │    │  (Socket.IO)      │
          │                  │    │                    │
          │ webContents.send │    │  io.emit('alert') │
          │ 'alert:show'     │    │                    │
          └──────────────────┘    └──────────┬────────┘
                                             │
                                             ▼
                               ┌──────────────────────────┐
                               │  Browser Source Client   │
                               │  (OBS Browser Source)    │
                               │                          │
                               │  • Socket.IO connection  │
                               │  • Channel filtering     │
                               │  • Alert queue system    │
                               │  • Auto-dismiss timers   │
                               └──────────────────────────┘
```

---

## Database Schema

### Table: `event_actions`

Stores configuration for each event type (what to display, where to display it).

```sql
CREATE TABLE IF NOT EXISTS event_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,              -- Twitch channel ID
  event_type TEXT NOT NULL,              -- e.g., 'channel.follow', 'channel.subscribe'
  is_enabled INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled
  
  -- Browser Source Channel Assignment (Phase 10.5)
  browser_source_channel TEXT DEFAULT 'default',  -- Which browser source channel to use
  
  -- Text Alert Configuration
  text_enabled INTEGER DEFAULT 0,
  text_template TEXT,                    -- Template with variables: "{{username}} just followed!"
  text_duration INTEGER DEFAULT 5000,    -- Display duration in milliseconds
  text_position TEXT DEFAULT 'center',   -- 'top', 'center', 'bottom'
  text_style TEXT,                       -- JSON: { fontSize: 48, color: '#fff', ... }
  
  -- Sound Alert Configuration
  sound_enabled INTEGER DEFAULT 0,
  sound_file_path TEXT,                  -- Full path to .mp3/.wav file
  sound_volume REAL DEFAULT 1.0,         -- 0.0 to 1.0
  
  -- Image Alert Configuration
  image_enabled INTEGER DEFAULT 0,
  image_file_path TEXT,                  -- Full path to .png/.jpg/.gif file
  image_duration INTEGER DEFAULT 3000,   -- Display duration in milliseconds
  image_position TEXT DEFAULT 'center',
  image_width INTEGER,                   -- Optional width in pixels
  image_height INTEGER,                  -- Optional height in pixels
  
  -- Video Alert Configuration
  video_enabled INTEGER DEFAULT 0,
  video_file_path TEXT,                  -- Full path to .mp4/.webm file
  video_volume REAL DEFAULT 1.0,
  video_position TEXT DEFAULT 'center',
  video_width INTEGER,
  video_height INTEGER,
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(channel_id, event_type)
);
```

### Table: `browser_source_channels`

Stores named channels for filtering alerts to specific browser sources.

```sql
CREATE TABLE IF NOT EXISTS browser_source_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,              -- Twitch channel ID
  name TEXT NOT NULL,                    -- URL-safe name: 'default', 'main-alerts', 'tts'
  display_name TEXT NOT NULL,            -- Human-readable: 'Default Channel', 'Main Alerts'
  description TEXT,                      -- User notes
  is_default INTEGER DEFAULT 0,          -- 1 = default channel
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(channel_id, name)
);

-- Default channel created automatically for each Twitch channel
-- during migration initialization
```

### Migration Version

Current schema version: **v15** (includes Event Actions tables)

**Migration Function:** `initializeDatabaseTables()` in `src/backend/database/migrations.ts`

**Auto-Initialization:** `initializeDefaultChannel()` creates a 'default' browser source channel for each connected Twitch channel on first run.

---

## Data Flow

### Example: New Follower Event

**Step 1: Twitch Sends EventSub Notification**
```json
{
  "subscription": { "type": "channel.follow" },
  "event": {
    "user_id": "12345",
    "user_login": "johndoe",
    "user_name": "JohnDoe",
    "followed_at": "2025-11-01T12:34:56Z"
  }
}
```

**Step 2: EventSubManager Routes to EventSubEventRouter**

**Step 3: EventSubEventRouter.handleFollowEvent()**
- Creates viewer record in database
- Records to `follower_history` table
- Calls `storeAndEmitEvent('channel.follow', eventData, ...)`

**Step 4: storeAndEmitEvent() Processing**
```typescript
private storeAndEmitEvent(
  eventType: string,
  eventData: any,
  viewerUsername?: string,
  viewerDisplayName?: string,
  channelId: string,
  createdAt: string
): number {
  // 1. Store event to database
  const eventId = this.eventsRepo.storeEvent({
    event_type: eventType,
    event_data: JSON.stringify(eventData),
    viewer_username: viewerUsername,
    viewer_display_name: viewerDisplayName,
    channel_id: channelId,
    created_at: createdAt
  });
  
  // 2. Emit to frontend
  this.emitToFrontend('event:stored', { eventId, eventType, ... });
  
  // 3. Process Event Actions (NEW)
  if (this.eventActionProcessor) {
    this.eventActionProcessor.processEvent({
      event_type: eventType,
      event_data: eventData,
      viewer_username: viewerUsername,
      viewer_display_name: viewerDisplayName,
      channel_id: channelId,
      created_at: createdAt
    }).catch((error) => {
      console.error('[EventSubEventRouter] Error processing event action:', error);
    });
  }
  
  return eventId;
}
```

**Step 5: EventActionProcessor.processEvent()**
```typescript
async processEvent(eventData: EventSubEventData): Promise<void> {
  const { event_type, channel_id } = eventData;
  
  // Get action configuration
  const action = this.repository.getByEventType(channel_id, event_type);
  
  // Return early if disabled or not found
  if (!action || !action.is_enabled) {
    return;
  }
  
  // Check if any media is enabled
  const hasAnyMedia = action.text_enabled || action.sound_enabled || 
                      action.image_enabled || action.video_enabled;
  if (!hasAnyMedia) {
    return;
  }
  
  // Format event using shared formatter
  const formatted = formatEvent(eventData);
  
  // Build alert payload
  const payload: AlertPayload = {
    event_type,
    channel_id,
    channel: action.browser_source_channel || 'default',  // Browser source channel
    formatted,
    timestamp: new Date().toISOString()
  };
  
  // Process text alert
  if (action.text_enabled && action.text_template) {
    const content = processTemplate(action.text_template, formatted.variables);
    payload.text = {
      content,
      duration: action.text_duration,
      position: action.text_position,
      style: action.text_style ? this.parseJSON(action.text_style) : undefined
    };
  }
  
  // Process sound/image/video (if enabled and files exist)
  // ... similar logic for each media type ...
  
  // Emit to browser source
  if (this.browserSourceServer) {
    this.browserSourceServer.io.emit('alert', payload);
  }
  
  // Emit to in-app (future)
  if (this.mainWindow) {
    this.mainWindow.webContents.send('alert:show', payload);
  }
}
```

**Step 6: Browser Source Client Receives Alert**
```javascript
socket.on('alert', (payload) => {
  console.log('[BrowserSource] Alert received:', payload.event_type);
  
  // Filter by channel
  if (payload.channel !== this.channel) {
    console.log('[BrowserSource] Filtered out: wrong channel');
    return;
  }
  
  // Add to queue
  this.alertQueue.push(payload);
  
  // Process queue
  if (!this.currentAlert) {
    this.showNextAlert();
  }
});
```

**Step 7: Alert Displayed in Browser Source**
```html
<div class="alert center">
  <p class="alert-text">🎉 JohnDoe just followed! ❤️</p>
</div>
```

Alert displays for configured duration (e.g., 5 seconds), then auto-dismisses.

---

## Browser Source Server

### Location
`src/backend/services/browser-source-server.ts`

### Purpose
Provides an HTTP server with Socket.IO for real-time alert delivery to OBS browser sources.

### Key Features

**1. HTTP Server**
- Port: `7474` (configurable)
- Serves static files from `dist/backend/public/`
- Routes:
  - `GET /` → Returns "Stream Synth Browser Source Server"
  - `GET /alert` → Serves `browser-source.html`
  - `GET /test` → Emits test alert (for debugging)

**2. Socket.IO Server**
- Real-time bidirectional communication
- Events:
  - `connection` - Client connects
  - `disconnect` - Client disconnects
  - `alert` - Emit alert to all connected clients

**3. CORS Configuration**
- Origin: `*` (allows any origin)
- Methods: `GET, POST`

### Code Structure

```typescript
export class BrowserSourceServer {
  private app: any;
  private httpServer: any;
  public io: any;  // Socket.IO instance
  private port: number;

  constructor(port: number = 7474) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupRoutes(): void {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Health check
    this.app.get('/', (req, res) => {
      res.send('Stream Synth Browser Source Server');
    });
    
    // Browser source page
    this.app.get('/alert', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'browser-source.html'));
    });
    
    // Test endpoint
    this.app.get('/test', (req, res) => {
      this.io.emit('alert', {
        event_type: 'test',
        channel: 'default',
        formatted: {
          html: '<strong>Test User</strong> just followed!',
          plainText: 'Test User just followed!',
          emoji: '💜',
          variables: { username: 'Test User' }
        },
        text: {
          content: 'Test User just followed!',
          duration: 5000,
          position: 'center'
        },
        timestamp: new Date().toISOString()
      });
      
      res.send('Test alert sent!');
    });
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket: any) => {
      console.log('[BrowserSourceServer] Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('[BrowserSourceServer] Client disconnected:', socket.id);
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`[BrowserSourceServer] Server started on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): void {
    if (this.httpServer) {
      this.httpServer.close();
      console.log('[BrowserSourceServer] Server stopped');
    }
  }
}
```

### URL Patterns

**Default Channel (all alerts):**
```
http://localhost:7474/alert
```

**Specific Channel (filtered alerts):**
```
http://localhost:7474/alert?channel=main-alerts
http://localhost:7474/alert?channel=tts
http://localhost:7474/alert?channel=hype-events
```

**Debug Mode (shows connection status):**
```
http://localhost:7474/alert?debug=true
http://localhost:7474/alert?channel=main-alerts&debug=true
```

---

## Event Action Processor

### Location
`src/backend/services/event-action-processor.ts`

### Purpose
Central service that processes incoming events and triggers alerts based on configuration.

### Key Responsibilities

1. **Load Action Config** - Query database for event type configuration
2. **Format Event** - Use shared formatter for consistent data
3. **Process Templates** - Replace variables in text templates
4. **Validate Files** - Check if media files exist before including
5. **Build Payload** - Construct alert payload with all media
6. **Emit Alerts** - Send to browser source and/or in-app

### Interfaces

```typescript
// Input from EventSub
export interface EventSubEventData {
  event_type: string;
  event_data: any;
  viewer_username?: string;
  viewer_display_name?: string;
  channel_id: string;
  created_at: string;
}

// Output to browser source
export interface AlertPayload {
  event_type: string;
  channel_id: string;
  channel: string;  // Browser source channel name
  
  formatted: {
    html: string;
    plainText: string;
    emoji: string;
    variables: Record<string, any>;
  };
  
  text?: {
    content: string;
    duration: number;
    position: string;
    style?: any;
  };
  
  sound?: {
    file_path: string;
    volume: number;
  };
  
  image?: {
    file_path: string;
    duration: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  video?: {
    file_path: string;
    volume: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  timestamp: string;
}
```

### Processing Logic

```typescript
async processEvent(eventData: EventSubEventData): Promise<void> {
  // 1. Get configuration
  const action = this.repository.getByEventType(
    eventData.channel_id,
    eventData.event_type
  );
  
  // 2. Early returns
  if (!action || !action.is_enabled) return;
  if (!this.hasAnyMediaEnabled(action)) return;
  
  // 3. Format event
  const formatted = formatEvent(eventData);
  
  // 4. Build payload
  const payload: AlertPayload = {
    event_type: eventData.event_type,
    channel_id: eventData.channel_id,
    channel: action.browser_source_channel || 'default',
    formatted,
    timestamp: new Date().toISOString()
  };
  
  // 5. Process media types
  if (action.text_enabled && action.text_template) {
    payload.text = await this.processTextAlert(action, formatted);
  }
  
  if (action.sound_enabled && action.sound_file_path) {
    if (await this.validateFile(action.sound_file_path, ['mp3', 'wav', 'ogg'])) {
      payload.sound = {
        file_path: action.sound_file_path,
        volume: action.sound_volume
      };
    }
  }
  
  // Similar for image and video...
  
  // 6. Emit to destinations
  this.emitAlert(payload);
}
```

### File Validation

```typescript
private async validateFile(filePath: string, allowedExtensions: string[]): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (!allowedExtensions.includes(ext)) {
      console.warn(`[EventActionProcessor] Invalid file extension: ${ext}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn(`[EventActionProcessor] File not found: ${filePath}`);
    return false;
  }
}
```

---

## Template Variables

### System

The template system supports dynamic variable substitution using mustache-style syntax: `{{variable_name}}`.

### Processing Function

Located in `src/shared/utils/event-formatter.ts`:

```typescript
export function processTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  
  return result;
}
```

### Common Variables (All Events)

These variables are available for ALL event types:

| Variable | Aliases | Description | Example |
|----------|---------|-------------|---------|
| `username` | `display_name`, `user_name` | Viewer's display name | `JohnDoe` |
| `event_type` | - | Event type identifier | `channel.follow` |
| `timestamp` | - | ISO 8601 timestamp | `2025-11-01T12:34:56Z` |

**Note:** All three username aliases (`username`, `display_name`, `user_name`) resolve to the same value. This provides flexibility in template authoring.

### Event-Specific Variables

Additional variables available per event type:

#### Follow Events (`channel.follow`)
- `followed_at` - Formatted follow timestamp
- `user_login` - Lowercase username
- `user_id` - Twitch user ID

#### Subscribe Events (`channel.subscribe`)
- `tier` - Subscription tier (`Tier 1`, `Tier 2`, `Tier 3`)
- `is_gift` - Boolean indicating if sub was gifted

#### Cheer Events (`channel.cheer`)
- `bits` - Number of bits cheered
- `message` - Cheer message text (if included)

#### Raid Events (`channel.raid`)
- `viewers` - Number of raiders
- `from_broadcaster_user_login` - Raiding channel name

#### Subscription Gift Events (`channel.subscription.gift`)
- `tier` - Subscription tier
- `gift_count` - Number of subs gifted in this event
- `cumulative` - Total lifetime gifted subs
- `gifter` - Name of the gifter
- `is_anonymous` - Boolean if gift was anonymous

### Template Examples

**Follow Alert:**
```
{{username}} just followed! ❤️
```
Output: `JohnDoe just followed! ❤️`

**Subscribe Alert:**
```
🎉 {{username}} subscribed at {{tier}}!
```
Output: `🎉 JohnDoe subscribed at Tier 1!`

**Cheer Alert:**
```
{{username}} cheered {{bits}} bits! 💎
```
Output: `JohnDoe cheered 500 bits! 💎`

**Raid Alert:**
```
🔥 {{username}} raided with {{viewers}} viewers!
```
Output: `🔥 JohnDoe raided with 50 viewers!`

**Gift Sub Alert:**
```
💝 {{gifter}} gifted {{gift_count}} subs ({{cumulative}} total)!
```
Output: `💝 JaneDoe gifted 5 subs (25 total)!`

### Undefined Variables

If a template references a variable that doesn't exist, it's replaced with an empty string:

```
Template: {{nonexistent}} did something
Output:    did something
```

No errors are thrown - the system gracefully handles missing variables.

---

## Browser Source Channels

### Concept

Browser Source Channels allow users to split alerts across multiple OBS browser sources. Each channel acts as an independent stream of alerts.

### Use Cases

**Beginner Setup (1 channel):**
- Single browser source shows all alerts
- URL: `http://localhost:7474/alert`

**Intermediate Setup (2 channels):**
- Channel "main" - Followers, subs, raids (center screen)
- Channel "tts" - TTS messages only (bottom corner)

**Advanced Setup (4+ channels):**
- Channel "hype-center" - Big events (center, large)
- Channel "passive-corner" - Small events (corner, subtle)
- Channel "tts-bottom" - TTS (bottom bar)
- Channel "special-top" - Custom redemptions (top bar)

### How It Works

**1. Database Configuration**

Each event action has a `browser_source_channel` field (default: `'default'`):

```sql
UPDATE event_actions 
SET browser_source_channel = 'main-alerts'
WHERE event_type = 'channel.follow';
```

**2. Payload Includes Channel**

When processing an event, the channel name is included in the alert payload:

```typescript
const payload: AlertPayload = {
  event_type: 'channel.follow',
  channel: action.browser_source_channel || 'default',  // 'main-alerts'
  // ... rest of payload
};
```

**3. Client-Side Filtering**

Each browser source instance parses the `?channel=` query parameter and filters alerts:

```javascript
class BrowserSourceClient {
  constructor() {
    // Parse channel from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.channel = urlParams.get('channel') || 'default';
  }
  
  handleAlert(payload) {
    // Only display if channels match
    if (payload.channel !== this.channel) {
      console.log(`[BrowserSource] Filtered: ${payload.channel} !== ${this.channel}`);
      return;
    }
    
    // Display alert
    this.displayAlert(payload);
  }
}
```

**4. OBS Setup**

User adds multiple browser sources in OBS:

```
Source 1: http://localhost:7474/alert?channel=main-alerts
  Position: Center (1920x1080)
  
Source 2: http://localhost:7474/alert?channel=tts
  Position: Bottom Left (640x200)
  
Source 3: http://localhost:7474/alert?channel=hype
  Position: Top Right (400x150)
```

### Default Channel

The `'default'` channel is special:
- Created automatically during migration
- Used when `browser_source_channel` is NULL or not specified
- Accessed via `http://localhost:7474/alert` (no query parameter)

### Channel Management (Future)

**Planned Features:**
- UI to create/edit/delete channels
- Channel selector in event action editor
- Visual channel overview (which events go where)
- URL copy button per channel
- Channel icons and colors for organization

**Not Yet Implemented:**
- Frontend UI for channel management
- IPC handlers for channel CRUD operations
- Frontend service wrapper

**Current Workaround:**
Manually insert channels into database:

```sql
INSERT INTO browser_source_channels (channel_id, name, display_name, is_default, created_at, updated_at)
VALUES ('ch_123', 'main-alerts', 'Main Alerts', 0, datetime('now'), datetime('now'));
```

---

## File Structure

### Backend Files

```
src/backend/
├── database/
│   ├── migrations.ts                         # Schema v15 with Event Actions tables
│   └── repositories/
│       ├── event-actions.ts                  # CRUD for event_actions table
│       └── browser-source-channels.ts        # CRUD for browser_source_channels (future)
│
├── services/
│   ├── event-action-processor.ts             # Core processing service
│   ├── browser-source-server.ts              # HTTP + Socket.IO server
│   └── eventsub-event-router.ts              # EventSub integration point
│
├── public/                                    # Served by browser source server
│   ├── browser-source.html                   # Browser source page
│   ├── browser-source.css                    # Styles for alerts
│   └── browser-source.js                     # Client-side logic
│
└── core/
    └── ipc-handlers/
        └── event-actions.ts                  # IPC handlers (future)
```

### Frontend Files (Future)

```
src/frontend/
├── screens/
│   └── event-actions/
│       ├── event-actions.tsx                 # Main configuration screen
│       └── components/
│           ├── ActionEditor.tsx              # Edit single event action
│           ├── ChannelManager.tsx            # Manage browser source channels
│           ├── TemplateBuilder.tsx           # Visual template editor
│           ├── MediaPicker.tsx               # File selection dialogs
│           ├── PresetTemplates.tsx           # Built-in template library
│           └── AlertPreview.tsx              # Live preview of alerts
│
├── components/
│   └── AlertPopup.tsx                        # In-app alert display component
│
└── services/
    ├── event-actions.ts                      # IPC wrapper for event actions
    └── browser-source-channels.ts            # IPC wrapper for channels
```

### Shared Files

```
src/shared/
└── utils/
    └── event-formatter.ts                    # Shared formatting logic
        ├── formatEvent()                     # Format event to HTML/text/variables
        ├── processTemplate()                 # Replace {{variables}} in templates
        └── getAvailableVariables()           # List variables per event type
```

---

## Integration Points

### 1. EventSubEventRouter Integration

**File:** `src/backend/services/eventsub-event-router.ts`

**Changes Made:**

```typescript
import { EventActionProcessor } from './event-action-processor';

export class EventSubEventRouter extends EventEmitter {
  private eventActionProcessor: EventActionProcessor | null = null;
  
  constructor(
    mainWindow?: BrowserWindow | null,
    ttsInitializer?: () => Promise<any>
  ) {
    // ... existing initialization ...
  }
  
  /**
   * Set event action processor (called from main.ts)
   */
  setEventActionProcessor(processor: EventActionProcessor): void {
    this.eventActionProcessor = processor;
    console.log('[EventSubEventRouter] Event action processor connected');
  }
  
  /**
   * Store event and emit to frontend (MODIFIED)
   */
  private storeAndEmitEvent(
    eventType: string,
    eventData: any,
    viewerUsername?: string,
    viewerDisplayName?: string,
    channelId: string,
    createdAt: string
  ): number {
    // 1. Store to database
    const eventId = this.eventsRepo.storeEvent({ ... });
    
    // 2. Emit to frontend
    this.emitToFrontend('event:stored', { ... });
    
    // 3. Process event actions (NEW)
    if (this.eventActionProcessor) {
      this.eventActionProcessor.processEvent({
        event_type: eventType,
        event_data: eventData,
        viewer_username: viewerUsername,
        viewer_display_name: viewerDisplayName,
        channel_id: channelId,
        created_at: createdAt
      }).catch((error) => {
        console.error('[EventSubEventRouter] Error processing event action:', error);
      });
    }
    
    return eventId;
  }
}
```

### 2. Main.ts Initialization

**File:** `src/backend/main.ts`

**Initialization Order:**

```typescript
// 1. Initialize browser source server
const browserSourceServer = new BrowserSourceServer(7474);
await browserSourceServer.start();
console.log('[Main] Browser source server started');

// 2. Initialize event action processor
const eventActionProcessor = new EventActionProcessor(mainWindow);
eventActionProcessor.setBrowserSourceServer(browserSourceServer);
console.log('[Main] Event action processor initialized');

// 3. Get EventSub router and connect processor
const router = getEventSubRouter(mainWindow, ttsInitializer);
router.setEventActionProcessor(eventActionProcessor);
console.log('[Main] Event action processor connected to EventSub router');
```

**Important:** Browser source server must start BEFORE event action processor is created.

### 3. Event Formatter Integration

**File:** `src/shared/utils/event-formatter.ts`

**Shared Function Usage:**

```typescript
import { formatEvent, processTemplate } from '../../shared/utils/event-formatter';

// In EventActionProcessor
const formatted = formatEvent(eventData);

// In template processing
const content = processTemplate(action.text_template, formatted.variables);
```

**Benefits:**
- Consistent event formatting across Events screen and Event Actions
- Single source of truth for variable extraction
- Shared template processing logic

---

## Testing

### Manual Testing Steps

**1. Start Application**
```bash
npm start
```

**Expected Console Logs:**
```
[BrowserSourceServer] Server started on port 7474
[EventActionProcessor] Initialized
[EventSubEventRouter] Event action processor connected
```

**2. Open Browser Source**

Navigate to: `http://localhost:7474/alert`

**Expected:**
- Blank transparent page
- Browser console: `[BrowserSource] Connected to server`

**Debug Mode:** Add `?debug=true` to see connection status:
```
http://localhost:7474/alert?debug=true
```

**3. Test Alert Endpoint**

Visit: `http://localhost:7474/test`

**Expected:**
- Test alert appears in browser source
- Alert text: "Test User just followed!"
- Alert auto-dismisses after 5 seconds

**4. Real Event Testing**

Trigger a real Twitch event (follow, subscribe, etc.)

**Expected Console Flow:**
```
[EventRouter] Processing follow event: johndoe
[EventRouter→EventActions] Processing event action
[EventActionProcessor] Processing event: channel.follow
[EventActionProcessor] Found action config (enabled: true)
[EventActionProcessor] Emitting to browser source
[BrowserSourceServer] Emitting alert to 1 client(s)
```

**Browser Console:**
```
[BrowserSource] Alert received: channel.follow
[BrowserSource] Displaying: Test User just followed!
```

### Automated Testing (Future)

**Unit Tests:**
- Template variable replacement
- File validation logic
- Payload construction
- Channel filtering

**Integration Tests:**
- EventSub → Processor → Browser Source flow
- Multiple browser sources with different channels
- Queue management and auto-dismiss
- Reconnection handling

**Current Status:** No automated tests yet implemented.

---

## Future Enhancements

### Phase 12: Testing & Refinement (Current)
- ⏳ End-to-end integration testing
- ⏳ Performance testing (rapid fire events)
- ⏳ Error handling validation
- ⏳ Documentation review

### Phase 13: Frontend UI
- ⏳ Event Actions configuration screen
- ⏳ Event action editor (text/sound/image/video tabs)
- ⏳ Template builder with variable picker
- ⏳ Media file picker dialogs
- ⏳ Live preview of alerts

### Phase 14: In-App Alerts
- ⏳ AlertPopup.tsx component
- ⏳ IPC handler for 'alert:show'
- ⏳ Queue management in React
- ⏳ Notification positioning

### Phase 15: Browser Source Channel UI
- ⏳ Channel manager screen
- ⏳ Create/edit/delete channels
- ⏳ Channel selector in action editor
- ⏳ Visual channel overview
- ⏳ URL copy buttons

### Phase 16: Advanced Features
- ⏳ Animation customization (fade, slide, bounce)
- ⏳ Font selection for text alerts
- ⏳ Color picker for styling
- ⏳ Alert history and replay
- ⏳ Conditional actions (if viewer is sub, show different alert)

### TTS Browser Source Integration (Separate Feature)
- ⏳ TTS audio output to browser source
- ⏳ No virtual audio cables needed
- ⏳ Web Speech API in browser
- ⏳ Simple toggle in TTS settings
- ⏳ Reuses existing browser source infrastructure

**Note:** TTS is NOT an event action. It's a parallel feature that shares the browser source server. See `FUTURE-PLANS/TTS-BROWSER-SOURCE-FEATURE.md` for details.

---

## Troubleshooting

### Browser Source Won't Connect

**Symptoms:**
- Browser console shows connection errors
- No alerts appearing

**Solutions:**
1. Verify app is running
2. Check port 7474 is not blocked by firewall
3. Confirm browser source server started (check console logs)
4. Try `http://localhost:7474/` to verify server is responding

### Template Variables Not Replacing

**Symptoms:**
- Alert shows `{{username}}` literally
- Variables not substituted

**Solutions:**
1. Verify you're using correct variable names (check `getAvailableVariables()`)
2. Ensure event formatter is running (check `formatted.variables` in logs)
3. Check for typos in template: `{{user name}}` vs `{{username}}`
4. Use aliases: `{{display_name}}`, `{{user_name}}`, `{{username}}` all work

### Alerts Not Appearing

**Symptoms:**
- Events occur but no alerts show

**Debug Steps:**
1. Check if event action exists in database:
   ```sql
   SELECT * FROM event_actions WHERE event_type = 'channel.follow';
   ```

2. Verify action is enabled:
   ```sql
   SELECT is_enabled, text_enabled, sound_enabled 
   FROM event_actions 
   WHERE event_type = 'channel.follow';
   ```

3. Check console for errors in EventActionProcessor

4. Verify browser source channel matches:
   ```javascript
   // In browser console
   console.log(new URLSearchParams(window.location.search).get('channel'));
   ```

### Wrong Channel Filtering

**Symptoms:**
- Alerts appear in wrong browser source
- All alerts show despite channel filter

**Solutions:**
1. Verify `browser_source_channel` in database matches URL parameter
2. Check case sensitivity: `main-alerts` !== `Main-Alerts`
3. Ensure client-side filtering logic is working (check browser console)

### File Not Found Warnings

**Symptoms:**
- Console shows "File not found" warnings
- Sound/image/video not playing

**Solutions:**
1. Use absolute file paths: `C:/alerts/sounds/cheer.mp3`
2. Verify file exists at that location
3. Check file extension is allowed (mp3, wav, png, jpg, mp4, etc.)
4. Ensure file is not in use by another program

---

## API Reference

### EventActionProcessor Methods

```typescript
class EventActionProcessor {
  /**
   * Set browser source server for alert delivery
   */
  setBrowserSourceServer(server: BrowserSourceServer): void
  
  /**
   * Process an incoming event
   */
  async processEvent(eventData: EventSubEventData): Promise<void>
  
  /**
   * Validate that a media file exists and has correct extension
   */
  private async validateFile(filePath: string, allowedExtensions: string[]): Promise<boolean>
  
  /**
   * Parse JSON safely with error handling
   */
  private parseJSON(jsonString: string): any | null
}
```

### BrowserSourceServer Methods

```typescript
class BrowserSourceServer {
  /**
   * Start HTTP server and Socket.IO
   */
  async start(): Promise<void>
  
  /**
   * Stop server
   */
  stop(): void
  
  /**
   * Access Socket.IO instance
   */
  public io: SocketIOServer
}
```

### Event Formatter Functions

```typescript
/**
 * Format an event for display
 * Returns HTML, plain text, emoji, and extracted variables
 */
export function formatEvent(event: EventData): FormattedEvent

/**
 * Process a template string with variable substitution
 */
export function processTemplate(template: string, variables: Record<string, any>): string

/**
 * Get list of available template variables for an event type
 */
export function getAvailableVariables(eventType: string): string[]
```

---

## Summary

The Event Actions system is **functionally complete** at the backend integration level. Key achievements:

✅ **Backend Infrastructure** - Database, repositories, processor, server all implemented  
✅ **Real-Time Integration** - EventSub events trigger alerts immediately  
✅ **Template System** - Dynamic variable substitution with aliases  
✅ **Browser Source** - OBS integration via Socket.IO  
✅ **Channel Filtering** - Multiple browser sources with independent alert streams  
✅ **Shared Formatter** - Consistent event formatting across the app  

**Next Steps:** Frontend UI development (Phases 13-15) to enable user configuration of event actions without manual database editing.

**Current Workaround:** Event actions can be manually configured by inserting/updating rows in the `event_actions` table via SQL.

---

**Last Updated:** November 3, 2025  
**Schema Version:** v15  
**Build Status:** ✅ Passing (569 KiB, 0 errors)  
**Integration Status:** ✅ Complete (EventSub → Processor → Browser Source)
