# WebSpeech Voices Debugging Guide

## Quick Check

If you see "0 system voices available" in the TTS Provider Settings:

### Step 1: Open DevTools
Press **Ctrl+Shift+I** in the app to open Developer Tools

### Step 2: Go to Console
Click the **Console** tab

### Step 3: Run this command
```javascript
console.log(window.speechSynthesis.getVoices().length);
```

If this returns `0`, continue to Step 4. If it returns a number > 0, something else is wrong.

### Step 4: Wait for voices to load
Some systems load voices asynchronously. Run this:
```javascript
window.speechSynthesis.onvoiceschanged = () => {
  const voices = window.speechSynthesis.getVoices();
  console.log(`Voices loaded: ${voices.length}`);
  voices.forEach((v, i) => console.log(`${i+1}. ${v.name} (${v.lang})`));
};
```

Then wait a few seconds.

## Full Voice Inspection

Run this in the console to see everything:
```javascript
const voices = window.speechSynthesis.getVoices();
console.log('=== WEBSPEECH VOICES DEBUG ===');
console.log(`Total: ${voices.length}`);
console.log('');

if (voices.length === 0) {
  console.warn('NO VOICES FOUND - Check Windows Speech Settings');
} else {
  voices.forEach((v, i) => {
    console.log(`[${i+1}] ${v.name}`);
    console.log(`    Language: ${v.lang}`);
    console.log(`    URI: ${v.voiceURI}`);
    console.log(`    Default: ${v.default}`);
    console.log(`    Local: ${v.localService}`);
    console.log('');
  });
}
```

## Windows Voice Installation

### Check Current Voices
1. Go to **Settings** (Win+I)
2. Navigate to **Time & Language** → **Speech**
3. Look at **Manage voices** or **Text-to-speech voices**

### Install More Voices (Windows 10/11)
1. Go to **Settings** → **Time & Language** → **Speech**
2. Click **Manage voices** (or similar)
3. Click **Add voices** or **Download**
4. Select languages/voices you want
5. Install them

### Troubleshooting on Windows

**If voices are installed but not showing in app:**
- Try restarting the app
- Check if Windows TTS is working: 
  - Open Narrator: Win+H
  - It should speak if TTS is working
- Try a different voice - make it the default

**If no voices are installed:**
- Windows 11 should have default voices - reinstall your language pack
- Open Settings → Time & Language → Language → [Your Language] → Options → Text-to-speech
- Make sure it shows available voices

## Using the Debug Buttons in App

The TTS screen now has built-in debugging:

### 📋 Check Available Voices
- Automatically logs all available voices to console
- Groups by language
- Shows voice IDs you can use

### 🔊 Test Voice Output
- Speaks a test phrase using the first available voice
- Confirms audio output is working
- Check your system volume if no sound

## Common Causes of "0 Voices"

1. **No voices installed on Windows** - Most common
   - Solution: Install voices in Windows Settings

2. **Wrong version of Electron** - Electron < 5.0
   - Solution: Upgrade Electron (your app uses 35.7.5, which is fine)

3. **Web Speech API not available** - Rare in Electron
   - Solution: Check Electron version and OS

4. **Voices loading asynchronously** - App checks too early
   - Solution: Use the debug button which waits for voices

## Testing Text-to-Speech on Windows

Without the app, test if TTS works:
1. Settings → Accessibility → Speech
2. Click "Preview" next to any voice
3. Should hear speech

If this doesn't work, voices aren't properly installed.

## When Everything Works

Once you have voices:
- Voice dropdown should show available system voices
- Test button should produce audio
- Chat messages should be spoken if TTS is enabled

## If Still No Luck

Share the output from running the full voice inspection command above, and I can help debug further!
