# Phase 5: Testing Guide - Screen Split

**Date:** October 31, 2025  
**Status:** Ready for Testing ✅

---

## 🚀 Quick Start

### Build & Run
```bash
npm run build      # Should complete in ~7-8 seconds
npm start          # Start the Electron app
```

---

## 🧪 Testing Checklist

### Tab Navigation

- [ ] **Verify tabs exist:** Go to TTS → Verify you see 5 tabs:
  1. 🎙️ Voice Settings
  2. 📋 TTS Rules
  3. 🔐 TTS Access
  4. 👤 Viewer Voice Settings ← **Renamed**
  5. 🔇 Viewer TTS Restrictions ← **New**

- [ ] **Click between tabs:** Verify tabs switch smoothly with fade animation
- [ ] **No errors in console:** F12 → Console tab should be clean

---

## 👤 Test: Viewer Voice Settings Screen

### Create a Voice Setting
1. Click "👤 Viewer Voice Settings" tab
2. Type a viewer username in search box (e.g., "testuser")
3. Click the matching viewer in autocomplete
4. Click "Create Voice Setting" button
5. Select a voice from dropdown
6. Adjust Pitch slider (try 1.5)
7. Adjust Speed slider (try 1.2)
8. Click "Save Voice Setting" button
9. **Verify:** Success message appears, rule appears in table

### Verify Voice Settings Table
- [ ] Table shows: Viewer | Voice | Provider | Pitch | Speed | Actions
- [ ] Viewer name displays correctly
- [ ] Voice name or ID displays
- [ ] Provider shows (webspeech/azure/google)
- [ ] Pitch shows decimal (1.5)
- [ ] Speed shows decimal (1.2)

### Edit a Voice Setting
1. Click "Edit" button on a row in the table
2. Change the pitch to a different value
3. Click "Save Voice Setting"
4. **Verify:** Table updates with new value

### Delete a Voice Setting
1. Click "Delete" button on a row
2. Confirm the dialog
3. **Verify:** Row disappears from table, success message

### Verify No Restrictions UI
- [ ] No "TTS Restrictions" heading visible
- [ ] No mute/cooldown checkboxes
- [ ] No "Clear All TTS Rules" button
- [ ] No mute period slider
- [ ] No cooldown gap slider

---

## 🔇 Test: Viewer TTS Restrictions Screen

### View Current Restrictions
1. Click "🔇 Viewer TTS Restrictions" tab
2. **Verify:** Screen loads without errors
3. **Verify:** Two tables visible:
   - "🔇 Muted Users" table (initially empty or shows existing mutes)
   - "⏰ Users with Cooldowns" table (initially empty or shows existing cooldowns)

### Add a Mute
1. In search box, find a viewer (e.g., "testuser2")
2. Select the viewer
3. **Verify:** Selected viewer info shows
4. **Verify:** "🔇 Mute" button is active by default
5. Set "Mute Duration" slider to 30 minutes
6. Click "Add Restriction" button
7. **Verify:** Success message appears
8. **Verify:** Viewer appears in "🔇 Muted Users" table
9. **Verify:** Countdown shows (e.g., "29m" or "30m")

### Add a Cooldown
1. Find another viewer
2. Select them
3. Click "⏰ Cooldown" toggle button
4. **Verify:** Button turns blue
5. Set "Cooldown Gap" slider to 30 seconds
6. Set "Cooldown Duration" slider to 60 minutes
7. Click "Add Restriction" button
8. **Verify:** Success message
9. **Verify:** Viewer appears in "⏰ Users with Cooldowns" table
10. **Verify:** Gap shows "30s", countdown shows time

### Test Countdown Timer
1. Add a mute with 10-minute duration
2. Watch the "Expires In" column
3. Wait a few seconds
4. **Verify:** Timer updates (should tick down every 10 seconds)
5. Refresh the page
6. **Verify:** Timer still shows approximately same remaining time

### Remove a Mute
1. Find a muted user in the table
2. Click "Unmute" button
3. **Verify:** Success message
4. **Verify:** User disappears from muted users table
5. **Verify:** Can manually add them back to confirm it works

### Remove a Cooldown
1. Find a user with cooldown in the table
2. Click "Remove" button
3. **Verify:** Success message
4. **Verify:** User disappears from cooldown table

### Permanent Mute
1. Add mute with duration slider at 0 (Permanent)
2. **Verify:** Table shows "Permanent 🔒" in Duration column
3. **Verify:** Table shows "Never" in Expires In column

### Permanent Cooldown
1. Add cooldown with duration slider at 0 (Permanent)
2. **Verify:** Table shows "Permanent 🔒" in Duration column
3. **Verify:** Table shows "Never" in Expires In column

### Chat Commands Help
- [ ] Section visible titled "💬 Chat Commands"
- [ ] Shows command syntax for ~mutevoice
- [ ] Shows command syntax for ~unmutevoice
- [ ] Shows command syntax for ~cooldownvoice
- [ ] Note about auto-updates visible

### Test Auto-Update from Chat
1. In game chat (or test IRC), run: `~mutevoice @testuser`
2. Return to "Viewer TTS Restrictions" tab
3. **Verify:** Viewer appears in muted users table automatically
4. **Verify:** No manual refresh needed

---

## 🎨 UI/UX Verification

### Visual Design
- [ ] Dark theme applied consistently
- [ ] Purple (#9147ff) accents for Twitch branding
- [ ] Buttons have hover effects
- [ ] Sliders have gradient coloring
- [ ] Tables have alternating row backgrounds on hover

### Styling
- [ ] Form fields have proper padding
- [ ] Text is readable on dark background
- [ ] Icons display correctly (🔇 🔐 👤 ⏰ ℹ️)
- [ ] Countdown timer text is highlighted in yellow
- [ ] Permanent restriction text is highlighted in red

### Responsiveness
- [ ] Form fits on screen at 1024x768
- [ ] Tables don't horizontally scroll unnecessarily
- [ ] Buttons are clickable (not too small)
- [ ] Autocomplete dropdown displays properly

---

## 🔧 Developer Testing

### Console Output
1. Open F12 Developer Tools
2. Go to Console tab
3. **Verify:** No red error messages
4. **Verify:** Info logs show operations:
   - "[ViewerTTSRulesTab] Restrictions loaded"
   - "[ViewerTTSRestrictionsTab] TTS rules updated via chat"

### Network Tab
1. Open F12 Developer Tools
2. Go to Network tab
3. Click "Viewer TTS Restrictions" tab
4. **Verify:** IPC calls made:
   - `viewer-tts-rules:get-all-muted`
   - `viewer-tts-rules:get-all-cooldown`

### Database Consistency
1. Open database tool
2. Check `viewer_rules` table
3. Check `viewer_tts_rules` table
4. **Verify:** After creating voice setting and restriction for same viewer:
   - Voice setting exists in `viewer_rules`
   - Restriction exists in `viewer_tts_rules`
   - Both have same `viewer_id`
   - No duplication

---

## 🐛 Bug Report Template

If you find an issue, please provide:

```markdown
## Bug Report

**Component:** [Viewer Voice Settings / Viewer TTS Restrictions]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Console Error:** (if any)

**Screenshots:** (if helpful)
```

---

## ✅ Success Criteria

All of the following should be true:

- [ ] Both tabs visible and navigable
- [ ] Voice Settings screen has NO mute/cooldown UI
- [ ] Restrictions screen shows all muted/cooldown users
- [ ] Countdown timers update every 10 seconds
- [ ] Chat commands automatically update UI
- [ ] Can add/remove restrictions
- [ ] Database shows independent tables
- [ ] Build completes without errors
- [ ] No console errors when using features
- [ ] UI looks professional and consistent

---

## 🎯 Test Scenarios

### Scenario 1: Quick Mute During Stream
**Goal:** Moderator quickly mutes a spammer

1. Go to Restrictions tab
2. Type "@Spammer" in search
3. Select Spammer
4. Set mute to 10 minutes
5. Click "Add Restriction"
6. **Result:** ✅ Should take <5 seconds, appear in table immediately

### Scenario 2: Set Viewer Voice Preference
**Goal:** Make a viewer's voice sound funny

1. Go to Voice Settings tab
2. Search for viewer
3. Select funny voice (e.g., chipmunk if available)
4. Set pitch to 1.8
5. Set speed to 1.5
6. Click "Save"
7. **Result:** ✅ Setting saved independently from any restrictions

### Scenario 3: Monitor Active Restrictions
**Goal:** Moderator checks who is currently muted

1. Go to Restrictions tab
2. Look at "Muted Users" table
3. See all currently muted users with countdown
4. **Result:** ✅ Can see full picture at a glance without searching

### Scenario 4: Moderate via Chat Command
**Goal:** Chat command creates restriction visible in UI

1. In chat: type `~mutevoice @User 5`
2. Switch to Restrictions tab
3. **Result:** ✅ @User appears in muted table automatically

---

## 📝 Sign-Off

**Tested by:** [Your Name]  
**Date:** [Date]  
**Status:** ☐ PASS / ☐ FAIL  

**Notes:**

---

**Thank you for testing! 🎉**

