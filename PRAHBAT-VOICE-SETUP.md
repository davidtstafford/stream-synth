# Microsoft Prahbat Voice Not Showing - Complete Fix Guide

## The Problem

You installed "Microsoft Prahbat (Natural) - English (India)" but:
- App shows 21 voices (same as before)
- Prahbat doesn't appear in the voice list
- Rescan doesn't help
- Even after restart, still not there

**This is NOT an app bug** - it's a Windows SAPI5 cache issue.

## Why This Happens

```
Windows SAPI5 Cache (Outdated)
            ↓
Web Speech API (Gets cached list)
            ↓
Stream Synth App (Shows 21 old voices, Prahbat invisible)
```

Windows caches the list of available voices. When you install a new voice, Windows doesn't automatically refresh this cache for Electron/Chromium to see it.

## Solution: Force Windows to Refresh SAPI5 Cache

### Step 1: Open PowerShell as Administrator

1. Press `Windows Key + R`
2. Type: `powershell`
3. Press `Ctrl+Shift+Enter` (this runs as Administrator)
4. Click **Yes** when prompted

### Step 2: Run the Cache Refresh Command

Copy and paste this entire block into PowerShell:

```powershell
# Force Windows to refresh SAPI5 voice cache
Write-Host "Stopping Windows Speech Recognition Service..."
Stop-Service "Windows Speech Recognition Service" -Force -ErrorAction SilentlyContinue

Write-Host "Clearing speech cache..."
Remove-Item "HKCU:\Software\Microsoft\Speech\ProfileCurrentUserGeneralSettings" -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Microsoft\Speech\Voices" -ErrorAction SilentlyContinue

Write-Host "Restarting Windows Speech Recognition Service..."
Start-Service "Windows Speech Recognition Service" -ErrorAction SilentlyContinue

Write-Host "Waiting 3 seconds for service to initialize..."
Start-Sleep -Seconds 3

Write-Host "Done! You can now close PowerShell and restart the app."
```

**You should see:**
```
Stopping Windows Speech Recognition Service...
Clearing speech cache...
Restarting Windows Speech Recognition Service...
Waiting 3 seconds for service to initialize...
Done! You can now close PowerShell and restart the app.
```

### Step 3: Restart Stream Synth App

1. **Close the app completely** (check Task Manager if unsure)
2. **Reopen the app**
3. **Go to Voice Settings tab**
4. **Look for Microsoft Prahbat** in the voice list

### Step 4: Click Rescan (if still not there)

1. Click the **🔄 Rescan** button next to "Web Speech API"
2. Open DevTools (`Ctrl+Shift+I`) → Console tab
3. Look for message: `Indian English voices found: ["Microsoft Prahbat"]`

## Verify It Worked

**In DevTools Console:**

```javascript
// Check if Prahbat is available
const prahbatVoices = speechSynthesis.getVoices()
  .filter(v => v.name.includes('Prahbat') || v.lang.includes('en-IN'));

console.log('Prahbat voices:', prahbatVoices.map(v => v.name));
```

Should show:
```javascript
["Microsoft Prahbat"]
```

## If Still Not Working

### Check 1: Verify Windows Sees the Voice

Run this in PowerShell:

```powershell
# This shows what Windows actually has installed
Add-Type -AssemblyName System.speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$allVoices = $speak.GetInstalledVoices()

# Show all voices
Write-Host "Total voices: $($allVoices.Count)"
$allVoices | ForEach-Object { Write-Host $_.VoiceInfo.Name }

# Specifically check for Prahbat
$prahbat = $allVoices | Where-Object { $_.VoiceInfo.Name -like "*Prahbat*" }
if ($prahbat) {
    Write-Host "`n✓ Prahbat FOUND: $($prahbat.VoiceInfo.Name)"
} else {
    Write-Host "`n✗ Prahbat NOT FOUND - May need reinstall"
}
```

**Results:**
- If Prahbat is listed: Windows sees it, but Electron doesn't. Try "Check 2".
- If Prahbat is NOT listed: It's not installed. Try "Check 3".

### Check 2: Deep Registry Clear (Advanced)

If Windows sees Prahbat but app doesn't, do a deeper cache clear:

```powershell
# As Administrator - This will reset ALL speech settings
Write-Host "Performing deep registry clear..."

# Remove all speech-related registry entries
Remove-Item "HKCU:\Software\Microsoft\Speech" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Complete! Restarting Windows in 30 seconds..."
Write-Host "Close any important applications first."

Start-Sleep -Seconds 10
Write-Host "Restarting in 20 seconds..."
Start-Sleep -Seconds 10
Write-Host "Restarting in 10 seconds..."
Start-Sleep -Seconds 10

Restart-Computer -Force
```

After restart:
1. Open Stream Synth app
2. Click 🔄 Rescan
3. Check for Prahbat

### Check 3: Reinstall the Voice

If Prahbat isn't appearing in Windows at all:

1. **Open Settings** (Win+I)
2. Go to **System → Sound → Text-to-speech → Manage voices**
3. Search for "Prahbat"
4. If you find it but it says "Download": Click to re-download
5. If not listed: 
   - Click **"Add voices"**
   - Select **English (India)**
   - Find and download **Microsoft Prahbat**
6. Wait for download to complete
7. Run the PowerShell cache clear command above
8. Restart app

## Technical Explanation

What the updated app now does:

1. **Tracks voice names** - Remembers what voices were loaded
2. **Detects new voices** - Logs when new voices appear
3. **Specifically logs Indian voices** - Watches for `en-IN` language code
4. **Longer polling** - Waits up to 3 seconds instead of 2
5. **Better diagnostics** - Suggests registry fix if voices don't load

When you install Prahbat and run the registry clear:

```
1. Stop speech service (clears locks)
2. Delete cached registry entries
3. Start speech service (forces Windows to re-index)
4. Windows discovers Prahbat in its voice folder
5. Electron/Chromium gets updated voice list
6. App shows Prahbat in dropdown
```

## Expected Console Output After Fix

```
[TTS] Loaded 22 voices from Web Speech API          ← +1 new voice!
[TTS] Voices by language: {en: 6, es: 2, hi: 1, ...} ← Hindi appeared!
[TTS] Newly detected voices: ["Microsoft Prahbat|en-IN"]
[TTS] Indian English voices found: ["Microsoft Prahbat"]
```

## Still Having Issues?

### Nuclear Option: Complete Voice Reset

⚠️ **This will reset ALL Windows speech settings to default**

```powershell
# As Administrator
Write-Host "Performing complete speech settings reset..."

# Stop all speech services
Get-Service *speech* -ErrorAction SilentlyContinue | Stop-Service -Force

# Remove all registry
Remove-Item "HKCU:\Software\Microsoft\Speech" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "HKLM:\SOFTWARE\Microsoft\Speech" -Recurse -Force -ErrorAction SilentlyContinue

# Restart services
Get-Service *speech* -ErrorAction SilentlyContinue | Start-Service

Write-Host "Reset complete. You may need to restart Windows."
```

Then:
1. Restart Windows
2. Go to Settings and reinstall Microsoft Prahbat
3. Run the cache clear command again
4. Restart app

## Quick Reference

| Symptom | Solution |
|---------|----------|
| Prahbat doesn't appear | Run PowerShell cache clear, restart app |
| Still doesn't appear after cache clear | Run "Deep Registry Clear" (Check 2) |
| Windows sees it but app doesn't | Restart Windows completely |
| Not even in Windows Settings | Reinstall the voice |
| Nothing works | Try "Nuclear Option" above |

## Next Time You Install a Voice

After installing any new voice:

1. ✅ Run PowerShell cache clear (the 4 commands)
2. ✅ Restart the app
3. ✅ Click 🔄 Rescan
4. ✅ Check DevTools for voice names

This ensures the voice is immediately available.
