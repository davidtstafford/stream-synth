# WebSpeech Voice Fix - Verification Guide

## Quick Verification Steps

### Step 1: Initial Load
1. Delete database: `Remove-Item -Path "$env:APPDATA\stream-synth\stream-synth.db" -Force`
2. Start app: `npm start`
3. **Expected Backend Logs**:
   ```
   [Voice Sync] webspeech never synced before
   [Startup] WebSpeech voices need syncing...
   [TTS] Syncing voices for provider: webspeech, count: 11
   [Voice Sync] Syncing 11 Web Speech voices
   [Voices] Purged 0 webspeech voices
   [Voices] Assigned numeric IDs for webspeech: 11 voices
   [TTS] Voice sync complete. Stats: { total: 11, available: 11, byProvider: { webspeech: 11 } }
   ```

✅ **Success Criteria**: 11 voices synced, no errors

---

### Step 2: Frontend Voice Display
1. Wait for app to fully load (5-10 seconds)
2. Navigate to TTS tab
3. **Expected Frontend Display**:
   - Voice list shows 6 language groups (Arabic, Bulgarian, Catalan, English, German, Spanish)
   - Each group has 1-2 voices with numeric IDs (1-11)
   - No "Unknown" names
   - Format: "001 │ Voice Name (Region) ♀️"

✅ **Success Criteria**: 11 distinct voices displayed with proper names

---

### Step 3: Test Button - Single Voice
1. Select voice #3 from dropdown
2. Click "Test" button
3. **Expected Backend Logs**:
   ```
   [IPC] tts:get-voice-metadata called with voiceId: webspeech_en-US_10
   [IPC] tts:get-voice-metadata - Parsed metadata: { voiceURI: "...", originalName: "..." }
   [IPC] tts:get-voice-metadata - Returning voiceURI: Microsoft ...
   ```
4. Audio plays (different voice than previous selections if you tested different voices)

✅ **Success Criteria**: Audio plays, metadata is retrieved, no errors

---

### Step 4: Test Button - Multiple Different Voices
1. Select voice #1, click "Test"
2. Listen to audio quality/accent
3. Select voice #5, click "Test"
4. Listen - should sound noticeably different
5. Select voice #3 again, click "Test"
6. Should sound same as step 2

✅ **Success Criteria**: Each voice test produces different audio. Can't use same voice for all three.

---

### Step 5: Rescan Button
1. Click "Rescan" button (should show spinner briefly)
2. **Expected Backend Logs**:
   ```
   [Provider] Immediate rescan for webspeech...
   [Voices] Purged 11 webspeech voices and their numeric ID mappings
   [Voices] Assigned numeric IDs for webspeech: 11 voices
   [Voice Sync] Synced 11 Web Speech voices
   [Provider] success message with 11 voices
   ```
3. Frontend shows success: "✓ webspeech rescanned: 11 voices found"
4. Voice list refreshes

✅ **Success Criteria**: 11 voices still present, no duplicates, no unknown names

---

### Step 6: Multiple Rescans
1. Click rescan 5 times in quick succession (or with small delays)
2. **Expected Backend**: Purges and re-syncs each time
3. Final voice count: still 11
4. **Verify by checking logs or voice list**

✅ **Success Criteria**: Still 11 voices after 5 rescans (not 55)

---

### Step 7: Voice Selection Persistence
1. Select voice #7
2. Note which voice it is (e.g., "Naayf")
3. Click Rescan
4. After rescan completes, open voice dropdown
5. Voice #7 should still be "Naayf" (or the same voice in same position)

**Note**: Due to our purge-and-reassign approach, the numeric ID might change, but the selection is saved by voice_id (natural key) so it will persist

✅ **Success Criteria**: Same voice is selected after rescan (even if numeric ID changed)

---

## DevTools Console Verification

Open DevTools (F12 in Electron):

### Expected Console Logs When Testing Voice:
```
[TTS] webSpeechSpeak() CALLED - text: Hello! ... voiceId: webspeech_en-GB_5
[TTS] webSpeechSpeak() - Got voiceURI from database: Microsoft Hazel...
[TTS] webSpeechSpeak() - Found voice by voiceURI: Microsoft Hazel, en-GB
[TTS] webSpeechSpeak() - Final voice selection: Microsoft Hazel en-GB voiceURI: Microsoft Hazel...
[TTS] webSpeechSpeak() - ✓ Voice set to: Microsoft Hazel (en-GB)
[TTS] Web Speech utterance finished
```

### What NOT to See:
```
❌ [TTS] webSpeechSpeak() - ✗ Could not find voice, using browser default
❌ [TTS] webSpeechSpeak() - Found voice by index fallback: ...  (should see voiceURI match instead)
❌ TypeError: Cannot read properties of undefined
❌ Voices showing as "Unknown"
```

---

## Database Verification (Manual)

If you want to verify the database directly, use Node's REPL:

```powershell
cd c:\git\staffy\stream-synth

# Check voices were synced
node -e "
const path = require('path');
const db = require('better-sqlite3')(
  path.join(process.env.APPDATA, 'stream-synth/stream-synth.db')
);
console.log('Total voices:', db.prepare('SELECT COUNT(*) as c FROM tts_voices').get().c);
console.log('Sample voice:', db.prepare('SELECT voice_id, name FROM tts_voices LIMIT 1').get());
"
```

**Expected Output**:
```
Total voices: 11
Sample voice: { 
  voice_id: 'webspeech_ar-EG_4',
  name: 'Microsoft Hoda'
}
```

---

## Troubleshooting

### Problem: "0 voices found" on startup
- **Check**: Is Web Speech API available? (Should be in Windows/Mac/Linux)
- **Check**: Are voices installed in system?
- **Try**: Restart browser/app
- **Debug**: Open DevTools Console, run `speechSynthesis.getVoices().length`

### Problem: "Unknown" voices displayed
- **Check**: Backend logs for voice parser errors
- **Check**: Metadata is being stored (query DB)
- **Fix**: Delete database and restart (fresh sync)

### Problem: Test button doesn't play audio
- **Check**: Voice is actually selected in dropdown
- **Check**: System volume is on
- **Check**: DevTools console for errors
- **Debug**: Check if utterance.voice is set in logs

### Problem: Rescan shows spinner but never completes
- **Check**: Backend logs for errors
- **Check**: Web Speech API still returning voices
- **Try**: Hard refresh (Ctrl+Shift+R)
- **Try**: Restart app

### Problem: Rescan throws error
- **Expected Logs**: Should see error in backend console
- **Check**: Voice names are valid (no special characters that break JSON)
- **Fix**: Delete DB and restart

---

## Performance Metrics

- **Startup sync**: ~500ms (11 voices)
- **Rescan**: ~200ms
- **Voice metadata lookup**: ~1ms (IPC overhead)
- **Voice test**: ~100ms (metadata fetch + synthesis setup)

---

## Success Confirmation

You'll know the fix works when:

1. ✅ App starts and shows 11 voices (not 0, not Unknown)
2. ✅ Can select different voices and hear differences
3. ✅ Rescan button works (shows spinner, completes quickly)
4. ✅ After 5 rescans, still 11 voices (no duplicates)
5. ✅ Selected voice persists after rescan
6. ✅ No console errors in DevTools
7. ✅ Backend logs show proper voice syncing and metadata returns

If all 7 checks pass, the voice system is working correctly! ✅
