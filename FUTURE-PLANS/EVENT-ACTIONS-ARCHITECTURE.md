# Event Actions - Architecture & Data Flow

**Visual guide to Event Actions implementation**

---

## 🏗️ System Architecture

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
│  ┌────────────────────────────────────────────────────────┐    │
│  │  switch (eventType) {                                  │    │
│  │    case 'channel.follow': handleFollowEvent();         │    │
│  │    case 'channel.subscribe': handleSubscribeEvent();   │    │
│  │    case 'channel.chat.message': handleChatMessage();   │    │
│  │    // ... 41+ event types                              │    │
│  │  }                                                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Each handler calls:                                             │
│  storeAndEmitEvent(eventType, eventData, ...)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     storeAndEmitEvent()                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Store to database (EventsRepository)                  │  │
│  │ 2. Emit to frontend (webContents.send('event:stored'))   │  │
│  │ 3. 🆕 Process Event Actions ─────────────┐               │  │
│  └──────────────────────────────────────────┼───────────────┘  │
└─────────────────────────────────────────────┼──────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           🆕 EventActionProcessor.processEvent()                 │
│              (src/backend/services/event-action-processor.ts)    │
│                                                                  │
│  1. Query EventActionsRepository for action config              │
│  2. If disabled → return early                                  │
│  3. Format event using shared formatter                         │
│  4. Process template variables ({{username}}, etc.)             │
│  5. Validate media files exist                                  │
│  6. Build alert payload                                         │
│  7. Trigger destinations ↓                                      │
└───────────────────┬────────────────────────┬────────────────────┘
                    │                        │
          ┌─────────▼────────┐    ┌──────────▼────────┐
          │   In-App Alert   │    │  Browser Source   │
          │                  │    │                    │
          │ webContents.send │    │  Socket.IO emit   │
          │ ('alert:show')   │    │  ('alert', data)  │
          └─────────┬────────┘    └──────────┬────────┘
                    │                        │
                    ▼                        ▼
    ┌───────────────────────────┐  ┌────────────────────────────┐
    │   FRONTEND (React App)    │  │  BROWSER SOURCE (OBS)      │
    │                           │  │                            │
    │  ┌─────────────────────┐  │  │  ┌──────────────────────┐ │
    │  │   AlertPopup.tsx    │  │  │  │  /alert HTML page    │ │
    │  │                     │  │  │  │                      │ │
    │  │  • Queue alerts     │  │  │  │  • Socket.IO client  │ │
    │  │  • Show text/media  │  │  │  │  • Queue system      │ │
    │  │  • Auto-dismiss     │  │  │  │  • Render alerts     │ │
    │  └─────────────────────┘  │  │  └──────────────────────┘ │
    └───────────────────────────┘  └────────────────────────────┘
```

---

## 📊 Data Flow Example: New Follower

```
1. Twitch sends EventSub notification:
   {
     "subscription": { "type": "channel.follow" },
     "event": {
       "user_id": "12345",
       "user_login": "johndoe",
       "user_name": "JohnDoe",
       "followed_at": "2025-11-01T12:34:56Z"
     }
   }

2. EventSubManager receives and routes to EventSubEventRouter

3. EventSubEventRouter.handleFollowEvent():
   - Creates viewer record
   - Records to follower_history
   - Calls storeAndEmitEvent('channel.follow', ...)

4. storeAndEmitEvent():
   - Stores event to database (ID: 1001)
   - Emits to frontend: event:stored
   - 🆕 Calls eventActionProcessor.processEvent()

5. EventActionProcessor.processEvent():
   - Queries action config for 'channel.follow'
   - Config found: {
       enabled: true,
       show_in_app: true,
       show_in_browser_source: true,
       text_config: {
         enabled: true,
         template: "🎉 {{username}} just followed!",
         font_size: 48,
         color: "#ffffff"
       },
       sound_config: {
         enabled: true,
         file_path: "C:/alerts/sounds/cheer.mp3",
         volume: 0.8
       },
       video_config: {
         enabled: true,
         file_path: "C:/alerts/videos/confetti.mp4",
         volume: 0.5
       },
       duration_ms: 8000
     }
   
   - Formats event using shared formatter:
     {
       html: "<strong>JohnDoe</strong> just followed!",
       plainText: "JohnDoe just followed!",
       emoji: "👋",
       variables: { username: "JohnDoe", event_type: "channel.follow" }
     }
   
   - Processes template: "🎉 JohnDoe just followed!"
   
   - Validates files exist:
     ✅ C:/alerts/sounds/cheer.mp3
     ✅ C:/alerts/videos/confetti.mp4
   
   - Builds alert payload:
     {
       id: "alert-1730467896123",
       event_type: "channel.follow",
       formatted: { ... },
       text_config: {
         enabled: true,
         processed_text: "🎉 JohnDoe just followed!",
         font_size: 48,
         color: "#ffffff"
       },
       sound_config: { ... },
       video_config: { ... },
       duration_ms: 8000
     }
   
   - Emits in-app: mainWindow.webContents.send('alert:show', payload)
   - Emits browser source: io.emit('alert', payload)

6. In-App Alert (AlertPopup.tsx):
   - Receives IPC event 'alert:show'
   - Adds to queue
   - Renders:
     <div class="alert">
       <video src="C:/alerts/videos/confetti.mp4" autoplay />
       <p style="font-size: 48px; color: #ffffff">
         🎉 JohnDoe just followed!
       </p>
       <audio src="C:/alerts/sounds/cheer.mp3" autoplay />
     </div>
   - Auto-dismisses after 8 seconds

7. Browser Source (OBS):
   - Socket.IO receives 'alert' event
   - Adds to queue
   - Displays same content in overlay
   - Auto-dismisses after 8 seconds
```

---

## 🗂️ File Structure Breakdown

### Backend Files

```
src/backend/
├── database/
│   ├── migrations.ts                         # Add event_actions table (v15)
│   └── repositories/
│       └── event-actions.ts                  # 🆕 CRUD for action configs
│
├── services/
│   ├── event-action-processor.ts             # 🆕 Process events → alerts
│   ├── browser-source-server.ts              # 🆕 HTTP + Socket.IO server
│   └── eventsub-event-router.ts              # ✏️ Integrate processor
│
└── core/
    └── ipc-handlers/
        └── event-actions.ts                  # 🆕 Frontend ↔ Backend bridge
```

### Frontend Files

```
src/frontend/
├── screens/
│   └── event-actions/
│       ├── event-actions.tsx                 # 🆕 Main screen
│       └── components/
│           ├── ActionEditor.tsx              # 🆕 Edit single action
│           ├── TemplateBuilder.tsx           # 🆕 Visual template editor
│           ├── MediaPicker.tsx               # 🆕 File selection
│           ├── PresetTemplates.tsx           # 🆕 Built-in templates
│           └── AlertPreview.tsx              # 🆕 Live preview
│
├── components/
│   └── AlertPopup.tsx                        # 🆕 In-app alert display
│
└── services/
    └── event-actions.ts                      # 🆕 IPC wrapper
```

### Shared Files

```
src/shared/
└── utils/
    └── event-formatter.ts                    # 🆕 Shared formatting logic
```

---

## 🔄 Component Communication

### Backend → Frontend (In-App Alerts)

```typescript
// Backend
mainWindow.webContents.send('alert:show', alertPayload);

// Frontend (AlertPopup.tsx)
useEffect(() => {
  const handler = (event: any, data: any) => {
    setAlertQueue(prev => [...prev, data]);
  };
  
  ipcRenderer.on('alert:show', handler);
  return () => ipcRenderer.removeListener('alert:show', handler);
}, []);
```

### Backend → Browser Source (OBS Alerts)

```typescript
// Backend
io.emit('alert', alertPayload);

// Browser Source HTML
socket.on('alert', (data) => {
  queue.push(data);
  if (!currentAlert) showNextAlert();
});
```

### Frontend → Backend (Configuration)

```typescript
// Frontend
const result = await eventActionsService.createAction(actionConfig);

// Backend (IPC Handler)
ipcRegistry.register('event-actions:create', {
  execute: async (input) => {
    return await eventActionsRepo.create(input);
  }
});
```

---

## 🎨 UI Screen Layout (Skeleton)

```
┌─────────────────────────────────────────────────────────────┐
│  Event Actions                                     [ Help ] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Browser Source URL: http://localhost:7474/alert       │ │
│  │ [Copy URL]  [Test Connection]                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Event Type                | Configured | Actions       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ✅ channel.follow         │ ✓ Yes     │ [Edit] [Test] │ │
│  │ ❌ channel.subscribe      │ ✗ No      │ [Edit] [Test] │ │
│  │ ❌ channel.cheer          │ ✗ No      │ [Edit] [Test] │ │
│  │ ❌ channel.raid           │ ✗ No      │ [Edit] [Test] │ │
│  │ ❌ channel.chat.message   │ ✗ No      │ [Edit] [Test] │ │
│  │ ... (41+ event types)                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Create Default Actions for All Events ]                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

When [Edit] clicked → Opens ActionEditor modal:

┌─────────────────────────────────────────────────────────────┐
│  Edit Action: channel.follow                      [ X ]     │
├─────────────────────────────────────────────────────────────┤
│  [ Text ] [ Sound ] [ Image ] [ Video ] [ Settings ]        │
├─────────────────────────────────────────────────────────────┤
│  Text Tab:                                                   │
│                                                              │
│  ☑ Enable Text Alert                                        │
│                                                              │
│  Template:                                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎉 {{username}} just followed!                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  Available: {{username}} {{event_type}} {{timestamp}}       │
│                                                              │
│  [ Apply Preset ▼ ]  [ Preview ]                            │
│                                                              │
│  Styling:                                                    │
│  Font Size: [48px ▼]  Color: [#ffffff]  Font: [Arial ▼]   │
│  Position: ( ) Top  (●) Center  ( ) Bottom                  │
│  Animation: [Slide ▼]                                        │
│                                                              │
│  ┌─── Preview ───────────────────────────────────────────┐ │
│  │                                                        │ │
│  │         🎉 JohnDoe just followed!                     │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Cancel ]                                      [ Save ]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Key Integration Points

### 1. Shared Event Formatter Integration

```typescript
// Before (in events.tsx)
switch (event.event_type) {
  case 'channel.subscribe':
    return <span>🎉 {user} subscribed ({tier})</span>;
  // ... 40 more cases
}

// After (using shared formatter)
import { formatEvent } from '../../shared/utils/event-formatter';

const formatted = formatEvent(event);
return <span dangerouslySetInnerHTML={{ __html: formatted.html }} />;
```

### 2. EventSubEventRouter Integration

```typescript
// Add to constructor
constructor(
  mainWindow?: BrowserWindow | null,
  ttsInitializer?: () => Promise<any>,
  eventActionProcessor?: EventActionProcessor  // 🆕
) {
  // ...
  this.eventActionProcessor = eventActionProcessor || null;
}

// Update storeAndEmitEvent
private storeAndEmitEvent(...) {
  const eventId = this.eventsRepo.storeEvent(...);
  this.emitToFrontend('event:stored', {...});
  
  // 🆕 Process event actions
  if (this.eventActionProcessor) {
    this.eventActionProcessor.processEvent({...});
  }
  
  return eventId;
}
```

### 3. main.ts Initialization

```typescript
// Initialize browser source server
const browserSourceServer = new BrowserSourceServer(7474);
await browserSourceServer.start();

// Initialize event action processor
const eventActionProcessor = new EventActionProcessor(mainWindow);
eventActionProcessor.setBrowserSourceServer(browserSourceServer);

// Pass to EventSubEventRouter
const router = getEventSubRouter(mainWindow, ttsInitializer);
router.setEventActionProcessor(eventActionProcessor);
```

---

## ✅ Validation Points

At each phase, verify:

1. **Build succeeds**: `npm run build` → 0 errors
2. **Types correct**: No `any` types, proper interfaces
3. **IPC working**: Test in DevTools console
4. **UI renders**: No React errors
5. **Integration works**: End-to-end flow tested

---

## 📚 Reference Documentation

- **Architecture patterns**: `README.md` sections 🔧, 📝, 🎛️
- **IPC framework**: `src/backend/core/ipc/ipc-framework.ts`
- **Repository pattern**: `src/backend/database/base-repository.ts`
- **EventSub flow**: `src/backend/services/eventsub-event-router.ts`
- **Event types**: `src/frontend/config/event-types.ts`

---

**Next Step:** Begin Phase 1 - Shared Event Formatter

Read `src/frontend/screens/events/events.tsx` and extract the event formatting logic!
