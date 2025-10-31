# Phase 5: Screen Split - Quick Reference Checklist

**Date:** October 30, 2025  
**Time Estimate:** 4-6 hours  
**Status:** 📋 Ready to implement

---

## 🎯 Quick Overview

**Goal:** Split "Viewer Rules" into two separate screens:
1. **Viewer Voice Settings** - Optional voice customization (rename existing)
2. **Viewer TTS Restrictions** - Moderation mutes/cooldowns (new screen)

**Why:** Current design mixes optional customization with moderation tools, causing confusion

---

## ✅ Step-by-Step Checklist

### Step 1: Rename Existing Screen (30 min)

- [ ] **1.1** Rename file:
  - From: `src/frontend/screens/tts/tabs/ViewerRulesTab.tsx`
  - To: `src/frontend/screens/tts/tabs/ViewerVoiceSettingsTab.tsx`

- [ ] **1.2** Update component name:
  ```typescript
  // Change all instances of:
  ViewerRulesTab → ViewerVoiceSettingsTab
  ```

- [ ] **1.3** Update imports in `TTSScreen.tsx`:
  ```typescript
  import { ViewerVoiceSettingsTab } from './tabs/ViewerVoiceSettingsTab';
  ```

- [ ] **1.4** Update tab registration in `TTSScreen.tsx`:
  ```typescript
  {
    id: 'viewer-voice-settings',
    label: 'Viewer Voice Settings',
    component: <ViewerVoiceSettingsTab voiceGroups={voiceGroups} accessMode={accessMode} />
  }
  ```

- [ ] **1.5** Update UI labels in component:
  - Tab title: "Viewer Voice Settings"
  - Description: "Customize TTS voices for individual viewers"
  - Table header: "Custom Voice Settings"

- [ ] **1.6** Test: Voice preferences still work after rename

---

### Step 2: Remove Restrictions Logic (1 hour)

- [ ] **2.1** Remove state variables:
  ```typescript
  // DELETE these lines:
  const [ttsRules, setTtsRules] = useState<ViewerTTSRules | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [mutePeriodMins, setMutePeriodMins] = useState(0);
  const [hasCooldown, setHasCooldown] = useState(false);
  const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
  const [cooldownPeriodMins, setCooldownPeriodMins] = useState(0);
  ```

- [ ] **2.2** Remove functions:
  ```typescript
  // DELETE these functions:
  const loadTTSRules = async (viewerId: string) => { ... }
  const handleToggleMute = (enabled: boolean) => { ... }
  const handleToggleCooldown = (enabled: boolean) => { ... }
  const handleClearAllRules = async () => { ... }
  ```

- [ ] **2.3** Clean up `handleSaveRule`:
  - Remove TTS rules save logic
  - Keep only voice preference save logic

- [ ] **2.4** Remove event listener:
  ```typescript
  // DELETE this useEffect:
  useEffect(() => {
    const handleTTSRulesUpdated = ...
    ipcRenderer.on('viewer-tts-rules-updated', handleTTSRulesUpdated);
    ...
  }, [selectedViewer]);
  ```

- [ ] **2.5** Remove JSX sections:
  - TTS rules status display box
  - "TTS Restrictions" section
  - Mute control
  - Cooldown control
  - "Clear All TTS Rules" button
  - "Refresh Rules" button

- [ ] **2.6** Test: Voice preferences still save/load correctly

---

### Step 3: Create Restrictions Screen (2-3 hours)

- [ ] **3.1** Create new file:
  - `src/frontend/screens/tts/tabs/ViewerTTSRestrictionsTab.tsx`

- [ ] **3.2** Copy template from implementation plan:
  - Component structure
  - State variables
  - useEffect hooks
  - Functions (load, add, remove)
  - JSX layout

- [ ] **3.3** Implement state management:
  - `mutedUsers` array state
  - `cooldownUsers` array state
  - `selectedViewer` state
  - Restriction form states

- [ ] **3.4** Implement data loading:
  - `loadAllRestrictions()` function
  - Call `viewer-tts-rules:get-all-muted`
  - Call `viewer-tts-rules:get-all-cooldown`
  - Auto-refresh every 10 seconds

- [ ] **3.5** Implement event listener:
  - Listen for `viewer-tts-rules-updated`
  - Reload data when event fires
  - Show notification message

- [ ] **3.6** Implement add restriction form:
  - Viewer search
  - Restriction type toggle (mute/cooldown)
  - Mute configuration (duration)
  - Cooldown configuration (gap, period)
  - Save button

- [ ] **3.7** Implement muted users table:
  - Display all muted users
  - Show muted_at timestamp
  - Show duration
  - Show countdown timer
  - Unmute button

- [ ] **3.8** Implement cooldown users table:
  - Display all users with cooldowns
  - Show cooldown gap
  - Show set_at timestamp
  - Show duration
  - Show countdown timer
  - Remove button

- [ ] **3.9** Add chat commands help section:
  - Command list
  - Usage examples
  - Note about auto-updates

- [ ] **3.10** Test: Tables populate, add/remove works

---

### Step 4: Update Backend (30 min)

- [ ] **4.1** Verify IPC handlers exist:
  - `viewer-tts-rules:get-all-muted`
  - `viewer-tts-rules:get-all-cooldown`

- [ ] **4.2** Update repository methods in `viewer-tts-rules.ts`:
  ```typescript
  // Add JOINs to include viewer info:
  getAllMuted(): Array<ViewerTTSRules & { viewer_username: string }> {
    // JOIN with viewers table
    // Return muted users with username
  }
  
  getAllCooldown(): Array<ViewerTTSRules & { viewer_username: string }> {
    // JOIN with viewers table
    // Return cooldown users with username
  }
  ```

- [ ] **4.3** Test: Backend returns viewer info correctly

---

### Step 5: Add Styling (1 hour)

- [ ] **5.1** Create CSS file:
  - `src/frontend/screens/tts/tabs/styles/ViewerTTSRestrictionsTab.css`

- [ ] **5.2** Style main layout:
  - Add restriction section background
  - Restriction type toggle buttons
  - Form layout

- [ ] **5.3** Style tables:
  - Muted users table
  - Cooldown users table
  - Hover effects
  - Column widths

- [ ] **5.4** Style special elements:
  - Countdown timers (yellow)
  - Permanent markers (red)
  - Cooldown gap badges (blue)
  - Action buttons

- [ ] **5.5** Style chat commands help:
  - Background color
  - Code formatting
  - Command list styling

- [ ] **5.6** Update Voice Settings CSS:
  - Remove mute/cooldown specific styles

- [ ] **5.7** Test: Everything looks good

---

### Step 6: Register New Screen (15 min)

- [ ] **6.1** Import in `TTSScreen.tsx`:
  ```typescript
  import { ViewerTTSRestrictionsTab } from './tabs/ViewerTTSRestrictionsTab';
  ```

- [ ] **6.2** Add to tabs array:
  ```typescript
  {
    id: 'viewer-tts-restrictions',
    label: 'Viewer TTS Restrictions',
    component: <ViewerTTSRestrictionsTab />
  }
  ```

- [ ] **6.3** Order tabs logically:
  1. General Settings
  2. Voices
  3. Viewer Voice Settings ← renamed
  4. Viewer TTS Restrictions ← NEW
  5. Access Control
  6. Channel Points

- [ ] **6.4** Test: New tab appears and navigates correctly

---

### Step 7: Integration Testing (1 hour)

- [ ] **7.1** Voice Settings Screen:
  - Search works
  - Voice selection works
  - Pitch/speed sliders work
  - Save works
  - Update works
  - Delete works
  - Table shows all voice preferences
  - NO mute/cooldown UI visible ✅

- [ ] **7.2** Restrictions Screen:
  - Muted users table populates
  - Cooldown users table populates
  - Add mute (permanent) works
  - Add mute (timed) works
  - Add cooldown works
  - Unmute button works
  - Remove cooldown button works
  - Countdown timers update
  - Auto-refresh every 10 seconds works

- [ ] **7.3** Chat Command Integration:
  - Run `~mutevoice @user`
  - Check restrictions screen updates ✅
  - Check notification appears ✅
  - Run `~unmutevoice @user`
  - Check user disappears from table ✅
  - Run `~cooldownvoice @user 30 15`
  - Check user appears in cooldown table ✅

- [ ] **7.4** Database Consistency:
  - Voice preference without restriction ✅
  - Restriction without voice preference ✅
  - Delete voice → restriction remains ✅
  - Clear restriction → voice remains ✅

- [ ] **7.5** Edge Cases:
  - Multiple users muted
  - Expired restrictions
  - Navigate away and back
  - Restart app
  - All data persists ✅

---

### Step 8: Build & Deploy (15 min)

- [ ] **8.1** Run build:
  ```bash
  npm run build
  ```

- [ ] **8.2** Check for errors:
  - No TypeScript errors ✅
  - No webpack errors ✅
  - Build succeeds ✅

- [ ] **8.3** Test in production mode:
  - Both screens work
  - Data loads correctly
  - Events fire correctly

- [ ] **8.4** Final verification:
  - All checklist items complete ✅
  - Success criteria met ✅
  - Ready to use! 🎉

---

## 📋 Files Modified Summary

### Created (2 files)
- `src/frontend/screens/tts/tabs/ViewerTTSRestrictionsTab.tsx`
- `src/frontend/screens/tts/tabs/styles/ViewerTTSRestrictionsTab.css`

### Renamed (1 file)
- `ViewerRulesTab.tsx` → `ViewerVoiceSettingsTab.tsx`

### Modified (3 files)
- `src/frontend/screens/tts/TTSScreen.tsx` (imports, tab registration)
- `src/frontend/screens/tts/tabs/ViewerVoiceSettingsTab.tsx` (remove restrictions logic)
- `src/backend/database/repositories/viewer-tts-rules.ts` (add JOINs)

### Total: 6 files touched

---

## ⚠️ Critical Success Criteria

Before marking as complete:

1. ✅ **Two separate screens exist**
2. ✅ **Voice Settings has ZERO restriction logic**
3. ✅ **Restrictions screen shows all users at a glance**
4. ✅ **Chat commands auto-update UI**
5. ✅ **No database schema changes**
6. ✅ **Build completes without errors**
7. ✅ **All 8 test scenarios pass**

---

## 🆘 Troubleshooting

**If voice settings don't load:**
- Check import path after rename
- Check component name updated everywhere
- Check tab registration in TTSScreen

**If restrictions screen is empty:**
- Check IPC handlers return data
- Check repository methods have JOINs
- Check event listener is registered
- Check auto-refresh interval working

**If chat commands don't update UI:**
- Check event listener in useEffect
- Check event name matches backend
- Check mainWindow is set in chat handler
- Check loadAllRestrictions() is called

**If countdown timers don't update:**
- Check auto-refresh interval (every 10s)
- Check formatTimeRemaining() function
- Check component re-renders on state change

---

## 📚 Reference Documents

1. **Implementation Plan:** `PHASE-5-VIEWER-SCREEN-SPLIT.md`
2. **Architecture Diagrams:** `PHASE-5-ARCHITECTURE-BEFORE-AFTER.md`
3. **Original Issue:** Conversation summary above

---

**Ready to implement!** ✅  
**Time estimate:** 4-6 hours  
**Difficulty:** Medium  
**Risk:** Low (no DB changes, clean separation)

Good luck tomorrow! 🚀
