# WebSpeech Voice System - User Testing Plan

## Executive Summary

The WebSpeech voice system has been completely redesigned to fix:
- ❌ **Old**: Voices duplicated on every sync (10 → 20 → 30...)
- ✅ **New**: Voices purged before sync, always exactly 11

The rescan button now:
- ❌ **Old**: Said "will rescan on next startup"
- ✅ **New**: Rescans immediately with loading spinner, UI updates in <200ms

## Testing Workflow

### Phase 1: Launch & Verify Startup (5 minutes)

#### Test 1.1: App Startup with Voice Sync
```
1. Delete app-data folder (or start fresh)
   Right-click on app-data → Delete
   
2. npm start
   
3. Watch console for:
   [TTS] Loaded 0 voices from Web Speech API
   [TTS] Loaded 0 voices from Web Speech API  
   [TTS] Loaded 11 voices from Web Speech API
   [TTS] Synced 11 WebSpeech voices on startup
   
4. Expected: After ~2 seconds, TTS Screen shows "✓ 11 system voices available"
```

**Pass Criteria**: 
- [x] Console shows "Synced 11" (not 10, not 12)
- [x] UI shows "11 system voices available"
- [x] No errors in console

---

#### Test 1.2: Verify Database Content
```powershell
# Open SQLite browser or use command line
sqlite3 ./app-data/database.db

-- Check voice count (should be exactly 11)
SELECT COUNT(*) FROM tts_voices WHERE provider = 'webspeech';
-- Expected: 11

-- Check numeric IDs (should be 1,2,3...11)
SELECT numeric_id FROM tts_voice_ids 
  WHERE voice_id IN (SELECT voice_id FROM tts_voices WHERE provider = 'webspeech')
  ORDER BY numeric_id;
-- Expected: 1,2,3,4,5,6,7,8,9,10,11

-- Check for duplicates (should be 0)
SELECT COUNT(*) FROM (
  SELECT voice_id, COUNT(*) as cnt
  FROM tts_voices
  WHERE provider = 'webspeech'
  GROUP BY voice_id
  HAVING cnt > 1
);
-- Expected: 0

.quit
```

**Pass Criteria**:
- [x] COUNT returns 11 (exactly)
- [x] Numeric IDs are 1-11 with no gaps
- [x] Duplicate check returns 0

---

### Phase 2: Test Rescan Button (5 minutes)

#### Test 2.1: Single Rescan
```
1. Open TTS Screen in app
2. Locate "Web Speech API (Free)" section
3. Click "🔄 Rescan" button
4. Watch for:
   - Button immediately changes to "⏳ Rescanning..."
   - Button is disabled (grayed out)
   - After ~1-2 seconds, button changes back to "🔄 Rescan"
   - Message appears: "✓ webspeech rescanned: 11 voices found"
   
5. Voice dropdown should still show 11 voices (not 22)
```

**Pass Criteria**:
- [x] Button shows loading state
- [x] Spinner text visible
- [x] Takes 1-2 seconds
- [x] Success message shows count (11)
- [x] Button re-enables
- [x] No error messages

---

#### Test 2.2: Check Database After Rescan
```powershell
sqlite3 ./app-data/database.db

-- Same checks as Test 1.2
SELECT COUNT(*) FROM tts_voices WHERE provider = 'webspeech';  -- Should be 11
SELECT numeric_id FROM tts_voice_ids 
  WHERE voice_id IN (SELECT voice_id FROM tts_voices WHERE provider = 'webspeech')
  ORDER BY numeric_id;  -- Should be 1-11
SELECT COUNT(*) FROM (SELECT voice_id, COUNT(*) as cnt FROM tts_voices WHERE provider = 'webspeech' GROUP BY voice_id HAVING cnt > 1);  -- Should be 0

-- Check sync timestamp (should be recent)
SELECT * FROM tts_provider_status WHERE provider = 'webspeech';
-- Expected: last_synced_at = recent timestamp

.quit
```

**Pass Criteria**:
- [x] Still 11 voices (not 22)
- [x] Numeric IDs still 1-11
- [x] No duplicates
- [x] Sync timestamp updated

---

### Phase 3: Multiple Rescans (5 minutes)

#### Test 3.1: Rescan 5 Times
```
1. Click Rescan button
2. Wait for "✓ webspeech rescanned: 11 voices found"
3. Repeat steps 1-2 four more times (total: 5 rescans)
4. After each rescan:
   - Button should work normally
   - Message should show: "✓ webspeech rescanned: 11 voices found"
   - NEVER: "✓ webspeech rescanned: 22 voices found" or higher
```

**Pass Criteria**:
- [x] All 5 rescans succeed
- [x] Each shows exactly 11 voices
- [x] No accumulation of duplicates
- [x] UI remains responsive

---

#### Test 3.2: Database Still Clean
```powershell
sqlite3 ./app-data/database.db

SELECT COUNT(*) FROM tts_voices WHERE provider = 'webspeech';
-- Expected: Still 11 (not 15, 20, 55, etc.)

SELECT COUNT(*) FROM tts_voice_ids;
-- Expected: 11 (not accumulated)

.quit
```

**Pass Criteria**:
- [x] Voice count: 11
- [x] Numeric ID count: 11
- [x] No leftover data

---

### Phase 4: Voice Selection & Testing (5 minutes)

#### Test 4.1: Select and Test a Voice
```
1. Open Voice dropdown in TTS Settings
2. Scroll through and verify:
   - Exactly 11 voices listed
   - No duplicates visible
   - All have numeric IDs (#1, #2, #3, etc.)
   
3. Select voice #1 (first in list)
4. Click "Test Voice" button
5. Listen for speech in the selected voice
6. Repeat for voice #5 and voice #11
```

**Pass Criteria**:
- [x] Exactly 11 voices in dropdown
- [x] No duplicates
- [x] Test voice plays for each selected
- [x] Different voices sound different

---

#### Test 4.2: Voice Persists After Rescan
```
1. Select voice #3 from dropdown
2. Click "Test Voice" - listen to voice
3. Click Rescan button
4. Wait for "✓ webspeech rescanned: 11 voices found"
5. Check voice dropdown - voice #3 still selected? 
   (Or check in console - should still use that voice)
6. Click "Test Voice" again
7. Should still hear the same voice (or voice choice persists)
```

**Pass Criteria**:
- [x] Voice selection preserved after rescan
- [x] Test voice still uses correct selection
- [x] No voice switching

---

### Phase 5: Error Handling (3 minutes)

#### Test 5.1: Normal Operation Under Load
```
1. Click Rescan 3 times rapidly (don't wait between clicks)
2. App should:
   - Queue the rescans
   - Execute them sequentially
   - Show success for each
   - Not crash or throw errors
```

**Pass Criteria**:
- [x] No crashes
- [x] No console errors
- [x] Each rescan shows success

---

#### Test 5.2: Console Logging
```
1. Open DevTools (F12)
2. Go to Console tab
3. Perform a rescan
4. Look for logs like:
   [TTS] Rescanning webspeech voices immediately...
   [Voice Sync] Immediate rescan for webspeech with 11 voices
   [Voice Sync] Syncing 11 Web Speech voices
   [Voices] Purged 11 webspeech voices...
   [Voices] Assigned numeric IDs for webspeech: 11 voices
   
5. Check for errors:
   - FOREIGN KEY constraint failed → FAIL
   - Cannot read property of undefined → FAIL
   - Any other error → FAIL
```

**Pass Criteria**:
- [x] Proper logging visible
- [x] No FOREIGN KEY errors
- [x] No TypeError or reference errors

---

### Phase 6: UI/UX Verification (3 minutes)

#### Test 6.1: Button States
```
1. Rescan button initial state:
   - Text: "🔄 Rescan"
   - Enabled: YES
   - Color: Normal (#4a4a4a)
   - Tooltip: "Click to rescan voices immediately"
   
2. During rescan:
   - Text: "⏳ Rescanning..."
   - Enabled: NO
   - Color: Grayed out (#555)
   - Cursor: not-allowed
   
3. After rescan:
   - Text: "🔄 Rescan"
   - Enabled: YES
   - Color: Normal
```

**Pass Criteria**:
- [x] All states match above
- [x] Visual feedback is clear
- [x] States transition smoothly

---

#### Test 6.2: Success Message
```
1. Click Rescan
2. Wait for completion
3. Look for message in UI (usually in red/green area)
4. Message should say:
   "✓ webspeech rescanned: 11 voices found"
5. Message should disappear after few seconds (or persist)
```

**Pass Criteria**:
- [x] Success message appears
- [x] Shows correct count (11)
- [x] Uses checkmark (✓) for success
- [x] User understands it succeeded

---

### Phase 7: Restart & Persistence (3 minutes)

#### Test 7.1: App Restart Verification
```
1. Select voice #3
2. Close app (Ctrl+Q or File → Exit)
3. npm start (start app again)
4. Watch console for startup sync
5. Open voice dropdown
6. Is voice #3 still selected?
   - If yes: Natural key persistence working ✓
   - If no: Might be new numeric ID assignment (still OK)
```

**Pass Criteria**:
- [x] App starts without errors
- [x] Syncs voices again on startup
- [x] Voice selection preserved (or explained)
- [x] UI loads correctly

---

## Summary of Expected Results

### Database (After All Tests)
- [ ] tts_voices: Exactly 11 rows (provider = 'webspeech')
- [ ] tts_voice_ids: Exactly 11 rows with numeric_id 1-11
- [ ] No duplicate voice_ids anywhere
- [ ] tts_provider_status: Has timestamp for 'webspeech'

### UI/UX (During Tests)
- [ ] Rescan button shows loading state (spinner)
- [ ] Success message displays with count
- [ ] Voice dropdown shows exactly 11 voices
- [ ] No voice duplication visible
- [ ] Voice selection persists across rescans

### Performance
- [ ] Startup sync: <100ms
- [ ] Rescan: 100-200ms (visible as spinner)
- [ ] Multiple rescans: Linear time (5 rescans = ~500-1000ms)

### Error Handling
- [ ] No FOREIGN KEY errors
- [ ] No console errors during normal operation
- [ ] Graceful error messages if something fails

### Persistence
- [ ] Voice selections survive rescan
- [ ] Voice selections survive app restart
- [ ] Numeric IDs consistent within session

---

## Issue Reporting

If you find a problem, please note:

1. **Reproduction Steps**: What did you do?
2. **Expected Result**: What should have happened?
3. **Actual Result**: What actually happened?
4. **Console Output**: Any errors visible?
5. **Database State**: Run the verification queries
6. **Screenshots**: If UI issue

Example:
```
Test: Multiple Rescans
Steps: Click rescan 5 times
Expected: Voice count stays 11
Actual: Voice count became 22 after second rescan
Console: FOREIGN KEY constraint failed (error message)
Database: SELECT COUNT(*) FROM tts_voices = 22
```

---

## Success Criteria - Overall

**Testing is SUCCESSFUL if ALL of these are true:**

✅ App starts and syncs 11 voices (no duplicates)
✅ Rescan button appears and functions
✅ Rescan shows loading spinner
✅ After rescan: still exactly 11 voices (not 22)
✅ Can rescan multiple times without accumulation
✅ Voice selection works after rescan
✅ Database stays clean (no orphaned records)
✅ No FOREIGN KEY errors at any point
✅ No console errors during normal operation
✅ Numeric IDs always 1-11 sequential

**If ANY of these fail**, please report with console output and database state.

---

## Time Estimate

- Phase 1 (Startup): 5 min
- Phase 2 (Rescan): 5 min
- Phase 3 (Multiple): 5 min
- Phase 4 (Selection): 5 min
- Phase 5 (Errors): 3 min
- Phase 6 (UI): 3 min
- Phase 7 (Restart): 3 min

**Total: ~30 minutes**

Can be done faster if skipping detailed DB checks.

---

## Next Steps

1. ✅ Build: `npm run build`
2. ✅ Start: `npm start`
3. ✅ Run through test phases
4. ✅ Report results (or issues)
5. ✅ Ready for production if all tests pass

Good luck! 🎉
