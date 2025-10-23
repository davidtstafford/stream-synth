# 🔧 TTS Fix - Web Speech API Process Issue

## Problem
The initial implementation tried to run Web Speech API in the **main process** (Node.js backend), but the `window` object and `speechSynthesis` API are only available in the **renderer process** (browser context).

**Error:**
```
ReferenceError: window is not defined
  at new WebSpeechProvider
```

## Solution
Moved Web Speech API implementation from backend to frontend:

### Changes Made:

1. **Backend: `tts/manager.ts`**
   - ✅ Removed Web Speech provider initialization from constructor
   - ✅ Web Speech now handled entirely in renderer

2. **Frontend: `services/tts.ts`**
   - ✅ Added Web Speech API implementation directly in renderer
   - ✅ `initWebSpeech()` - Initializes on module load
   - ✅ `mapWebSpeechVoices()` - Maps native voices to our format
   - ✅ `webSpeechSpeak()` - Speaks using SpeechSynthesis API
   - ✅ `webSpeechStop()` - Stops current speech
   - ✅ Routes Web Speech calls to renderer, Azure/Google to backend

3. **Backend: `ipc-handlers.ts`**
   - ✅ Added checks to skip backend for Web Speech provider
   - ✅ Returns empty arrays/success for Web Speech calls
   - ✅ Keeps IPC interface consistent

## Architecture

### Web Speech API (Renderer Process)
```
TTS Screen → tts.ts → window.speechSynthesis → Audio Output
```

### Azure/Google TTS (Main Process - Future)
```
TTS Screen → tts.ts → IPC → tts-handlers.ts → TTSManager → Provider → Audio Output
```

## Why This Design?

1. **Web Speech API** = Browser API, must run in renderer
2. **Azure/Google TTS** = REST APIs, can run in main process
3. **Settings** = Stored in database (main process), shared between both

## Testing

App should now:
- ✅ Launch without errors
- ✅ Load TTS screen successfully
- ✅ Show 40+ voices in dropdown
- ✅ Play audio when testing voices
- ✅ Settings persist correctly

## Next Steps

When adding Azure/Google providers:
- They will run in the **main process** (backend)
- Use HTTP requests to call their APIs
- IPC handlers will route to them correctly
- Frontend service already has the routing logic ready

---

**Status:** ✅ Fixed - Ready to test again!
