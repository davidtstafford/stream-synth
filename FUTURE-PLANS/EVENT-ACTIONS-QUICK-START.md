# Event Actions - Quick Start Guide

**Ready to begin:** November 1, 2025

---

## 🎯 What We're Building

A comprehensive alert system that lets users create custom alerts (text, sound, image, video) for any Twitch event, displayed in-app or broadcast to OBS.

---

## 📋 Prerequisites Confirmed

✅ **Phase 1-3 complete** - Polling events working  
✅ **Architecture understood** - EventSub flow, IPC framework, Repository pattern  
✅ **User requirements gathered** - All questions answered  

---

## 🚀 Implementation Order

### **START HERE: Phase 1 - Shared Event Formatter**

**Why first?** This is the foundation. Everything else depends on it.

**File to create:** `src/shared/utils/event-formatter.ts`

**What to do:**
1. Read `src/frontend/screens/events/events.tsx` - lines ~200-600 (the `renderEventPreview()` switch statement)
2. Extract ALL that logic into standalone functions
3. Create the shared formatter module
4. Update `events.tsx` to use the new shared formatter
5. Test that Events screen still works

**Expected time:** 6-8 hours

**You'll know it's done when:**
- [ ] Events screen displays events identically to before
- [ ] Shared formatter returns `{ html, plainText, emoji, variables }`
- [ ] Template variable extraction works
- [ ] All 41+ event types formatted correctly

---

### **Phase 2 - Database Layer**

**Files:**
- `src/backend/database/migrations.ts` (add migration)
- `src/backend/database/repositories/event-actions.ts` (new)

**What to do:**
1. Add migration version 15 for `event_actions` table
2. Create `EventActionsRepository` extending `BaseRepository<EventAction>`
3. Implement CRUD methods
4. Test in Electron DevTools

**Expected time:** 3-4 hours

---

### **Phase 3 - Event Action Processor**

**File:** `src/backend/services/event-action-processor.ts`

**What to do:**
1. Create service that processes events and triggers alerts
2. Use shared formatter
3. Emit to frontend via `webContents.send()`
4. Integrate with browser source server

**Expected time:** 5-6 hours

---

### **Phase 4 - Browser Source Server**

**File:** `src/backend/services/browser-source-server.ts`

**What to do:**
1. Create Express + Socket.IO server
2. Serve HTML page for OBS
3. Broadcast alerts to connected clients
4. Start server in `main.ts`

**Expected time:** 6-7 hours

---

### **Continue through Phases 5-12...**

See `EVENT-ACTIONS-IMPLEMENTATION-PLAN.md` for full details.

---

## 🛠️ Architecture Patterns to Follow

### 1. IPC Framework
```typescript
// Register in src/backend/core/ipc-handlers/event-actions.ts
ipcRegistry.register<InputType, OutputType>(
  'event-actions:create',
  {
    execute: async (input) => {
      return await eventActionsRepo.create(input);
    }
  }
);
```

### 2. Repository Pattern
```typescript
// Extend BaseRepository
export class EventActionsRepository extends BaseRepository<EventAction> {
  constructor() {
    const db = getDatabase();
    super(db, 'event_actions', mapRow);
  }
}
```

### 3. Service Pattern
```typescript
// Business logic in services
export class EventActionProcessor {
  constructor(private repo: EventActionsRepository) {}
  
  async processEvent(eventData: any): Promise<void> {
    // Business logic here
  }
}
```

### 4. Frontend Service Wrapper
```typescript
// Wrap IPC calls
export async function createAction(action: any) {
  const response = await ipcRenderer.invoke('event-actions:create', action);
  return response.success ? 
    { success: true, result: response.data } : 
    { success: false, error: response.error };
}
```

---

## 📍 Integration Points

### EventSub Router Integration
```typescript
// In eventsub-event-router.ts → storeAndEmitEvent()

private storeAndEmitEvent(...): number {
  // Store event in database
  const eventId = this.eventsRepo.storeEvent(...);
  
  // Emit to frontend
  this.emitToFrontend('event:stored', {...});
  
  // 🆕 NEW: Process event actions
  if (this.eventActionProcessor) {
    this.eventActionProcessor.processEvent({
      event_type: eventType,
      event_data: eventData,
      channel_id: channelId,
      viewer_id: viewerId,
      viewer_username: viewerUsername,
      viewer_display_name: viewerDisplayName,
      created_at: new Date().toISOString()
    });
  }
  
  return eventId;
}
```

---

## 🧪 Testing Checklist

After each phase:

- [ ] Build succeeds (no TypeScript errors)
- [ ] No broken imports
- [ ] IPC handlers registered correctly
- [ ] Frontend service wrappers work
- [ ] UI renders without errors
- [ ] Manual testing passes

---

## 📝 Progress Tracking

Update this as you complete phases:

- [ ] **Phase 1:** Shared Event Formatter ✅
- [ ] **Phase 2:** Database Layer
- [ ] **Phase 3:** Event Action Processor
- [ ] **Phase 4:** Browser Source Server
- [ ] **Phase 5:** IPC Handlers
- [ ] **Phase 6:** Frontend Service
- [ ] **Phase 7:** Main Screen
- [ ] **Phase 8:** Action Editor
- [ ] **Phase 9:** Template Builder
- [ ] **Phase 10:** Alert Preview & Display
- [ ] **Phase 11:** Integration
- [ ] **Phase 12:** Testing

---

## ❓ Questions During Implementation?

Refer to:
- `EVENT-ACTIONS-IMPLEMENTATION-PLAN.md` - Full details
- `EVENT-ACTIONS-FEATURE.md` - Original spec
- `README.md` - Architecture patterns
- `MASTER-IMPLEMENTATION-ROADMAP.md` - Overall roadmap

---

## 🎉 Success Metrics

You'll know Event Actions is complete when:

✅ All 41+ event types trigger alerts  
✅ All 4 media types work (text, sound, image, video)  
✅ In-app alerts display  
✅ Browser source works in OBS  
✅ Template variables substitute  
✅ Queue system handles rapid events  
✅ File validation prevents errors  

---

**Ready to start? Begin with Phase 1: Shared Event Formatter!**

Ask me to implement Phase 1 when you're ready.
