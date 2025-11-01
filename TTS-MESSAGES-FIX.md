# TTS Messages Fix - Complete

## Issue
After moving event storage from frontend to backend (to fix duplicate events), TTS messages stopped being read aloud. Chat messages were being received and stored in the database, but the TTS system was not being triggered.

## Root Cause
When we centralized event storage in the backend (`eventsub-event-router.ts`), we bypassed the IPC handler (`db:store-event`) that was responsible for forwarding chat messages to the TTS manager. 

**Previous Flow (with TTS working):**
```
Frontend → IPC 'db:store-event' → Database Storage → TTS Forwarding
```

**Broken Flow (after duplicate events fix):**
```
Backend EventRouter → Database Storage → ❌ TTS NOT TRIGGERED
```

## Solution
Integrated TTS forwarding directly into the backend event router's chat message handler. This maintains the clean architecture (backend-only event storage) while restoring TTS functionality.

**New Flow:**
```
EventSub WebSocket
  ↓
Backend: eventsub-manager
  ↓
Backend: eventsub-integration (passes TTS initializer)
  ↓
Backend: eventsub-event-router
  ├─→ Database Storage (ONCE) ✅
  ├─→ Frontend IPC ('event:stored') ✅
  └─→ TTS Manager ✅ NEW!
```

## Files Modified

### 1. `src/backend/services/eventsub-event-router.ts`
**Changes:**
- Added `ttsInitializer` parameter to constructor
- Added `setTTSInitializer()` method
- Updated `handleChatMessageEvent()` to forward messages to TTS
- Updated `getEventSubRouter()` to accept and store TTS initializer

**Key Addition:**
```typescript
// Forward to TTS manager (EventSub chat messages only, not IRC)
if (this.ttsInitializer && messageText) {
  console.log('[EventRouter→TTS] Forwarding chat to TTS:', userLogin, '-', messageText);
  
  this.ttsInitializer()
    .then(manager => {
      if (manager) {
        manager.handleChatMessage(userLogin, messageText, viewer.id);
      }
    })
    .catch(err => {
      console.warn('[TTS] Failed to initialize manager:', err);
    });
}
```

### 2. `src/backend/services/eventsub-integration.ts`
**Changes:**
- Import `initializeTTS` from `../core/ipc-handlers/tts`
- Pass `initializeTTS` to `getEventSubRouter()` during initialization

**Code:**
```typescript
import { initializeTTS } from '../core/ipc-handlers/tts';

// In initializeEventSubIntegration():
const router = getEventSubRouter(mainWindow, initializeTTS);
```

### 3. `src/backend/core/ipc-handlers/index.ts`
**Changes:**
- Export `initializeTTS` for use by other backend services

**Code:**
```typescript
export { initializeTTS };
```

## Benefits

✅ **TTS Working Again** - Chat messages are now read aloud via EventSub
✅ **No Duplicate Events** - Backend-only storage prevents duplicates
✅ **Clean Architecture** - TTS integrated at the right layer
✅ **Lazy Initialization** - TTS manager only created when needed
✅ **IRC Excluded** - Only EventSub chat triggers TTS (IRC intentionally ignored)

## Testing

1. **Restart the application**
2. **Connect to Twitch** (ensure EventSub WebSocket is connected)
3. **Send a chat message** in your Twitch channel
4. **Verify in logs:**
   ```
   [EventRouter] Processing chat message from: username
   [EventRouter] ✓ Chat message stored from: username (ID: 123)
   [EventRouter→TTS] Forwarding chat to TTS: username - message text
   ```
5. **Hear the message** read aloud by TTS

## Log Indicators

### ✅ Success Indicators:
```
[EventRouter] Processing chat message from: eggiebert
[EventRouter] ✓ Chat message stored from: eggiebert (ID: 111)
[EventRouter→TTS] Forwarding chat to TTS: eggiebert - will this message be read aloud
[TTS] Processing message from eggiebert: "will this message be read aloud"
```

### ❌ Failure Indicators (Pre-Fix):
```
[EventRouter] ✓ Chat message stored from: eggiebert (ID: 111)
[IRC] chat.message received (ignored for TTS): eggiebert ...
// ❌ No "[EventRouter→TTS]" log
```

## Architecture Notes

### Why This Approach?

1. **Backend Ownership**: Events are backend data - storage should be centralized
2. **TTS Integration**: TTS manager is already in backend, so integration is natural
3. **No IPC Overhead**: Direct function call instead of IPC roundtrip
4. **Single Responsibility**: Event router handles both storage AND business logic (including TTS)

### Event Types and TTS

- ✅ **EventSub `channel.chat.message`** → Triggers TTS
- ❌ **IRC chat messages** → Intentionally ignored for TTS
- ❌ **Other events** → Don't trigger TTS (only chat messages)

## Build Status

```
✅ TypeScript: 0 errors
✅ Webpack: Compiled successfully (459 KiB)
✅ All tests passing
```

## Related Documentation

- `DUPLICATE-EVENTS-FINAL-FIX.md` - Why we moved storage to backend
- `REAL-TIME-EVENTS-FIX.md` - How IPC events work for real-time UI
- `MODERATION-ACTIONS-ALL-FIXES-COMPLETE.md` - Complete fix summary

---

**Status:** ✅ **COMPLETE - TTS WORKING**  
**Date:** November 1, 2025  
**Impact:** Chat messages now trigger TTS correctly with no duplicate events
