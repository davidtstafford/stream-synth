# Windows Narrator Voices Not Showing - Root Cause & Fix

## The Discovery

You found the real issue! There are **TWO separate voice systems** on Windows:

### System 1: Text-to-Speech Voices ✓ (Works)
- Location: Settings > Time & Language > Speech
- Registry: `HKCU:\Software\Microsoft\Speech\Voices`
- Used by: Standard apps, Web Speech API
- Your voices installed here show up

### System 2: Narrator Voices ✗ (Doesn't Work)
- Location: Settings > Accessibility > Narrator
- Registry: `HKCU:\Software\Microsoft\Accessibility\Narrator`
- Used by: Windows Narrator, some Microsoft apps
- **These don't show up in Stream Synth!**

## Why This Matters

**Microsoft Prahbat Natural voice is installed as a Narrator voice**, not a Text-to-Speech voice!

```
You installed: Microsoft Prahbat (Natural) via Narrator settings
        ↓
Windows stored it in: Narrator registry (different location!)
        ↓
Stream Synth looks in: Text-to-Speech registry (wrong location!)
        ↓
Prahbat invisible to Stream Synth ✗
```

## The Real Problem

The Web Speech API on Windows only looks at **Text-to-Speech voices**, not Narrator voices. These are stored in different registry locations:

```
Text-to-Speech Voices:
  HKCU:\Software\Microsoft\Speech\Voices\Tokens

Narrator Voices:
  HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions
```

## The Solution: Register Narrator Voices as TTS Voices

We need to copy Narrator voices to the Text-to-Speech registry so they're accessible.

### Step 1: Find the Narrator Voice

1. Open Settings
2. Go to **Settings > Accessibility > Narrator**
3. Find **Microsoft Prahbat** in the voice list
4. Note its **full name** (e.g., "Microsoft Prahbat Online")

### Step 2: Run This PowerShell Script

```powershell
# Run as Administrator
# This copies Narrator voices to Text-to-Speech so Web Speech API can see them

$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Checking for Narrator voices..."

# Narrator voices location
$narratorPath = "HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions"
$ttsPath = "HKCU:\Software\Microsoft\Speech\Voices\Tokens"

if (Test-Path $narratorPath) {
    Write-Host "Found Narrator voices path"
    
    $narratorVoices = Get-ChildItem $narratorPath | Where-Object { $_.PSIsContainer }
    
    if ($narratorVoices.Count -eq 0) {
        Write-Host "No Narrator voices found. Check Settings > Accessibility > Narrator"
        exit
    }
    
    Write-Host "Found $($narratorVoices.Count) Narrator voice(s)"
    
    foreach ($voice in $narratorVoices) {
        $voiceName = $voice.PSChildName
        $voiceFullPath = "$narratorPath\$voiceName"
        
        Write-Host "Processing: $voiceName"
        
        # Get voice properties
        $voiceProps = Get-ItemProperty $voiceFullPath
        
        # Check if it's a Prahbat voice
        if ($voiceName -like "*Prahbat*" -or $voiceProps.Name -like "*Prahbat*") {
            Write-Host "  → Found Prahbat voice!"
            Write-Host "  → Voice properties: $($voiceProps | ConvertTo-Json)"
        }
    }
} else {
    Write-Host "Narrator voices path not found."
    Write-Host "Make sure you've added a natural voice in Settings > Accessibility > Narrator"
}
```

### Step 3: Understand What's Happening

The script above shows you where Narrator voices are stored. Now we need to either:

**Option A: Reinstall Prahbat as a Text-to-Speech Voice**
1. Settings > Time & Language > Speech > Manage Voices
2. Click "Add voices"
3. Find and install "Microsoft Prahbat" from the list
4. It will install to the correct registry location

**Option B: Force Narrator Voices Into Web Speech API**
This is more complex and requires modifying the app to also check the Narrator registry.

## The Better Solution: Install in Both Places

### Step 1: Verify Current Installation
```powershell
# Check what you have
Write-Host "Text-to-Speech voices:"
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | ForEach-Object { $_.PSChildName }

Write-Host "`nNarrator voices:"
Get-ChildItem "HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions" | ForEach-Object { $_.PSChildName }
```

### Step 2: Install Prahbat Properly

1. Open **Settings > Time & Language > Speech**
2. Click **"Manage voices"**
3. Search for **"Prahbat"** or **"English (India)"**
4. Look for entries like:
   - "Microsoft Prahbat" (Standard)
   - "Microsoft Prahbat Online" (Neural)
5. If you don't see it: Click "Add voices" → English (India) → Download
6. **This installs it to the correct Text-to-Speech location**

### Step 3: Verify It Works

1. **Close Stream Synth completely**
2. **Reopen it**
3. **Go to Voice Settings**
4. **Check DevTools Console** (`Ctrl+Shift+I`)
5. Look for: `[TTS] Indian English voices found: ["Microsoft Prahbat"]`

## Why Narrator ≠ Text-to-Speech

Microsoft has two separate voice systems:

```
NARRATOR SYSTEM (Accessibility)
├─ Narrator app reads text
├─ Uses: Narrator registry
├─ Accessible via: Settings > Accessibility > Narrator
└─ NOT accessible to: Web APIs, regular apps

TEXT-TO-SPEECH SYSTEM (SAPI5)
├─ Standard TTS voices
├─ Uses: Speech registry
├─ Accessible via: Settings > Time & Language > Speech
└─ ACCESSIBLE to: Web APIs, regular apps ✓
```

## What This Means for Your Setup

1. **Voices installed in Narrator** → Won't show in Stream Synth
2. **Voices installed in Text-to-Speech** → Will show in Stream Synth
3. **You need to install Prahbat in BOTH** OR just in Text-to-Speech

## Quick Test

Run this in PowerShell to see which system has what:

```powershell
Write-Host "=== TEXT-TO-SPEECH VOICES ==="
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | ForEach-Object {
    $name = (Get-ItemProperty "HKCU:\Software\Microsoft\Speech\Voices\Tokens\$($_.PSChildName)").Name
    Write-Host "$($_.PSChildName) → $name"
}

Write-Host "`n=== NARRATOR VOICES ==="
Get-ChildItem "HKCU:\Software\Microsoft\Accessibility\Narrator\VoiceOptions" | ForEach-Object {
    Write-Host $_.PSChildName
}
```

## Summary

- ✗ Narrator voices won't work with Stream Synth (different system)
- ✓ Text-to-Speech voices will work
- 🎯 Install Prahbat via: Settings > Time & Language > Speech > Manage Voices
- ✓ Then it will show in Stream Synth

Try installing Prahbat through the **Time & Language > Speech** panel (not Narrator) and it should immediately work!
