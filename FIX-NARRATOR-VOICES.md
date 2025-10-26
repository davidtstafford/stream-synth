# Quick Fix: Get Narrator Voices Working in Stream Synth

## The Problem

You installed Microsoft Prahbat via:
❌ Settings > Accessibility > Narrator (WRONG LOCATION)

But Stream Synth only sees voices from:
✓ Settings > Time & Language > Speech (CORRECT LOCATION)

## The Fix (2 Minutes)

### Option 1: Install in the Correct Location (Recommended)

1. **Open Settings** (Win+I)
2. Go to **System > Sound > Text-to-speech** 
   - OR: **Time & Language > Speech** (older Windows)
3. Click **"Manage voices"** or **"Add voices"**
4. Find **"Microsoft Prahbat"** or search **"English (India)"**
5. Click **Download** (if not already there)
6. Wait for installation to complete
7. **Restart Stream Synth**
8. Check **Voice Settings** tab
9. **Look for Microsoft Prahbat** ✓

### Option 2: Check Where It's Currently Installed

Run this in PowerShell to see what you have:

```powershell
Write-Host "Text-to-Speech Voices:"
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | Select-Object -ExpandProperty PSChildName

Write-Host "`nNarrator Voices:"
Get-ChildItem "HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions" | Select-Object -ExpandProperty PSChildName
```

**If Prahbat appears ONLY in Narrator list:**
- It's in the wrong system
- Install it again in Time & Language > Speech (above)

## Understanding the Two Systems

```
TWO SEPARATE VOICE SYSTEMS ON WINDOWS:

1. NARRATOR (Accessibility)
   Settings > Accessibility > Narrator
   Uses: Windows Narrator app only
   Web Speech API: ✗ CAN'T SEE THESE

2. TEXT-TO-SPEECH (SAPI5)
   Settings > Time & Language > Speech
   Uses: All apps, Web Speech API
   Web Speech API: ✓ CAN SEE THESE

Stream Synth uses: TEXT-TO-SPEECH (SAPI5)
Your Prahbat is in: NARRATOR
Result: Prahbat invisible ✗
```

## Why This Matters

- ❌ Narrator system = Not accessible to web apps
- ✓ Text-to-Speech system = Accessible to web apps
- 🎯 For Stream Synth to see voices, they MUST be in Text-to-Speech

## After Installing in Correct Location

1. **Close Stream Synth** completely
2. **Wait 2 seconds**
3. **Open Stream Synth**
4. Go to **Voice Settings** tab
5. Look for **Microsoft Prahbat**
6. Should show **22+ voices** (up from 21)

## Verify It Worked

Open DevTools and check console:
- `Ctrl+Shift+I` → **Console** tab
- Should see: `[TTS] Indian English voices found: ["Microsoft Prahbat"]`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Don't see "Add voices" option | You're in wrong Settings location - check "System > Sound > Text-to-speech" |
| Can't find Microsoft Prahbat | Make sure searching "English (India)" or just "Prahbat" |
| Shows "Download" | Click it and wait for completion |
| Already shows "installed" but not in app | Restart Stream Synth, run cache clear script |
| Still not showing after all this | See "NARRATOR-VS-TTS-VOICES.md" for detailed diagnostics |

## Key Difference

```
WRONG (Narrator):
Settings > Accessibility > Narrator > Add Natural Voice
    ↓
Voice installed in: Narrator registry
    ↓
Stream Synth: Can't access ✗

CORRECT (Text-to-Speech):
Settings > Time & Language > Speech > Manage Voices > Download
    ↓
Voice installed in: Text-to-Speech registry
    ↓
Stream Synth: Can access ✓
```

## Summary

1. **Go to**: Settings > System > Sound > Text-to-speech
2. **Click**: "Manage voices"
3. **Search**: "Prahbat" or "English (India)"
4. **Download**: Microsoft Prahbat
5. **Restart**: Stream Synth
6. **Check**: Voice Settings for Prahbat ✓

That's it! The voice will now work in Stream Synth.
