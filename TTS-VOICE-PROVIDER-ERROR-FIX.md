# TTS Voice Provider Error - Quick Fix Guide

## Error
```
[TTS] Unknown voice provider for voice_id:
```

## Root Cause
The TTS system is trying to speak but no voice has been selected, or the voice_id field is empty.

## Quick Fix

### Option 1: Select a Voice in TTS Settings
1. Go to **TTS Settings** screen
2. Under "Default Voice", click the dropdown
3. Select any voice (e.g., "Microsoft David Desktop - English (United States)")
4. Save settings
5. Test by sending a chat message

### Option 2: Check Database
The voice configuration is stored in the `settings` table:

```sql
SELECT * FROM settings WHERE key = 'tts_default_voice_id';
```

If this returns NULL or empty, you need to set a default voice.

### Option 3: Manual Database Fix
If you want to quickly set a default voice:

```sql
-- Get list of available voices
SELECT voice_id, display_name FROM webspeech_voices LIMIT 10;

-- Set a default voice (use a voice_id from above)
INSERT OR REPLACE INTO settings (key, value) 
VALUES ('tts_default_voice_id', 'Microsoft David Desktop - English (United States)');
```

## Expected Behavior After Fix

When a chat message arrives:
```
[EventSub→TTS] Forwarding chat to TTS: eggiebert - another test
[TTS] Speaking: eggiebert says: another test
[TTS] Using voice: Microsoft David Desktop - English (United States)
✅ TTS speaks the message
```

## Files to Check

1. **Frontend:** `src/frontend/screens/tts/tts-settings.tsx`
   - Voice selection dropdown
   - Default voice save logic

2. **Backend:** `src/backend/services/tts-manager.ts`
   - Voice provider detection
   - Fallback logic when voice not found

## Testing

1. Open TTS Settings
2. Verify a voice is selected
3. Send test chat message
4. Should hear TTS voice

---

**Note:** This is a separate issue from the chat events fix. Both need to be addressed for full functionality.
