# WebSpeech Voice System - Testing Guide

## Quick Start Testing

### Test 1: First App Launch (Voice Sync)
**Expected Behavior**: Voices sync once on startup

**Steps**:
1. Delete/move the app database to start fresh
2. Launch the app
3. Wait for initialization
4. Check backend console for:
   - `[Startup] Checking WebSpeech voice sync status...`
   - `[Voice Sync] First voice ID: webspeech_en-US_...`
   - `[Voices] Reassigned numeric IDs for webspeech: X voices`
5. Open TTS screen
6. Verify voices appear in dropdown

**Pass Criteria**:
- ✓ Voices synced exactly once
- ✓ Console shows sync completion
- ✓ Voices display correctly

---

### Test 2: Rescan Button
**Expected Behavior**: User can manually trigger rescan

**Steps**:
1. Open TTS screen
2. Look for "🔄 Rescan" button next to Web Speech checkbox
3. Click "Rescan" button
4. Check frontend console for: `[TTS] Rescanning webspeech voices...`
5. Check backend console for: `[Voices] Cleared sync status for webspeech`
6. Restart app
7. Verify voices re-sync on next startup

**Pass Criteria**:
- ✓ Rescan button is clickable
- ✓ Console shows action executed
- ✓ Next app startup triggers re-sync

---

### Test 3: Azure Checkbox Disabled
**Expected Behavior**: Azure checkbox is disabled and shows disabled message

**Steps**:
1. Open TTS screen
2. Look at Azure provider section
3. Check that:
   - Checkbox is grayed out/disabled
   - Section has reduced opacity
   - Label says "[DISABLED]"
   - Message says "Temporarily disabled for WebSpeech focus"

**Pass Criteria**:
- ✓ Azure checkbox is disabled
- ✓ Visual feedback is clear
- ✓ Cannot click checkbox

---

### Test 4: Voice Counts Display
**Expected Behavior**: Voice statistics show correct numbers

**Steps**:
1. Open TTS screen
2. Look at "Stats Bar" with:
   - Total Voices
   - Available
   - Showing
3. Verify numbers match actual voices in database

**Pass Criteria**:
- ✓ Numbers displayed correctly
- ✓ Web Speech shows actual system voice count
- ✓ Azure shows "0" (disabled)

---

### Test 5: Viewer Voice Selection (via Database)
**Expected Behavior**: Viewer voice choice is stored with natural key

**Database Check**:
1. Open app database with SQLite tool
2. Query: `SELECT username, tts_voice_id FROM viewers WHERE tts_voice_id IS NOT NULL LIMIT 5`
3. Verify `tts_voice_id` contains natural keys like:
   - `webspeech_en-US_0_David`
   - `webspeech_en-GB_2_George`

**Pass Criteria**:
- ✓ Voice IDs follow natural key format
- ✓ Contain language code and index
- ✓ Start with provider name

---

### Test 6: Voice Loading Performance
**Expected Behavior**: Voices load quickly without blocking UI

**Steps**:
1. Open TTS screen multiple times rapidly
2. Monitor frontend console for:
   - `[TTS Screen] Loading voices from database...`
   - `[TTS Screen] Got grouped voices`
3. Verify no auto-sync happens (no `autoSyncWebSpeechVoices` logs)

**Pass Criteria**:
- ✓ UI is responsive
- ✓ No redundant syncing
- ✓ Only database reads occur

---

### Test 7: Database Schema
**Expected Behavior**: New tables exist with correct structure

**Database Check**:
1. Check `tts_provider_status` table exists:
   ```sql
   SELECT * FROM tts_provider_status;
   ```
   - Should have columns: provider, is_enabled, last_synced_at, voice_count, created_at, updated_at

2. Check `tts_voice_ids` table:
   ```sql
   SELECT * FROM tts_voice_ids LIMIT 10;
   ```
   - Should have: numeric_id (1, 2, 3...), voice_id (natural keys)

3. Check `tts_voices` table:
   ```sql
   SELECT voice_id, provider, name FROM tts_voices LIMIT 5;
   ```
   - voice_id should be unique and be natural keys

**Pass Criteria**:
- ✓ All tables exist
- ✓ Columns are correct type
- ✓ Foreign keys work
- ✓ No errors querying

---

### Test 8: Natural Key Persistence Across Rescan
**Expected Behavior**: Voice choices remain after rescan despite numeric ID changes

**Database Setup**:
1. Manually insert a viewer with a voice:
   ```sql
   INSERT INTO viewers (id, username, tts_voice_id) 
   VALUES ('user123', 'testuser', 'webspeech_en-US_0_David');
   ```

2. Check numeric ID for that voice:
   ```sql
   SELECT numeric_id FROM tts_voice_ids 
   WHERE voice_id = 'webspeech_en-US_0_David';
   ```
   - Let's say it's 1

**Simulate Rescan**:
1. Click "Rescan" button in TTS screen
2. Restart app

**Verify Persistence**:
1. Check viewer still has same natural key:
   ```sql
   SELECT tts_voice_id FROM viewers WHERE username = 'testuser';
   ```
   - Should still be 'webspeech_en-US_0_David'

2. Check numeric ID might have changed:
   ```sql
   SELECT numeric_id FROM tts_voice_ids 
   WHERE voice_id = 'webspeech_en-US_0_David';
   ```
   - Might be 2 or 3 now, but voice is still available!

**Pass Criteria**:
- ✓ Natural key unchanged
- ✓ Voice is still accessible
- ✓ Numeric ID might change, but that's OK

---

## Console Log Reference

### Expected Backend Logs on Startup
```
[Startup] Running startup tasks...
[Startup] Checking WebSpeech voice sync status...
[Voice Sync] webspeech never synced before
[Voice Sync] webspeech sync pending
[Startup] Checking Azure voice sync status...
[Voice Sync] azure is disabled, skipping
```

### Expected Frontend Logs on Startup
```
[App] Initializing voice sync on startup...
[TTS] Checking if voice sync is needed...
[TTS] WebSpeech voices need syncing, performing sync...
[TTS] Syncing 7 Web Speech voices
[TTS] Synced 7 WebSpeech voices on startup
```

### Expected Logs on Rescan
```
[TTS] Rescanning webspeech voices...
[Voices] Cleared sync status for webspeech
```

---

## Common Issues & Troubleshooting

### Issue: Voices appear twice after rescan
**Solution**: Check that `deleteVoicesNotInList()` is being called

### Issue: Rescan button doesn't trigger re-sync
**Solution**: App must be restarted for sync to run again (check `last_synced_at` logic)

### Issue: Voice IDs don't follow natural key format
**Solution**: Check `VoiceParser.parseWebSpeechVoice()` is creating correct format

### Issue: Numeric IDs don't start at 1 after rescan
**Solution**: Check `reassignNumericIds()` is being called and resetting counter

### Issue: Azure checkbox is still enabled
**Solution**: Check `disabled={true}` in tts.tsx Azure section

---

## Success Criteria

All tests should pass:
- [x] Test 1: First App Launch (Voice Sync)
- [x] Test 2: Rescan Button
- [x] Test 3: Azure Checkbox Disabled
- [x] Test 4: Voice Counts Display
- [x] Test 5: Viewer Voice Selection
- [x] Test 6: Voice Loading Performance
- [x] Test 7: Database Schema
- [x] Test 8: Natural Key Persistence

If all pass → System is ready for production!
