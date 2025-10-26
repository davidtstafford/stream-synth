# Microsoft Prahbat Not in Speech Settings - Installation Guide

## The Issue

Prahbat isn't showing up in:
- ✗ Settings > Time & Language > Speech > Manage Voices
- ✗ Accessibility > Narrator
- ✗ Stream Synth Voice dropdown

This means it **may not be properly installed** or is only available through Narrator (online) voices.

## Why This Happens

Microsoft has different voice tiers:

1. **Standard/Premium Voices** - Downloaded locally, appear in Speech settings
2. **Online Narrator Voices** - Only appear in Narrator, cloud-based
3. **Neural Voices** - May require special installation

Prahbat (especially the "Natural" version) might be **cloud-based** or require **special language pack installation**.

## Solution: Install Prahbat Properly

### Step 1: Check What Languages You Have Installed

1. **Open Settings** (Win+I)
2. Go to **Time & Language > Language & region**
3. Look for **"English (India)"** in the list

**If it's NOT there:**
- Click **"Add a language"**
- Search for **"English (India)"**
- Click **Download**
- Wait for installation (2-5 minutes)

**If it IS there:**
- Click on it to expand
- Click **"Options"**
- Scroll down to **"Text-to-speech"**
- Check if there's a voice listed

### Step 2: Add English (India) Text-to-Speech Voice

1. Go to **Settings > Time & Language > Speech** (NOT Narrator!)
2. Look for **"Manage voices"** or **"Download voices"**
3. Click it
4. In the search box, type: **"India"** or **"en-IN"**
5. Look for options like:
   - "Microsoft Prahbat" 
   - "Microsoft Prahbat Online"
   - "Microsoft Prahbat (Natural)"

**If you see Prahbat:**
- Click the **Download** button
- Wait for completion

**If you DON'T see Prahbat:**
- Continue to Step 3

### Step 3: Install English (India) Language Pack

Prahbat might only become available after installing the language pack:

```powershell
# Run as Administrator

Write-Host "Installing English (India) language support..."

# This installs the language pack for Prahbat
Settings. Add-WindowsCapability -Online -Name Language.Speech_en-in~

# This might also help (Text-to-speech engine for Hindi)
Settings. Add-WindowsCapability -Online -Name Language.Speech_hi-in~

Write-Host "Language pack installation complete!"
Write-Host "Restart your computer and check Settings > Speech > Manage Voices"
```

Or manually:
1. Settings > **Time & Language > Language & region**
2. Click **"English (India)"** if listed
3. Click **"Options"** 
4. Look for **"Speech"** or **"Download"** button
5. Download the speech pack

### Step 4: Try Installing from Windows Update

Sometimes voices are delivered via Windows Update:

1. Settings > **Update & Security > Windows Update**
2. Click **"Check for updates"**
3. Install any available updates
4. Restart Windows
5. Check Settings > Speech > Manage Voices again

## Alternative: Check What Voices ARE Available

Run this PowerShell to see all available voices:

```powershell
# Show all Text-to-Speech voices currently installed
Write-Host "=== Available Text-to-Speech Voices ==="
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | ForEach-Object {
    $voicePath = "HKCU:\Software\Microsoft\Speech\Voices\Tokens\$($_.PSChildName)"
    $attrs = Get-ItemProperty $voicePath
    Write-Host "$($_.PSChildName)`n  Name: $($attrs.Name)`n  Language: $($attrs.'Language (409)')`n"
}

# Check if any en-IN voices exist
Write-Host "`n=== Checking for Indian English Voices ==="
$foundIndia = $false
Get-ChildItem "HKCU:\Software\Microsoft\Speech\Voices\Tokens" | ForEach-Object {
    $voicePath = "HKCU:\Software\Microsoft\Speech\Voices\Tokens\$($_.PSChildName)"
    $attrs = Get-ItemProperty $voicePath
    if ($attrs.'Language (409)' -like "*en-in*" -or $attrs.'Language (409)' -like "*India*") {
        Write-Host "✓ Found: $($attrs.Name)"
        $foundIndia = $true
    }
}

if (-not $foundIndia) {
    Write-Host "✗ No Indian English voices found"
    Write-Host "Prahbat may need to be installed via Language Settings"
}
```

## What If Prahbat Isn't Available in Your Region?

Prahbat availability depends on:
- Your Windows version
- Your regional settings
- Microsoft's rollout

If unavailable, alternatives:
- **Microsoft Aria** (Female, English US - Neural)
- **Microsoft Guy** (Male, English US - Neural)
- **Microsoft David** (Male, English US - Standard)
- **Microsoft Zira** (Female, English US - Standard)

## Why This Is Complicated

```
Microsoft Voice Distribution:
├─ Narrator-only voices
│  └─ Prahbat (Natural) - May ONLY be here
├─ Speech-only voices  
│  └─ Other neural voices
├─ Language pack voices
│  └─ Requires language pack installation
└─ Cloud-based (online)
   └─ Requires internet connection
```

Prahbat might be in **ANY of these categories**, which is why it's hard to find!

## Quick Checklist

- [ ] English (India) language installed? (Settings > Time & Language > Language & region)
- [ ] Checked Settings > Time & Language > Speech > Manage Voices for Prahbat?
- [ ] Searched using "India", "en-IN", "Prahbat"?
- [ ] Tried running the PowerShell script above?
- [ ] Windows fully updated? (Settings > Update & Security)
- [ ] Restarted Windows after checking?

## Next Steps

1. **Run the PowerShell script above** - Tell me what voices you have
2. **Check if English (India) is installed** - If not, install it
3. **Look in Speech Settings again** - After language pack installed
4. **Report back** - Let me know what you see

Once I know what's actually available on your system, I can help you get a working voice!
