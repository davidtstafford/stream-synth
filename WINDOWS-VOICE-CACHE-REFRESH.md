# Windows SAPI5 Voice Not Showing - Force Refresh Guide

## The Issue

You installed "Microsoft Prahbat (Natural) - English (India)" but it's not appearing in the app, even though you see 21 voices loading. This is a **Windows cache issue**, not an app issue.

## Why This Happens

- Windows caches SAPI5 voices
- New voices don't always get picked up immediately
- Restart + rescan sometimes isn't enough
- The Web Speech API only sees what Windows has indexed

## Solution: Force Windows to Refresh Voice Cache

### Option 1: Quick Registry Fix (Recommended) ✅

Run these PowerShell commands **as Administrator**:

```powershell
# Open PowerShell as Administrator first!

# Stop speech services
Stop-Service "Windows Speech Recognition Service" -Force -ErrorAction SilentlyContinue

# Clear speech services cache
Remove-Item "HKCU:\Software\Microsoft\Speech\ProfileCurrentUserGeneralSettings" -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Microsoft\Speech\Voices" -ErrorAction SilentlyContinue

# Restart Windows Speech Recognition Service
Start-Service "Windows Speech Recognition Service" -ErrorAction SilentlyContinue

# Wait 3 seconds
Start-Sleep -Seconds 3

# Force refresh (Chromium/Electron refresh)
Write-Host "Ready! Restart the app now."
```

**Steps:**
1. Right-click PowerShell → "Run as Administrator"
2. Copy-paste the commands above
3. Let it complete (should say "Ready!")
4. **Close the Stream Synth app completely**
5. Restart the app
6. Check if Microsoft Prahbat now appears

### Option 2: Full System Refresh (More Thorough)

If Option 1 doesn't work, try this:

```powershell
# As Administrator:

# 1. Clear all speech-related registry entries
Remove-Item "HKCU:\Software\Microsoft\Speech" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "HKLM:\SOFTWARE\Microsoft\Speech" -Recurse -Force -ErrorAction SilentlyContinue

# 2. Restart Windows
Restart-Computer -Force
```

**Warning:** This will reset speech settings. Only use if Option 1 doesn't work.

### Option 3: Manual Windows Restart (No Code)

1. **Open Settings** (Win+I)
2. Go to **System > About**
3. Click **"Restart now"**
4. Let Windows fully restart
5. Go to **Settings > Sound > Text-to-speech**
6. Verify Microsoft Prahbat is listed
7. Restart Stream Synth app
8. Check DevTools console

## Verify the Fix Worked

**In DevTools Console (Ctrl+Shift+I):**

```javascript
// Check for Indian voices (should now include Prahbat)
speechSynthesis.getVoices()
  .filter(v => v.lang.includes('en-IN') || v.name.includes('Prahbat'))
  .map(v => ({ name: v.name, lang: v.lang }))
```

**You should see:**
```javascript
[
  { name: "Microsoft Prahbat", lang: "en-IN" }
]
```

## Troubleshooting the Troubleshooting

### If Still Not Showing After Registry Fix

**Check if Windows actually recognizes it:**

```powershell
# This shows what Windows sees (not what the app sees)
Add-Type -AssemblyName System.speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.GetInstalledVoices() | Select-Object -ExpandProperty VoiceInfo | Select-Object Name, Culture
```

Look for "Prahbat" in the output.

**If Prahbat appears in PowerShell but not in app:**
- Close app completely (check Task Manager)
- Clear app cache: Delete `AppData\Local\Stream Synth` (if it exists)
- Rebuild: `npm run build`
- Restart app

### If Prahbat Doesn't Appear Even in PowerShell

The voice install might have failed:

```powershell
# Try reinstalling the voice
1. Settings > Sound > Text-to-speech > Manage voices
2. Find "Microsoft Prahbat"
3. If listed, check if it says "Download" or "Remove"
4. If "Download": Click to reinstall
5. If "Remove": Uninstall, restart, then reinstall
```

## Why This Works

```
Windows SAPI5 Registry (Voice Cache)
        ↓ (Electron refreshes after registry restart)
Chromium/Blink Voice List
        ↓ (App gets voices from here)
App's Voice Dropdown
```

When you restart the service, Windows re-indexes available voices. Restarting the app makes it get the fresh list.

## Prevention for Next Time

Windows sometimes doesn't refresh automatically after:
- Installing new language packs
- Installing new voices
- Updating Windows

**Always do:**
1. Install voice in Settings
2. Run the PowerShell commands above (or restart computer)
3. Restart the app
4. Click Rescan button

## Still Stuck?

Try this nuclear option:

```powershell
# As Administrator - clears ALL Windows speech cache
# (This will reset all speech settings to default)

Remove-Item "HKCU:\Software\Microsoft" -Include "Speech*" -Recurse -Force
Remove-Item "HKLM:\SOFTWARE\Microsoft\Speech" -Recurse -Force
Restart-Computer -Force
```

Then:
1. Restart Windows
2. Reinstall Microsoft Prahbat voice
3. Restart Stream Synth app
4. Rescan voices

This forces Windows to completely rebuild its voice list from scratch.
