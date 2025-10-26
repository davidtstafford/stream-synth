# WebSpeech Voice Rescan - Testing Guide

## Quick Test Flow

### 1. Start App
```powershell
npm start
```

**Expected Logs**:
- `[TTS] Loaded 0 voices from Web Speech API` (initial, async)
- `[TTS] Loaded 0 voices from Web Speech API` (still loading)
- `[TTS] Loaded 11 voices from Web Speech API` (ready!)
- `[TTS] Synced 11 WebSpeech voices on startup`

**Expected UI**:
- TTS Settings tab shows "✓ 11 system voices available" under Web Speech

### 2. Check Database
```sql
-- SQLite
SELECT COUNT(*) FROM tts_voices WHERE provider = 'webspeech';
-- Expected: 11

SELECT numeric_id, name FROM tts_voice_ids 
  JOIN tts_voices ON tts_voice_ids.voice_id = tts_voices.voice_id 
  WHERE provider = 'webspeech' 
  ORDER BY numeric_id;
-- Expected: 1,2,3...11 with no gaps
```

### 3. Test Voice Selection
- Open TTS Screen → Voice dropdown
- Should show 11 voices grouped by language
- Select voice #1 (e.g., "Microsoft George - English (United Kingdom)")
- Click "Test Voice" button
- Should hear the test message in that voice
- **No duplicates** should be visible

### 4. Test Rescan Button

1. **Click "🔄 Rescan" button under Web Speech section**

**Expected**:
- Button immediately changes to "⏳ Rescanning..." (grayed out)
- Button is disabled (can't click again)
- Takes 1-2 seconds

2. **After rescan completes**:
- Button changes back to "🔄 Rescan" (enabled again)
- Shows message: "✓ webspeech rescanned: 11 voices found"
- Voice count unchanged: "✓ 11 system voices available"
- Dropdown still shows exactly 11 voices (no duplication)

### 5. Test Multiple Rescans

- Click rescan button 3 times in a row
- After each rescan:
  - Voice count should always be 11
  - No accumulation of duplicates
  - Numeric IDs always 1-11 (no gaps)

### 6. Test Voice Persistence

- Select voice #5 from dropdown
- Click "Test Voice" (should use voice #5)
- Click "Rescan" button
- Voice #5 should still be selected
- Click "Test Voice" again (should still use voice #5, not broken)

### 7. Check Logs During Rescan

Open DevTools (F12) and look for:
```
[TTS] Rescanning webspeech voices immediately...
[Voices] Purged 11 webspeech voices and their numeric ID mappings
[Voices] Assigned numeric IDs for webspeech: 11 voices
[TTS Screen] Loading voices from database...
[TTS Screen] Created 6 voice groups
```

**No FOREIGN KEY errors** should appear

## What NOT to Expect

❌ "next startup" message (rescan is immediate now)
❌ Need to restart app (rescan happens live)
❌ Duplicate voices in UI (purge prevents this)
❌ Numeric ID gaps (sequential assignment)
❌ "Rescan pending" state (it's instant)

## If Something Goes Wrong

### Symptom: Voices disappear after rescan
- Check browser console for errors
- Check main process console for FOREIGN KEY errors
- Verify `tts_voice_ids` table exists (see migration)
- Verify `tts_provider_status` table exists

### Symptom: Rescan button stays disabled
- Wait 5 seconds (sometimes takes longer)
- Refresh page (F5)
- Check console for errors during sync

### Symptom: Duplicate voices appear
- This should not happen with new purge logic
- If it does: Delete DB and restart app
- `rm -Force .\app-data\* ` (or use File Explorer)

### Symptom: Numeric IDs are wrong (1, 3, 5 instead of 1, 2, 3)
- This indicates purge didn't work
- Check for FOREIGN KEY constraint errors
- Verify `tts_voice_ids` was deleted completely
- May need manual DB cleanup:
  ```sql
  DELETE FROM tts_voice_ids WHERE provider = 'webspeech';
  -- Then rescan
  ```

## Debug Commands

**Check voice count**:
```sql
SELECT provider, COUNT(*) FROM tts_voices GROUP BY provider;
```

**Check numeric IDs**:
```sql
SELECT COUNT(*) FROM tts_voice_ids;
-- Should equal total voices in tts_voices
```

**Check sync status**:
```sql
SELECT * FROM tts_provider_status;
```

**Find duplicates**:
```sql
SELECT voice_id, COUNT(*) 
FROM tts_voices 
WHERE provider = 'webspeech' 
GROUP BY voice_id 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

**Check numeric ID sequence**:
```sql
SELECT numeric_id 
FROM tts_voice_ids 
WHERE voice_id IN (SELECT voice_id FROM tts_voices WHERE provider = 'webspeech')
ORDER BY numeric_id;
-- Should be: 1,2,3,4,5...11 (no gaps)
```

## Performance Expectations

- **Initial load**: 50-100ms (voices appear in dropdown)
- **Rescan**: 100-200ms (button shows spinner for this duration)
- **Multiple rescans**: Each takes ~150ms (no slowdown)

## Success Criteria ✓

All of these should be true:

- [ ] App starts, loads 11 voices
- [ ] DB shows exactly 11 voices (no duplication)
- [ ] Numeric IDs are 1-11 with no gaps
- [ ] Rescan button works and shows spinner
- [ ] After rescan: still 11 voices (no duplication)
- [ ] Can select any voice and test it
- [ ] Multiple rescans don't accumulate voices
- [ ] No FOREIGN KEY errors in console
- [ ] Voice selection persists after rescan

## Notes

- This implementation uses **purge + reload** instead of smart ID remapping
- Much simpler and eliminates ID collision issues
- Trade-off: Rescans are "destructive" (deletes old voices first)
  - But rebuilds immediately, so user doesn't notice
  - Better than silent duplication bugs

- Rescan is now **user-initiated** only (on button click)
  - App startup still uses provider sync (one-time per session)
  - Next release: could add auto-rescan on an interval

- **Future**: Azure/Google rescan would fetch from their APIs
  - Currently only Web Speech works (API always available in browser)
  - Azure would need credentials + API call
  - Google would need credentials + API call
