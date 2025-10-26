# Windows SAPI5 Natural Voices Setup Guide

## Overview
On Windows, the Web Speech API uses SAPI5 (Speech Application Programming Interface) to access system voices. You can install natural neural voices from Microsoft that will be available to this application.

## Current Setup

### What Changed
1. **Main Window Configuration** (`src/backend/core/window.ts`):
   - Added explicit handling for voices on window load
   - Ensures Web Speech API is fully initialized before use
   - Windows SAPI5 voices now load via `executeJavaScript` trigger

2. **Frontend Voice Initialization** (`src/frontend/services/tts.ts`):
   - Enhanced voice loading with better logging
   - Added polling mechanism (fallback) for Windows voice loading delays
   - Now detects and logs voice details automatically
   - Waits up to 2 seconds for Windows to load SAPI5 voices

## Installing Natural Voices on Windows

### Step 1: Open Settings
1. Press `Win + I` to open Windows Settings
2. Go to **Settings → System → Sound → Advanced**
3. Click **Text-to-speech settings** (or search for "Text to speech")

### Step 2: Install Natural Voices
1. Under **Text-to-speech**, find **"Manage voices"**
2. Click **"Add voices"** or **"Download voices"**
3. Select languages and neural voice packs you want (e.g., "English (United States)")
4. Click **Download** and wait for installation

### Step 3: Verify Installation
In Windows Settings > Sound > Text-to-speech:
- You should see neural voices listed (look for voice names like "Microsoft Aria Online", "Microsoft Guy Online", etc.)
- These are the natural voices you can use

## Troubleshooting - Check if App Can Access Voices

### Method 1: DevTools Console Check

1. **Start the app** and the TTS screen
2. **Open DevTools** (press `Ctrl+Shift+I`)
3. Go to the **Console** tab
4. Run these commands:

```javascript
// Check total voices available
speechSynthesis.getVoices().length

// See all voice details
speechSynthesis.getVoices().map(v => ({
  name: v.name,
  lang: v.lang,
  voiceURI: v.voiceURI,
  localService: v.localService,
  default: v.default
}))

// Check if voices are loading asynchronously
speechSynthesis.onvoiceschanged = () => console.log('Voices changed!', speechSynthesis.getVoices().length)
```

### Method 2: Check Console Output

When the app starts, look at the DevTools console for messages like:

```
[Main] Web Speech API initialized with X voices
[TTS] Loaded X voices from Web Speech API
[TTS] Voices by language: { en: 5, es: 2, ... }
[TTS] Sample voice: { name: "...", lang: "en-US", voiceURI: "...", ... }
```

**If you see 0 voices**, check the section below.

### Method 3: Rescan Button

1. Go to **Voice Settings** tab
2. Click the **🔄 Rescan** button next to "Web Speech API"
3. Check the DevTools console for output
4. The app should show: `✓ webspeech rescanned: X voices found`

## If Voices Show as 0

### Potential Issues and Solutions

#### Issue 1: SAPI5 Not Available
**Symptom**: `getVoices().length` returns 0 even after install

**Solution**:
1. Verify voices installed in Windows Settings (see "Installing Natural Voices" above)
2. Restart the app (Electron may cache voice list)
3. Try a full system restart if still not working

#### Issue 2: Voice Loading Delay
**Symptom**: Works after a few seconds, or after clicking "Rescan"

**Solution**:
- This is expected on Windows sometimes
- The app now includes a polling mechanism that waits up to 2 seconds
- Click the **Rescan** button to manually trigger voice loading
- The app will show: `Voices loaded via polling on attempt X`

#### Issue 3: Electron Version Mismatch
**Symptom**: Voices work in Chrome but not in the app

**Solution**:
1. Check Electron version in `package.json`
2. Ensure `contextIsolation: false` and `nodeIntegration: true` (already set)
3. This allows Web Speech API to access system SAPI5 voices

## Voice Details and Properties

When voices load successfully, each voice has these properties:

```javascript
{
  name: "Microsoft Aria",              // Display name
  lang: "en-US",                       // Language code
  voiceURI: "native|HKEY_LOCAL_MACHINE\\...",  // Windows SAPI5 reference
  localService: true,                  // true = local system voice
  default: false                       // true = default voice for language
}
```

### Expected Voice Names on Windows

Common Windows SAPI5 voices include:
- **David** (Male, English US)
- **Zira** (Female, English US)
- **Mark** (Male, English UK)
- **Susan** (Female, English UK)
- **Microsoft Aria** (Female, Neural)
- **Microsoft Guy** (Male, Neural)
- And others depending on installed language packs

## Technical Details

### How Web Speech API Accesses Windows Voices

```
Web Speech API (JavaScript)
        ↓
Chromium/Blink (in Electron)
        ↓
SAPI5 (Windows Speech API)
        ↓
Installed Voice Engines (Natural, Standard, etc.)
```

### Voice Loading Flow

1. **App Starts** → Main window loads
2. **Window Ready** → `did-finish-load` event fires
3. **JavaScript Executes** → Web Speech API initialized
4. **Voices Load** → Either immediately or via `onvoiceschanged` event
5. **Polling Fallback** → If voices still not loaded after 2 seconds
6. **App Ready** → Voices appear in dropdown, Rescan works

## Performance Notes

- Windows sometimes takes time to load SAPI5 voices (100-500ms)
- The app waits up to 2 seconds with polling
- Rescan button manually triggers reload (useful if system voices change)
- Neural voices may have higher latency than standard voices

## Next Steps

1. **Install natural voices** in Windows Settings
2. **Restart the app**
3. **Check Console** with the DevTools commands above
4. **Use Rescan button** if voices don't appear immediately
5. **Report if issues persist** with console output

## Additional Resources

- [Microsoft Windows Voice Downloads](https://support.microsoft.com/en-gb/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01)
- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SAPI5 Overview](https://docs.microsoft.com/en-us/previous-versions/windows/desktop/ms723627(v=vs.85))
