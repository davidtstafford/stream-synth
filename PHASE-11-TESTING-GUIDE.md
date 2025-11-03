# Quick Testing Guide - Phase 11

**Time Required:** 30-60 minutes  
**Goal:** Verify EventSub integration works end-to-end

---

## ✅ Pre-Test Checklist

Before testing, ensure:

- [ ] Stream Synth is running (`npm run dev`)
- [ ] Authenticated with Twitch (green checkmark in UI)
- [ ] EventSub connected (green indicator)
- [ ] Browser Source Server running (http://localhost:3737/browser-source)

---

## 🧪 Test 1: Create a Follow Alert (5 min)

**Steps:**

1. Open Stream Synth
2. Navigate to "Event Actions" screen
3. Click "➕ Create Action"
4. Configure:
   - **Event Type:** `channel.follow`
   - **Enable Text:** ✓
   - **Template:** `🎉 {{user_name}} just followed! Welcome!`
   - **Duration:** 5000 ms
   - **Position:** Top Center
5. Click "Save"

**Expected Result:** ✅ Action saved, shows in list

---

## 🧪 Test 2: Test Button (2 min)

**Steps:**

1. Find the follow action in list
2. Click "🧪 Test" button
3. Watch for alert

**Expected Result:**
- ✅ Alert appears in app (if in-app enabled)
- ✅ Console shows: `[EventActionProcessor] Processed channel.follow`

---

## 🧪 Test 3: OBS Browser Source (10 min)

**Steps:**

1. Open OBS Studio
2. Add new Browser Source
3. Configure:
   - **URL:** `http://localhost:3737/browser-source`
   - **Width:** 1920
   - **Height:** 1080
   - **FPS:** 30
4. Click OK
5. In Stream Synth, click "🧪 Test" again

**Expected Result:**
- ✅ Alert appears in OBS preview
- ✅ Text displays correctly
- ✅ Alert auto-dismisses after duration

**Troubleshooting:**
- Not appearing? Check browser source console (right-click → Interact → F12)
- Check URL is correct
- Verify port 3737 is accessible

---

## 🧪 Test 4: Real Twitch Event (5-15 min)

**Steps:**

1. Ask a friend to follow your channel
   - **OR** use a test account
   - **OR** trigger via Twitch CLI
2. Watch console logs
3. Check for alert

**Expected Console Output:**
```
[EventSubIntegration] ⚡ RECEIVED EVENT: channel.follow
[EventSubEventRouter] Event Action Processor connected
[EventActionProcessor] Processing channel.follow for channel 131323084
[EventActionProcessor] Action found: enabled=true
[EventActionProcessor] Building alert payload...
[EventActionProcessor] Processed channel.follow
```

**Expected Result:**
- ✅ Alert appears in app (if enabled)
- ✅ Alert appears in OBS browser source
- ✅ Template variables replaced correctly
- ✅ No errors in console

---

## 🧪 Test 5: Template Variables (5 min)

**Steps:**

1. Edit your follow action
2. Change template to:
   ```
   👋 {{user_name}} ({{user_login}}) followed at {{followed_at}}!
   ```
3. Save
4. Trigger test or wait for real follow

**Expected Result:**
- ✅ Variables are replaced with actual data
- ✅ Displays: "👋 JohnDoe (johndoe) followed at 2025-11-03T12:34:56Z!"

---

## 🧪 Test 6: Sound Alert (5 min)

**Prerequisites:** Have an MP3/WAV file ready

**Steps:**

1. Edit follow action
2. Enable Sound
3. Browse to sound file
4. Set volume: 0.8
5. Save
6. Trigger test

**Expected Result:**
- ✅ Sound plays when alert appears
- ✅ Volume is correct
- ✅ No audio errors

**Troubleshooting:**
- No sound? Check file path is correct
- Check file format (MP3, WAV, OGG supported)
- Verify volume slider not at 0

---

## 🧪 Test 7: Multiple Event Types (10 min)

**Steps:**

1. Create actions for:
   - `channel.subscribe` - "⭐ {{user_name}} subscribed at Tier {{tier}}!"
   - `channel.cheer` - "💎 {{user_name}} cheered {{bits}} bits!"
   - `channel.raid` - "🚀 {{from_broadcaster_user_name}} raided with {{viewers}} viewers!"
2. Test each with test button
3. Verify templates work

**Expected Result:**
- ✅ Each event type processes correctly
- ✅ Different variables work
- ✅ No conflicts between actions

---

## 🧪 Test 8: Channel Filtering (5 min)

**Steps:**

1. Create follow action with `browser_source_channel: 'default'`
2. Open browser source: `http://localhost:3737/browser-source?channel=default`
3. Trigger test
4. Change URL to: `http://localhost:3737/browser-source?channel=tts`
5. Trigger test again

**Expected Result:**
- ✅ Shows on channel=default
- ❌ Doesn't show on channel=tts
- ✅ Console shows filtering: "Ignoring alert - wrong channel"

---

## 🧪 Test 9: Queue Management (5 min)

**Steps:**

1. Create 3 different actions (follow, sub, raid)
2. Quickly trigger all 3 tests (click test buttons fast)
3. Watch alerts display

**Expected Result:**
- ✅ Alerts queue properly
- ✅ Display one at a time
- ✅ No overlapping
- ✅ All complete successfully

---

## 🧪 Test 10: Error Handling (5 min)

**Steps:**

1. Create action with invalid sound file path
2. Trigger test
3. Check console

**Expected Result:**
- ✅ Alert still appears (text/image/video)
- ⚠️ Warning in console: "Sound file not found"
- ✅ No crash or blocking error

---

## 📊 Test Results Summary

After completing tests, fill out:

| Test | Status | Notes |
|------|--------|-------|
| 1. Create Action | ⬜ | |
| 2. Test Button | ⬜ | |
| 3. OBS Browser Source | ⬜ | |
| 4. Real Event | ⬜ | |
| 5. Template Variables | ⬜ | |
| 6. Sound Alert | ⬜ | |
| 7. Multiple Event Types | ⬜ | |
| 8. Channel Filtering | ⬜ | |
| 9. Queue Management | ⬜ | |
| 10. Error Handling | ⬜ | |

**Legend:**
- ✅ = Pass
- ⚠️ = Warning (works but has issues)
- ❌ = Fail (doesn't work)

---

## 🐛 Common Issues & Fixes

### Alert doesn't appear in OBS

**Possible Causes:**
- Browser source URL wrong
- Port 3737 blocked
- Channel filtering issue

**Fixes:**
1. Verify URL: `http://localhost:3737/browser-source`
2. Check console for errors (right-click source → Interact → F12)
3. Verify action has correct channel (default)

### Template variables not replaced

**Possible Causes:**
- Variable name misspelled
- Event data doesn't have that field

**Fixes:**
1. Check variable spelling: `{{user_name}}` not `{{username}}`
2. Use Template Builder for valid variables
3. Check console for event data structure

### Sound doesn't play

**Possible Causes:**
- File path incorrect
- File format unsupported
- Volume at 0

**Fixes:**
1. Use absolute path: `C:/alerts/sounds/file.mp3`
2. Use MP3, WAV, or OGG format
3. Check volume slider (0.0 - 1.0)

### Real events not triggering

**Possible Causes:**
- EventSub not connected
- Action disabled
- Event type subscription missing

**Fixes:**
1. Check EventSub status indicator (should be green)
2. Verify action is enabled (toggle switch on)
3. Check console for EventSub connection logs

---

## ✅ Test Completion

**If all tests pass:**
- ✅ Phase 11 verified working
- ✅ Ready for Phase 12 (polish)
- ✅ Can use in production

**If some tests fail:**
- Document failures
- Check console logs
- Review documentation
- Create bug report

---

## 🚀 Next Steps After Testing

### Option A: Everything Works! 🎉
→ **Proceed to Phase 12: Testing & Refinement**
- Comprehensive testing
- Performance optimization
- Bug fixes
- Final polish

### Option B: Found Issues 🐛
→ **Fix before continuing**
- Document bugs
- Prioritize critical issues
- Fix one at a time
- Re-test

### Option C: Want More Features 🎨
→ **Optional: Phase 11.5 - Channel UI**
- Channel manager screen
- Visual channel assignment
- URL generator
- Channel editor

---

**Happy Testing!** 🧪
