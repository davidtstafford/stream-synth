# Why Narrator Voices Don't Work - Full Explanation

## The Discovery

You found that:
- ✓ Voices added via **Time & Language > Speech** work in Stream Synth
- ✗ Voices added via **Accessibility > Narrator** DON'T work in Stream Synth

This is **not a bug in the app** - it's how Windows is designed!

## Windows Has TWO Completely Separate Voice Systems

### System #1: SAPI5 Text-to-Speech (Standard)
```
Purpose: General text-to-speech for all applications
Access: Settings > Time & Language > Speech
Registry: HKCU:\Software\Microsoft\Speech\Voices\Tokens
Used By: Web Speech API, web apps, general apps
Stream Synth: ✓ CAN ACCESS
```

### System #2: Narrator Voices (Accessibility)
```
Purpose: Dedicated for Windows Narrator accessibility
Access: Settings > Accessibility > Narrator  
Registry: HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions
Used By: Only Windows Narrator app
Stream Synth: ✗ CANNOT ACCESS
```

## The Problem Explained

```
When you click "Add Natural Voice" in Narrator settings:
        ↓
Windows stores it in: Narrator Registry
        ↓
Stream Synth looks in: SAPI5 Registry (different location!)
        ↓
RESULT: Voice invisible to Stream Synth
```

## Why Microsoft Does This

Windows separates them because:
- **Narrator system**: Optimized for accessibility features
- **SAPI5 system**: General-purpose TTS for any app

They serve different purposes and use different technology stacks.

## How Web Speech API Works on Windows

```
JavaScript Code (Stream Synth)
        ↓
Web Speech API (JavaScript standard)
        ↓
Chromium/Electron (implements Web Speech)
        ↓
Windows SAPI5 (only this system!)
        ↓
Text-to-Speech Voices Registry
        ↓
Only voices stored here are visible
```

**Narrator voices are in a completely different system** that Web Speech API can't access.

## Visual Comparison

### Where Voices are Stored

```
SAPI5 Registry (Web Speech can access):
├─ Microsoft David
├─ Microsoft Zira
├─ Microsoft Prahbat ← ONLY if installed here!
└─ ... (other TTS voices)

Narrator Registry (Web Speech CANNOT access):
├─ Microsoft Aria
├─ Microsoft Prahbat Online ← Can't see from web
└─ ... (Narrator-specific voices)
```

## The Solution

### Method 1: Install in Correct Location (Easiest)

**Do THIS instead of using Narrator:**

1. Settings > **System > Sound > Text-to-speech**
2. Click **"Manage voices"**
3. Click **"Add voices"** or **"Download"**
4. Find **"English (India)"** → **"Microsoft Prahbat"**
5. Download it

**Result:** Voice stores in SAPI5 registry → Stream Synth sees it ✓

### Method 2: Use Both (If You Want Narrator + Web Apps)

Install in BOTH places:
1. Keep your Narrator installation (for Windows Narrator)
2. Also install in Text-to-Speech (for Stream Synth)

The voice can exist in both systems without conflict.

## Why This Matters

- **You have two options** when installing voices
- **One option (Narrator)** doesn't work with web apps
- **The other option (Text-to-Speech)** works with everything
- **Stream Synth only sees Text-to-Speech voices**

## Common Confusion

Users often:
1. Go to Accessibility > Narrator (because it says "Add natural voice")
2. Install voices there
3. Wonder why web apps can't see them
4. Blame the web app

**The solution:** Install in **Time & Language > Speech** instead!

## Technical Details (For Curiosity)

### Narrator System
- Uses custom Windows Narrator engine
- Different registry structure
- Not exposed to Win32 SAPI5 API
- Accessible only through: `Windows.Media.SpeechSynthesis` (UWP)
- **NOT** accessible through: Web Speech API

### SAPI5 System
- Industry standard (Microsoft SAPI5)
- Registered in registry at: `HKCU:\Software\Microsoft\Speech\Voices\Tokens`
- Exposed to: Win32 API, Chromium/Electron
- **ACCESSIBLE** through: Web Speech API ✓

## How to Tell Which System a Voice Is In

Run this in PowerShell:

```powershell
# SAPI5 Voices (the ones web apps see)
Write-Host "=== SAPI5 Text-to-Speech Voices ==="
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | ForEach-Object {
    Write-Host $_.PSChildName
}

# Narrator Voices (isolated, web apps can't see)
Write-Host "`n=== Narrator Voices (Isolated) ==="
Get-ChildItem "HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host $_.PSChildName
}
```

## Summary

| Aspect | SAPI5 (Web Access) | Narrator (No Web Access) |
|--------|-------------------|-------------------------|
| Settings Location | Time & Language > Speech | Accessibility > Narrator |
| Stream Synth Access | ✓ YES | ✗ NO |
| Used for | General TTS apps | Windows Narrator only |
| Registry | `\Speech\Voices\Tokens` | `\Narrator\VoiceOptions` |
| Web Speech API | ✓ Can access | ✗ Cannot access |

## What You Should Do

**For Stream Synth to access Microsoft Prahbat:**

1. **Go to**: Settings > System > Sound > Text-to-speech
2. **Click**: "Manage voices"
3. **Add**: Microsoft Prahbat (English India)
4. **Restart**: Stream Synth
5. **Verify**: DevTools shows `en-IN` language code

**That's it!** The voice will work because it's installed in the correct registry location.

## Why the App Can't Be Fixed to Access Narrator Voices

- Narrator voices are in a **different API entirely** (`Windows.Media.SpeechSynthesis`)
- Web Speech API has **no access** to them by design
- Fixing this would require a **completely different approach** (not using Web Speech API)
- It would only work for **Windows, not other platforms**

**The correct solution is to use the SAPI5 system**, which is what this app does!
