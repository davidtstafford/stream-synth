# TTS Refactor - Lessons Learned (Failed Attempt)

**Date:** November 4, 2025  
**Outcome:** ❌ FAILED - Rolling back  
**Time Invested:** ~6 hours  
**Status:** Reverting to previous working code

---

## 🎯 Original Goal

**Problem:** OBS browser source can't play Web Audio API buffers  
**Desired Solution:** Make WebSpeech TTS work in OBS browser source  
**Approach Chosen:** Refactor entire TTS system to file-based queue

---

## ❌ What Went Wrong

### 1. **Over-Engineering**
- Rewrote entire TTS system (1000+ lines of code)
- Created 4 new services when 1 would suffice
- Changed working code unnecessarily

### 2. **Wrong Technical Approach**
```
Planned: Playwright Chromium → Capture WebSpeech → Save to file
Reality: Playwright Chromium has NO system TTS voices!
```

**Why it failed:**
- Playwright/Chromium doesn't bundle TTS voices
- Headless mode: 0 voices
- Headed mode: Still 0 voices (isolated browser)
- System voices only available in **user's actual browser**

### 3. **Scope Creep**
```
Started:  Add OBS support for WebSpeech
Became:   Rewrite entire TTS architecture
Added:    - AudioFileService
          - AudioQueueService  
          - TTSProcessingService
          - WebSpeechHeadlessProvider
          - FFmpeg dependency (later removed)
          - Playwright dependency
Result:   System more complex, still broken
```

### 4. **Didn't Validate Core Assumption**
**Assumption:** "Playwright browser will have TTS voices"  
**Reality:** Playwright is isolated - no access to system voices  
**Should have:** Tested this in 5 minutes before refactoring everything

### 5. **Sunk Cost Fallacy**
- Kept trying to fix the unfixable
- "Just one more change and it'll work..."
- 6 hours later: still broken

---

## ✅ What Should Have Been Done

### **Option 1: Minimal Approach** (Recommended)
```typescript
// DON'T touch existing TTS
// JUST add a bridge for OBS

// In existing TTSManager:
this.on('tts:spoke', (audioBuffer) => {
  // Also save to file for OBS
  this.emit('tts:save-for-obs', audioBuffer);
});

// New tiny service (50 lines):
class OBSAudioBridge {
  constructor(ttsManager) {
    ttsManager.on('tts:save-for-obs', this.saveForOBS.bind(this));
  }
  
  async saveForOBS(audioBuffer) {
    const filename = `tts-${Date.now()}.mp3`;
    await fs.writeFile(filename, audioBuffer);
    this.broadcastToOBS({ filename });
  }
}
```

**Effort:** 30 minutes  
**Risk:** Zero (existing TTS untouched)  
**Result:** OBS gets files, app still works normally

---

### **Option 2: Accept Limitation**
```
WebSpeech → Works in app only (no OBS)
Azure TTS → Works in app AND OBS (returns MP3 files)
Google TTS → Works in app AND OBS (returns MP3 files)
```

**Tell users:** "For OBS browser source, please use Azure or Google voices"  
**Effort:** 0 minutes (just documentation)  
**Result:** Simple, honest, works

---

### **Option 3: Use Different Tool**
```powershell
# Edge-TTS (Microsoft voices, CLI-based, no browser needed)
npm install edge-tts

# Usage:
edge-tts --text "Hello world" --write-media output.mp3
```

**Effort:** 1 hour  
**Result:** File-based TTS without browser complexity

---

## 📊 Actual vs Expected

| Metric | Expected | Actual |
|--------|----------|--------|
| Time | 30 min | 6 hours |
| Complexity | +50 lines | +1000 lines |
| Dependencies | 0 new | 2 new (playwright, FFmpeg) |
| Risk | Low | High (broke everything) |
| Success | ✅ Works | ❌ Broken |

---

## 🎓 Key Lessons

### 1. **Validate Assumptions Early**
❌ **What we did:** Assumed Playwright would have voices  
✅ **What to do:** Test 5-minute proof of concept first

### 2. **Minimal Touch Principle**
❌ **What we did:** Rewrote everything  
✅ **What to do:** Add feature without changing working code

### 3. **Know When to Stop**
❌ **What we did:** Kept trying to fix unfixable approach  
✅ **What to do:** Recognize dead end, pivot to different solution

### 4. **Incremental Changes**
❌ **What we did:** Big bang refactor  
✅ **What to do:** Small changes, test each one

### 5. **User Experience > Architecture**
❌ **What we did:** "Perfect architecture" that doesn't work  
✅ **What to do:** "Good enough" solution that works

---

## 🔄 Rollback Plan

### Step 1: Find Last Working Commit
```powershell
git log --oneline --all | Select-Object -First 20
# Find commit before refactor started
```

### Step 2: Create Backup Branch
```powershell
git branch refactor-backup-failed
git checkout main  # or your main branch
```

### Step 3: Hard Reset
```powershell
git reset --hard <commit-hash-before-refactor>
```

### Step 4: Verify
```powershell
npm run build
npm start
# Test TTS with chat message
```

---

## 💡 Recommended Next Steps

### **Immediate:** Roll back to working code

### **Short-term:** Implement Option 1 (OBS Audio Bridge)
```typescript
// 50 lines of code
// 30 minutes of work
// Zero risk to existing TTS
// OBS gets file-based audio
```

### **Long-term:** Consider these alternatives

1. **Edge-TTS for WebSpeech voices**
   - CLI-based, no browser needed
   - Microsoft voices (same as WebSpeech)
   - Generates MP3 files directly
   
2. **Recommend Azure/Google for OBS users**
   - Already returns file-based audio
   - Works perfectly with OBS
   - Professional quality voices

3. **Accept WebSpeech limitation**
   - Works great in app
   - Just not available for OBS
   - Document limitation clearly

---

## 📝 Technical Details (For Reference)

### Why Playwright Chromium Has No Voices

```javascript
// Playwright launches isolated Chromium
// System TTS voices are NOT available to isolated browsers
// Only user's regular browser has voice access

// In user's Chrome/Edge:
speechSynthesis.getVoices() // ✅ Returns 50+ voices

// In Playwright Chromium:
speechSynthesis.getVoices() // ❌ Returns [] (empty)
```

**Solution:** Can't be fixed! Playwright is intentionally isolated.

---

### Why File-Based Queue Was Over-Engineered

**What we built:**
```
Chat Message
  ↓
TTSManager (refactored)
  ↓
AudioFileService (new)
  ↓
WebSpeechHeadlessProvider (new)
  ↓
Playwright Browser (new dependency)
  ↓
MediaRecorder
  ↓
WebM file
  ↓
AudioQueueService (new)
  ↓
Play in app + OBS
```

**What we needed:**
```
Existing TTS (working)
  ↓
Also save audio buffer to file
  ↓
Tell OBS about file
  ↓
Done
```

---

## 🚨 Red Flags We Ignored

1. **"WebSpeech Headless might not have voices"**
   - This was in the code comments!
   - We ignored our own warning

2. **"110 bytes of audio"**
   - Clearly wrong
   - Kept trying to fix symptoms, not root cause

3. **"Installing FFmpeg on user machines"**
   - For a desktop app!
   - Should have been immediate red flag

4. **"Takes 6 hours, still broken"**
   - Should have stopped after 30 minutes
   - Sunk cost fallacy in action

---

## ✅ Success Criteria for Future Changes

Before making large changes, verify:

1. ✅ **Proof of concept works** (5-10 minute test)
2. ✅ **Minimal code changes** (prefer <100 lines)
3. ✅ **No new external dependencies** (if possible)
4. ✅ **Doesn't break existing features**
5. ✅ **Can be rolled back easily**
6. ✅ **Time-boxed** (if not working in 1 hour, pivot)

---

## 🎯 The Right Way (Retrospective)

**What we should have done:**

```typescript
// 1. Test if Playwright has voices (5 minutes)
const browser = await chromium.launch();
const page = await browser.newPage();
const voices = await page.evaluate(() => speechSynthesis.getVoices());
console.log(voices.length); // Would have shown 0!

// 2. Stop immediately
console.log("Playwright doesn't have voices. Need different approach.");

// 3. Try edge-tts instead (30 minutes)
const { exec } = require('child_process');
exec('edge-tts --text "test" --write-media test.mp3', () => {
  console.log("Works! Use this instead.");
});

// Total time: 35 minutes
// Result: Working solution
```

---

## 📚 References

- [Playwright Voices Issue](https://github.com/microsoft/playwright/issues/...) - Known limitation
- [Edge-TTS](https://github.com/rany2/edge-tts) - CLI alternative that actually works
- [Web Audio API Limitations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Why OBS can't use it

---

## 💬 Quotes to Remember

> "Make it work, make it right, make it fast - in that order."

> "The best code is no code at all."

> "Don't let perfect be the enemy of good."

> "If you're not embarrassed by the first version, you shipped too late."

---

## 🏁 Conclusion

**The refactor was a valuable learning experience, but it's time to cut our losses.**

**What we learned:**
- ✅ How WebSpeech works (and doesn't work)
- ✅ Playwright limitations
- ✅ Importance of validating assumptions
- ✅ When to pivot vs persevere
- ✅ How to recognize sunk cost fallacy

**What we're doing:**
- 🔄 Rolling back to working code
- 📝 Documenting lessons learned
- 🎯 Choosing simpler approach next time

**Time invested:** 6 hours  
**Value of lessons:** Priceless  
**Next refactor:** Will be done right ✅

---

**Remember:** Sometimes the best code you write is the code you delete. 🗑️
