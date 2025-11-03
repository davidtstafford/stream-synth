# 🚀 What's Next: Event Actions Development Roadmap

**Current Status:** Phase 12 Complete ✅  
**Date:** November 3, 2025

---

## 📊 Current State

### ✅ What's Working Now

**Backend (100% Complete)**
- Event Actions database schema (v15)
- EventActionProcessor service
- BrowserSourceServer (HTTP + Socket.IO on port 7474)
- Template variable system with aliases
- Channel filtering infrastructure
- Real-time EventSub integration
- Debug mode toggle

**Frontend (Not Started)**
- No configuration UI yet
- Event actions must be manually created in database

**Workaround Available:**
```sql
-- Manually create event action
INSERT INTO event_actions (
  channel_id, event_type, is_enabled,
  browser_source_channel,
  text_enabled, text_template, text_duration, text_position,
  created_at, updated_at
) VALUES (
  'your_channel_id',
  'channel.follow',
  1,
  'default',
  1,
  '{{username}} just followed! ❤️',
  5000,
  'center',
  datetime('now'),
  datetime('now')
);
```

---

## 🎯 Phase 13: Frontend UI (Next Priority)

**Estimated Time:** 4-6 hours  
**Complexity:** Medium  
**Prerequisites:** None (all backend ready)

### What to Build

1. **Event Actions Screen** (`src/frontend/screens/event-actions/`)
   - Menu item in App.tsx
   - Event list with enable/disable toggles
   - "Edit" button per event
   - Event action editor modal/panel

2. **Action Editor Component**
   - Tabs: Text, Sound, Image, Video
   - Template input with variable picker
   - Duration slider
   - Position selector
   - File picker dialogs
   - Live preview

3. **Template Builder**
   - Available variables list (from `getAvailableVariables()`)
   - Click to insert variable
   - Preview with sample data
   - Common templates library

4. **IPC Handlers**
   - `event-actions:get-all` - Get all event actions
   - `event-actions:get` - Get single action
   - `event-actions:save` - Save action configuration
   - `event-actions:delete` - Delete action
   - `event-actions:toggle` - Enable/disable action

### File Structure

```
src/frontend/screens/event-actions/
├── event-actions.tsx                 # Main screen
└── components/
    ├── ActionList.tsx                # List of all event types
    ├── ActionEditor.tsx              # Edit single action
    ├── TextAlertTab.tsx              # Text configuration
    ├── SoundAlertTab.tsx             # Sound configuration
    ├── ImageAlertTab.tsx             # Image configuration
    ├── VideoAlertTab.tsx             # Video configuration
    ├── TemplateBuilder.tsx           # Variable picker
    ├── MediaPicker.tsx               # File selection
    └── AlertPreview.tsx              # Live preview

src/frontend/services/
└── event-actions.ts                  # IPC wrapper

src/backend/core/ipc-handlers/
└── event-actions.ts                  # IPC handlers
```

### Key Features

- ✅ List all Twitch event types (from `event-types.ts`)
- ✅ Show current configuration per event
- ✅ Enable/disable toggle per event
- ✅ Edit button opens action editor
- ✅ Tabbed interface for media types
- ✅ Template builder with variable picker
- ✅ File picker for sound/image/video
- ✅ Live preview of alerts
- ✅ Save/cancel buttons
- ✅ Validation (required fields, file existence)

---

## 🎬 Phase 14: In-App Alerts (Optional)

**Estimated Time:** 2-3 hours  
**Complexity:** Low  
**Prerequisites:** Phase 13 (for configuration)

### What to Build

1. **AlertPopup Component** (`src/frontend/components/AlertPopup.tsx`)
   - Positioned overlay (top-right corner)
   - Fade in/out animations
   - Queue management
   - Auto-dismiss timers
   - Click to dismiss

2. **Integration**
   - Listen for `alert:show` IPC event
   - Display alerts outside OBS
   - Use same payload format as browser source
   - Render text/image/video

3. **Configuration**
   - Toggle in settings: "Show alerts in app"
   - Position selector
   - Duration override

### Benefits

- Desktop notifications without OBS
- Test alerts without opening browser
- Monitor alerts while not streaming
- Redundant alert display

---

## 🔊 TTS Browser Source (Parallel Feature)

**Estimated Time:** 1-2 hours  
**Complexity:** Low  
**Prerequisites:** None (independent feature)

### What to Build

**See:** `FUTURE-PLANS/TTS-BROWSER-SOURCE-FEATURE.md` for complete spec

**Quick Summary:**
- Add TTS audio output to browser source
- Separate from Event Actions (parallel feature)
- Simple toggle in Voice Settings tab
- No virtual audio cables needed
- Web Speech API in browser
- Reuses existing browser source server

**Why Separate?**
- TTS has complex filtering logic
- TTS has viewer-specific rules
- TTS is triggered by chat, not EventSub
- TTS is real-time audio stream, not discrete alerts

**Implementation:**
1. Add Socket.IO event: `tts-speak`
2. Add route: `http://localhost:7474/tts`
3. Browser uses Web Speech API
4. Toggle in Voice Settings: "Output TTS to browser source"
5. Emit TTS to browser when enabled

---

## 📋 Recommended Development Order

### 🥇 Priority 1: Event Actions UI (Phase 13)
**Why First:**
- Unblocks user configuration
- Most requested feature
- Backend already complete
- High user value

**Start With:**
1. Create basic Event Actions screen
2. List all event types
3. Add enable/disable toggles
4. Simple text alert editor
5. Expand to full editor with all tabs

### 🥈 Priority 2: TTS Browser Source
**Why Second:**
- Quick win (1-2 hours)
- High streamer value
- Independent of Event Actions
- No virtual audio cables

**Start With:**
1. Add Socket.IO event
2. Create `/tts` route
3. Add toggle in Voice Settings
4. Emit TTS when enabled
5. Test with real TTS

### 🥉 Priority 3: In-App Alerts (Phase 14)
**Why Third:**
- Nice to have, not critical
- Requires Event Actions UI first
- Lower user priority
- Can be deferred

---

## 🔧 Development Tips

### Before You Start Phase 13

1. **Read Documentation**
   - EVENT-ACTIONS-README.md (complete technical guide)
   - README.md Event Actions section (user guide)
   - Database schema in both docs

2. **Understand Data Flow**
   - EventSub → Router → Processor → Browser Source
   - Frontend → IPC → Repository → Database

3. **Check Existing Patterns**
   - See TTS Access tab for configuration UI patterns
   - See Event Subscriptions for event list patterns
   - See Voice Settings for tabbed interface

4. **Use Existing Services**
   - `formatEvent()` for event formatting
   - `processTemplate()` for template processing
   - `getAvailableVariables()` for variable lists

### During Development

1. **Start Small**
   - Basic screen first
   - Add features incrementally
   - Test each component

2. **Reuse Components**
   - Button styles from existing screens
   - Input patterns from TTS settings
   - Toggle switches from everywhere

3. **Follow Patterns**
   - IPC handlers in `src/backend/core/ipc-handlers/`
   - Frontend services in `src/frontend/services/`
   - Repository in `src/backend/database/repositories/`

4. **Test Frequently**
   - Build after each change
   - Check console for errors
   - Use browser source to verify

---

## 📚 Quick Reference Links

### Documentation
- **EVENT-ACTIONS-README.md** - Complete technical guide
- **README.md** (lines 680-817) - User guide
- **PHASE-12-COMPLETE.md** - What was completed

### Code Files
- **EventActionProcessor** - `src/backend/services/event-action-processor.ts`
- **BrowserSourceServer** - `src/backend/services/browser-source-server.ts`
- **Event Formatter** - `src/shared/utils/event-formatter.ts`
- **Repository** - `src/backend/database/repositories/event-actions.ts`

### Testing
- **Browser Source** - `http://localhost:7474/alert`
- **Test Endpoint** - `http://localhost:7474/test`
- **Debug Mode** - `http://localhost:7474/alert?debug=true`

---

## 🎯 Success Metrics

### Phase 13 Complete When:
- [x] User can create event actions via UI
- [x] User can edit existing actions
- [x] User can enable/disable actions
- [x] Template builder works with variables
- [x] File picker works for media
- [x] Live preview shows alerts
- [x] Changes save to database
- [x] Browser source reflects changes

### TTS Browser Source Complete When:
- [x] Toggle exists in Voice Settings
- [x] Browser source route `/tts` exists
- [x] TTS emits to Socket.IO when enabled
- [x] Browser receives and speaks TTS
- [x] No audio feedback loops
- [x] Works in OBS

### Phase 14 Complete When:
- [x] In-app alerts display
- [x] Queue management works
- [x] Auto-dismiss works
- [x] User can configure position
- [x] Works alongside browser source

---

## 🚀 Ready to Start?

**Phase 13 is next!** 

When you're ready:
1. Read EVENT-ACTIONS-README.md
2. Study existing UI patterns (TTS Access, Voice Settings)
3. Create event-actions screen skeleton
4. Add basic event list
5. Build from there!

**Good luck!** 🎉

---

**Last Updated:** November 3, 2025  
**Current Phase:** 12 ✅ Complete  
**Next Phase:** 13 (Event Actions UI)
