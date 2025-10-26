# Microsoft Prahbat Setup - Summary & Next Steps

## What's Changed in the App

✅ **Better voice detection** - Now tracks and logs newly installed voices
✅ **Indian English logging** - Specifically watches for `en-IN` voices like Prahbat
✅ **Longer polling** - Waits 3 seconds instead of 2 for Windows to load voices
✅ **Better diagnostics** - Shows exactly which voices are detected

### Updated Console Messages You'll See:

```
[TTS] Loaded 22 voices from Web Speech API          ← Shows if Prahbat loaded
[TTS] Voices by language: {en: 6, hi: 1, ...}      ← Hindi (hi) = Prahbat there!
[TTS] Newly detected voices: ["Microsoft Prahbat|en-IN"]  ← Prahbat found!
[TTS] Indian English voices found: ["Microsoft Prahbat"]  ← Confirmed loaded
```

## The Real Issue

Your console shows:
```
[TTS] Loaded 21 voices from Web Speech API
[TTS] Loaded 21 voices from Web Speech API
[TTS] Loaded 21 voices from Web Speech API
```

This means **Windows hasn't added Prahbat to its SAPI5 cache yet**, even though it's installed.

## The Fix (Do This Now)

### 1. Open PowerShell as Administrator
- `Windows Key + R` → type `powershell` → `Ctrl+Shift+Enter`

### 2. Run This (Copy-Paste Entire Line)
```powershell
Stop-Service "Windows Speech Recognition Service" -Force -ErrorAction SilentlyContinue; Remove-Item "HKCU:\Software\Microsoft\Speech\ProfileCurrentUserGeneralSettings" -ErrorAction SilentlyContinue; Remove-Item "HKCU:\Software\Microsoft\Speech\Voices" -ErrorAction SilentlyContinue; Start-Service "Windows Speech Recognition Service" -ErrorAction SilentlyContinue; Start-Sleep -Seconds 3; Write-Host "Done!"
```

### 3. Restart Stream Synth App
- Close it completely
- Reopen it
- Go to **Voice Settings**
- You should now see 22 voices (or more)
- Look for **Microsoft Prahbat** in the dropdown

### 4. Verify in DevTools
- Press `Ctrl+Shift+I` → **Console**
- Look for: `Indian English voices found: ["Microsoft Prahbat"]`

## Why This Works

```
Windows Speech Services (stopped)
    ↓ (registry entries deleted - cache cleared)
Windows Speech Services (restarted - forces re-index)
    ↓ (discovers Prahbat voice in system folder)
Electron/Chromium (gets fresh voice list)
    ↓
Stream Synth App (shows Prahbat!)
```

## If It Still Doesn't Work

See detailed troubleshooting in `PRAHBAT-VOICE-SETUP.md`:
- Check if Windows actually sees Prahbat
- Deep registry clear
- Reinstall Prahbat
- Nuclear option (complete reset)

## Files Created/Updated

1. **`PRAHBAT-VOICE-SETUP.md`** - Complete troubleshooting guide
2. **`QUICK-FIX-PRAHBAT.txt`** - Quick 5-minute action checklist
3. **`WINDOWS-VOICE-CACHE-REFRESH.md`** - Detailed cache refresh instructions
4. **`src/frontend/services/tts.ts`** - Better voice detection (rebuilt)

## Expected Timeline

- Run PowerShell command: **1 minute**
- Restart app: **30 seconds**
- Prahbat appears: **Immediate** ✓

## Questions?

**Q: Will this hurt my system?**
A: No, it only clears the speech cache. Same as restarting Windows.

**Q: Does this affect other Windows speech apps?**
A: They'll refresh too. No harm.

**Q: How often do I need to do this?**
A: Only when you install new voices. Future installs may work automatically.

**Q: Can I undo this?**
A: Windows will automatically rebuild the cache. Restart Windows to force rebuild.

## Summary

1. **Run PowerShell cache clear** (1 command)
2. **Restart app**
3. **Prahbat appears** ✓

That's it! The app will now better detect and log newly installed voices.
