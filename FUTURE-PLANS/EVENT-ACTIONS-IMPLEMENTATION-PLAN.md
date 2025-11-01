# Event Actions - Implementation Plan

**Status:** 🔨 **IN PROGRESS** - Phase 4/12 Complete  
**Created:** November 1, 2025  
**Last Updated:** November 1, 2025 21:15 GMT  
**Dependencies:** Phase 1-3 (Polling Events) ✅ COMPLETE  
**Estimated Time:** 40-55 hours (18h spent, 22-37h remaining)

---

## Overview

Event Actions enables customizable alerts (text, sound, image, video) for all Twitch events. Alerts can be displayed in-app and/or broadcast to OBS via browser source.

## User Requirements (Confirmed)

### ✅ Scope
- **All 4 media types**: Text, Sound, Image, Video
- **Per-event configuration**: One action config per event type per channel
- **Simple triggers**: Event type only (no conditions initially)
- **Unlimited actions**: No limit per channel

### ✅ Browser Source
- **Integration pattern**: Follow existing EventSub → Frontend flow
- **Use case**: OBS overlay showing formatted Twitch chat, follower alerts with video clips, etc.
- **Delivery**: Real-time via Socket.IO

### ✅ Alert Behavior
- **Queue system**: Alerts queue and display sequentially
- **Configurable duration**: User decides display time per action
- **No auto-dismiss**: Stay visible until duration expires

### ✅ Template System
- **Template Builder UI**: Visual editor for creating custom templates
- **Preset templates**: Pre-built templates for common scenarios
- **Variables**: Optional from start ({{username}}, {{event_type}}, etc.)
- **Advanced text styling**: Full customization (fonts, colors, animations, etc.)

### ✅ Media Files
- **File picker**: Yes, user selects files via dialog
- **Formats**: All HTML-supported formats (MP3/WAV, PNG/GIF/JPG, MP4/WebM)
- **Validation**: Yes, before saving
- **Size limits**: Not yet (future enhancement)
- **Storage**: User-selected paths (absolute paths)
- **Validation on trigger**: Yes, check files exist

### ✅ Media Playback
- **Volume control**: Yes, per action
- **Image duration**: Yes, configurable
- **Video looping**: No (not initially)
- **Fade animations**: No (not initially)

### ✅ Database
- **Event tracking**: Not yet (skip action usage statistics for now)
- **Just store configs**: Focus on action configuration only

### ✅ UI/UX
- **Skeleton approach**: Build initial UI, refine iteratively
- **Menu location**: TBD (likely between Events and Advanced)

---

## Architecture

### Integration Pattern (Following Existing EventSub Flow)

```
EventSub WebSocket
    ↓
EventSubManager.handleMessage()
    ↓
EventSubEventRouter.routeEvent()
    ↓
storeAndEmitEvent() → Database + Frontend emit
    ↓
🆕 EventActionProcessor.processEvent()
    ↓
    ├→ In-App Alert (webContents.send)
    └→ Browser Source (Socket.IO broadcast)
```

### File Structure

```
Backend:
  src/backend/database/repositories/event-actions.ts           # CRUD for action configs
  src/backend/services/event-action-processor.ts               # Process events → trigger alerts
  src/backend/services/browser-source-server.ts                # HTTP + Socket.IO server
  src/backend/core/ipc-handlers/event-actions.ts               # Frontend ↔ Backend bridge
  src/shared/utils/event-formatter.ts                          # Shared formatting logic

Frontend:
  src/frontend/screens/event-actions/event-actions.tsx         # Main configuration screen
  src/frontend/screens/event-actions/components/
    ├── ActionEditor.tsx                                       # Edit single action
    ├── TemplateBuilder.tsx                                    # Visual template editor
    ├── MediaPicker.tsx                                        # File selection UI
    ├── PresetTemplates.tsx                                    # Built-in templates
    └── AlertPreview.tsx                                       # Live preview component
  src/frontend/components/AlertPopup.tsx                       # In-app alert display
  src/frontend/services/event-actions.ts                       # IPC wrapper

Database:
  src/backend/database/migrations.ts                           # Add event_actions table
```

---

## Database Schema

### Migration Version 15: `event_actions` Table

```sql
CREATE TABLE IF NOT EXISTS event_actions (
  id TEXT PRIMARY KEY,                          -- UUID
  channel_id TEXT NOT NULL,                     -- FK to channels
  event_type TEXT NOT NULL,                     -- 'channel.subscribe', 'channel.follow', etc.
  enabled INTEGER DEFAULT 1,                    -- 0 = disabled, 1 = enabled
  
  -- Display targets
  show_in_app INTEGER DEFAULT 1,                -- Show in-app popup
  show_in_browser_source INTEGER DEFAULT 0,     -- Expose via browser source
  
  -- Media configurations (JSON strings)
  text_config TEXT,                             -- { enabled, template, style }
  sound_config TEXT,                            -- { enabled, file_path, volume }
  image_config TEXT,                            -- { enabled, file_path, duration }
  video_config TEXT,                            -- { enabled, file_path, volume }
  
  -- Display behavior
  duration_ms INTEGER DEFAULT 5000,             -- How long to show alert
  priority INTEGER DEFAULT 0,                   -- Higher priority shows first
  
  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  UNIQUE(channel_id, event_type)                -- One config per event per channel
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_actions_channel_id ON event_actions(channel_id);
CREATE INDEX IF NOT EXISTS idx_event_actions_event_type ON event_actions(event_type);
CREATE INDEX IF NOT EXISTS idx_event_actions_enabled ON event_actions(enabled);
```

### TypeScript Interfaces

```typescript
interface TextConfig {
  enabled: boolean;
  template: string;                   // "{{username}} just followed!"
  font_size: number;                  // px
  font_family: string;                // 'Arial', 'Comic Sans MS', etc.
  color: string;                      // '#ffffff'
  background_color?: string;          // '#000000'
  position: 'top' | 'center' | 'bottom';
  animation?: 'slide' | 'fade' | 'bounce' | 'none';
  text_align?: 'left' | 'center' | 'right';
  padding?: number;                   // px
  border_radius?: number;             // px
  shadow?: boolean;
}

interface SoundConfig {
  enabled: boolean;
  file_path: string;                  // Absolute path to audio file
  volume: number;                     // 0.0 - 1.0
}

interface ImageConfig {
  enabled: boolean;
  file_path: string;                  // Absolute path to image
  duration_ms: number;                // How long to show
  width?: number;                     // px (auto if not set)
  height?: number;                    // px (auto if not set)
  position: 'top' | 'center' | 'bottom' | 'left' | 'right';
  fit?: 'contain' | 'cover' | 'fill';
}

interface VideoConfig {
  enabled: boolean;
  file_path: string;                  // Absolute path to video
  volume: number;                     // 0.0 - 1.0
  loop: boolean;                      // Always false initially
  width?: number;
  height?: number;
  position: 'top' | 'center' | 'bottom';
}

interface EventAction {
  id: string;
  channel_id: string;
  event_type: string;
  enabled: boolean;
  show_in_app: boolean;
  show_in_browser_source: boolean;
  text_config?: TextConfig;
  sound_config?: SoundConfig;
  image_config?: ImageConfig;
  video_config?: VideoConfig;
  duration_ms: number;
  priority: number;
  created_at: string;
  updated_at: string;
}
```

---

## Implementation Checklist

### ✅ Phase 1: Shared Event Formatter (CRITICAL PATH) - **COMPLETE**

**Status:** ✅ **COMPLETE** (November 1, 2025)  
**Time Spent:** ~6 hours  
**See:** `EVENT-ACTIONS-PHASE-1-COMPLETE.md` for details

**Files:**
- [x] `src/shared/utils/event-formatter.ts` (CREATED - 1000+ lines)
- [x] `src/frontend/screens/events/events.tsx` (MODIFIED - reduced 1034 → 505 lines)

**Tasks:**
1. ✅ Extract ALL event formatting logic from `events.tsx`
2. ✅ Create `formatEvent()` function returning `{ html, plainText, emoji, variables }`
3. ✅ Create `processTemplate()` for variable substitution
4. ✅ Create `getAvailableVariables()` for each event type
5. ✅ Update `events.tsx` to use shared formatter
6. ✅ Test all 41+ event types render correctly (build successful)

---

### ✅ Phase 2: Database Layer - **COMPLETE**

**Status:** ✅ **COMPLETE** (November 1, 2025)  
**Time Spent:** ~3 hours  
**See:** `EVENT-ACTIONS-PHASE-2-COMPLETE.md` for details

**Files:**
- [x] `src/backend/database/migrations.ts` (MODIFIED - added event_actions table)
- [x] `src/backend/database/repositories/event-actions.ts` (CREATED - 480+ lines)

**Tasks:**
1. ✅ Add migration (version 15) for `event_actions` table
2. ✅ Create `EventActionsRepository` extending `BaseRepository<EventAction>`
3. ✅ Implement methods:
   - ✅ `create()` - Create new action
   - ✅ `updateById()` - Update existing action
   - ✅ `getByChannelId()` - Get all actions for channel
   - ✅ `getByEventType()` - Get action for specific event type
   - ✅ `removeById()` - Remove action
4. ✅ Added 14 repository methods total
5. ✅ Build successful, no errors

---

### ✅ Phase 3: Event Action Processor Service - **COMPLETE**

**Status:** ✅ **COMPLETE** (November 1, 2025)  
**Time Spent:** ~5 hours  
**See:** `EVENT-ACTIONS-PHASE-3-COMPLETE.md` for details

**Files:**
- [x] `src/backend/services/event-action-processor.ts` (CREATED - 400+ lines)

**Tasks:**
1. ✅ Create `EventActionProcessor` class
2. ✅ Constructor accepts `mainWindow` (for in-app alerts)
3. ✅ Method `processEvent(eventData)`:
   - ✅ Query action config for event type
   - ✅ If disabled, return early
   - ✅ Format event using shared formatter
   - ✅ Process template variables
   - ✅ Validate media files exist
   - ✅ Emit in-app alert if enabled
   - ✅ Broadcast to browser source if enabled
4. ✅ Method `setBrowserSourceServer(server)` for Socket.IO integration
5. ✅ Queue system for sequential alert processing
6. ✅ Build successful, no errors

---

### ✅ Phase 4: Browser Source Server - **COMPLETE**

**Status:** ✅ **COMPLETE** (November 1, 2025)  
**Time Spent:** ~4 hours  
**See:** `EVENT-ACTIONS-PHASE-4-COMPLETE.md` for details

**Files:**
- [x] `src/backend/services/browser-source-server.ts` (CREATED - 346 lines)
- [x] `src/backend/public/browser-source.html` (CREATED - 31 lines)
- [x] `src/backend/public/browser-source.js` (CREATED - 445 lines)
- [x] `src/backend/public/browser-source.css` (CREATED)
- [x] `src/backend/main.ts` (MODIFIED - integrated server)

**Tasks:**
1. ✅ Create HTTP + Socket.IO server
2. ✅ HTTP endpoints:
   - ✅ `GET /browser-source` - Serve HTML page for OBS
   - ✅ `GET /health` - Health check
   - ✅ `GET /` - Info page
3. ✅ Socket.IO:
   - ✅ Emit `alert` event with full payload
   - ✅ Track connected clients
   - ✅ CORS enabled for OBS
4. ✅ HTML/JS/CSS for browser source:
   - ✅ Responsive layout (1920x1080)
   - ✅ Support all 4 media types
   - ✅ Queue system with animations
   - ✅ Debug mode support
5. ✅ Start server on port 3737
6. ✅ Initialize in `main.ts`
7. ✅ Connect to Event Action Processor
8. ✅ Build successful, server running!

**OBS URL:** `http://localhost:3737/browser-source`

---

### 🔴 Phase 5: IPC Handlers

**Files:**
- [ ] `src/backend/core/ipc-handlers/event-actions.ts`
- [ ] `src/backend/core/ipc-handlers/index.ts`

**Tasks:**
1. Create handlers:
   - `event-actions:create` - Create new action
   - `event-actions:update` - Update action
   - `event-actions:get-by-channel` - Get all actions for channel
   - `event-actions:get-by-event-type` - Get specific action
   - `event-actions:delete` - Delete action
   - `event-actions:test-alert` - Manually trigger alert for testing
   - `event-actions:validate-file` - Check if file exists
2. Register handlers in `index.ts`
3. Test via DevTools console

---

### ✅ Phase 6: Frontend Service Wrapper

**Files:**
- [ ] `src/frontend/services/event-actions.ts`

**Tasks:**
1. Wrap all IPC handlers
2. Methods:
   - `createAction(action)` - Create
   - `updateAction(id, updates)` - Update
   - `getActionsByChannel(channelId)` - Get all
   - `getActionByEventType(channelId, eventType)` - Get one
   - `deleteAction(id)` - Delete
   - `testAlert(action)` - Test
   - `validateFile(filePath)` - Validate
3. Return normalized `{ success, result?, error? }` format

---

### ✅ Phase 7: Frontend UI - Main Screen

**Files:**
- [ ] `src/frontend/screens/event-actions/event-actions.tsx`
- [ ] `src/frontend/components/Menu.tsx`
- [ ] `src/frontend/app.tsx`

**Tasks:**
1. Create `EventActionsScreen` component
2. List all event types with toggle switches
3. Show action status (configured/not configured, enabled/disabled)
4. "Edit" button opens action editor
5. "Test" button triggers test alert
6. Add navigation to menu
7. Add route to app

---

### ✅ Phase 8: Frontend UI - Action Editor

**Files:**
- [ ] `src/frontend/screens/event-actions/components/ActionEditor.tsx`
- [ ] `src/frontend/screens/event-actions/components/MediaPicker.tsx`

**Tasks:**
1. Modal/dialog for editing single action
2. Tabs for each media type:
   - **Text Tab**: Template, styling, position
   - **Sound Tab**: File picker, volume slider
   - **Image Tab**: File picker, duration, dimensions
   - **Video Tab**: File picker, volume, dimensions
3. Enable/disable toggle per media type
4. Save/Cancel buttons
5. Real-time validation

---

### ✅ Phase 9: Frontend UI - Template Builder

**Files:**
- [ ] `src/frontend/screens/event-actions/components/TemplateBuilder.tsx`
- [ ] `src/frontend/screens/event-actions/components/PresetTemplates.tsx`

**Tasks:**
1. Visual template editor:
   - Text input with variable insertion buttons
   - Preview with sample data
   - Variable list for current event type
2. Preset templates:
   - "Simple Text" - Just username + event
   - "Animated Banner" - Sliding text with emoji
   - "Twitch Chat Style" - Formatted like Twitch chat
   - "Follower Alert" - Large text with celebration
3. "Apply Preset" button
4. Custom template saving (future)

---

### ✅ Phase 10: Frontend UI - Alert Preview & In-App Display

**Files:**
- [ ] `src/frontend/screens/event-actions/components/AlertPreview.tsx`
- [ ] `src/frontend/components/AlertPopup.tsx`

**Tasks:**
1. `AlertPreview` - Shows how alert will look in real-time as user edits
2. `AlertPopup` - Actual in-app alert component:
   - Listen for `alert:show` IPC event
   - Render text/sound/image/video based on config
   - Queue system (show one at a time)
   - Auto-dismiss after duration
   - Close button for manual dismiss
3. Add `AlertPopup` to `app.tsx`
4. Style with CSS animations

---

### ✅ Phase 11: Integration with EventSub Router

**Files:**
- [ ] `src/backend/services/eventsub-event-router.ts`
- [ ] `src/backend/main.ts`

**Tasks:**
1. Initialize `EventActionProcessor` in `main.ts`
2. Pass to `EventSubEventRouter` constructor (similar to TTS)
3. In `storeAndEmitEvent()`, call `eventActionProcessor.processEvent()`
4. Start `BrowserSourceServer` in `main.ts`
5. Pass server reference to processor

---

### ✅ Phase 12: Testing & Refinement

**Tasks:**
1. Test all event types trigger correctly
2. Test all media types (text, sound, image, video)
3. Test in-app alerts display properly
4. Test browser source in OBS
5. Test queue system with rapid events
6. Test file validation
7. Test template variables
8. Performance testing with many actions

---

## Preset Templates (Initial Set)

### 1. Simple Text
```
{{username}} - {{event_type}}
```

### 2. Follower Alert
```
🎉 {{username}} just followed! Welcome to the community! 🎉
```

### 3. Subscriber Alert
```
⭐ {{username}} subscribed at {{tier}}! Thank you for your support! ⭐
```

### 4. Cheer Alert
```
💎 {{username}} cheered {{bits}} bits! "{{message}}" 💎
```

### 5. Raid Alert
```
🎯 {{username}} is raiding with {{viewers}} viewers! Welcome raiders! 🎯
```

### 6. Twitch Chat Style
```
<strong style="color: #9147ff">{{username}}</strong>: {{message}}
```

---

## Browser Source HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Stream Synth Alerts</title>
  <style>
    /* Responsive 1920x1080 layout */
    /* Queue system styles */
    /* Media display styles */
  </style>
</head>
<body>
  <div id="alert-queue"></div>
  <audio id="alert-audio"></audio>
  
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const queue = [];
    let currentAlert = null;
    
    socket.on('alert', (data) => {
      queue.push(data);
      if (!currentAlert) showNextAlert();
    });
    
    function showNextAlert() {
      if (queue.length === 0) return;
      currentAlert = queue.shift();
      
      // Render text, sound, image, video
      // Auto-dismiss after duration
      // Show next in queue
    }
  </script>
</body>
</html>
```

---

## Implementation Timeline

### Week 1 (20-25 hours)
- ✅ **Phase 1: Shared Event Formatter (6h)** - **COMPLETE** (Nov 1, 2025)
- ✅ **Phase 2: Database Layer (3h)** - **COMPLETE** (Nov 1, 2025)
- ✅ **Phase 3: Event Action Processor (5h)** - **COMPLETE** (Nov 1, 2025)
- ⏳ **Phase 4: Browser Source Server (6-7h)** - **NEXT**

### Week 2 (15-20 hours)
- 🔜 Phase 5: IPC Handlers (2-3h)
- 🔜 Phase 6: Frontend Service (2-3h)
- 🔜 Phase 7: Main Screen (4-5h)
- 🔜 Phase 8: Action Editor (5-6h)
- 🔜 Phase 9: Template Builder (4-5h)

### Week 3 (5-10 hours)
- 🔜 Phase 10: Alert Preview & Display (3-4h)
- 🔜 Phase 11: Integration (2-3h)
- 🔜 Phase 12: Testing & Refinement (4-6h)

**Total:** 40-55 hours  
**Completed:** 14 hours (Phases 1-3)  
**Remaining:** 26-41 hours

---

## Success Criteria

- [ ] All 41+ event types supported
- [ ] All 4 media types work (text, sound, image, video)
- [ ] In-app alerts display correctly
- [ ] Browser source receives alerts via Socket.IO
- [ ] OBS integration tested and working
- [ ] Template variables substitute correctly
- [ ] File validation prevents broken alerts
- [ ] Queue system handles rapid events
- [ ] Preset templates available
- [ ] Advanced text styling works
- [ ] No performance degradation

---

## Future Enhancements (Post-MVP)

- [ ] Action usage statistics (track triggers)
- [ ] Action conditions (if subscriber, if VIP, etc.)
- [ ] Custom template library
- [ ] Import/export action configs
- [ ] Fade animations for text
- [ ] Video looping option
- [ ] File size limits
- [ ] Multi-channel support
- [ ] Action categories/groups
- [ ] Advanced browser source layouts
- [ ] Webhook triggers for external events

---

## Notes

- Start with skeleton UI and iterate
- Reuse existing patterns (EventSub flow, IPC framework, Repository pattern)
- Test incrementally after each phase
- Document deviations from plan
- Keep performance in mind (don't block event processing)

---

**Status:** Ready to begin Phase 1 (Shared Event Formatter)
