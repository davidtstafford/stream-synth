# Windows SAPI5 Voices - Quick Troubleshooting Checklist

## ✅ Step 1: Verify Windows Installation

- [ ] Open Windows Settings (Win+I)
- [ ] Go to Settings → System → Sound → Text-to-speech
- [ ] See "Manage voices" option
- [ ] See at least one voice listed (e.g., "Microsoft Aria", "David", "Zira")
- [ ] If missing: Click "Download voices" and install English (US) neural pack

## ✅ Step 2: Check App Voice Loading

### Option A: Quick Console Check
1. Start the app
2. Go to **Voice Settings** tab
3. Open DevTools: `Ctrl+Shift+I`
4. Click **Console** tab
5. Look for message: `[TTS] Loaded X voices from Web Speech API`
   - If X > 0 ✓ Voices are loading correctly
   - If X = 0 → Go to "Debugging" section

### Option B: Voice Count Display
1. In Voice Settings tab
2. Look at the Web Speech API provider section
3. Should show: `✓ X system voices available`
   - If X > 0 ✓ Everything working
   - If X = 0 → Continue troubleshooting

## ✅ Step 3: Manual Console Commands (in DevTools)

```javascript
// Check number of available voices
speechSynthesis.getVoices().length   // Should be > 0

// See first voice details
speechSynthesis.getVoices()[0]       // Should show name, lang, voiceURI

// See all voice names
speechSynthesis.getVoices().map(v => v.name).join(', ')

// Manually trigger loading
speechSynthesis.onvoiceschanged = () => alert('Voices changed!')
```

## ❌ If Voices Show as 0

### Quick Fixes (Try These First)

1. **Rebuild and restart**
   ```powershell
   npm run build
   ```
   Then close and reopen the app

2. **Click Rescan button**
   - In Voice Settings tab
   - Click 🔄 Rescan next to "Web Speech API"
   - Check console for: `Voices loaded via polling`

3. **Restart Windows**
   - Sometimes Windows needs a restart after installing voices
   - This is a system limitation, not an app issue

### Detailed Diagnostics

**Check if Windows voices are actually installed:**
1. Open PowerShell
2. Run:
   ```powershell
   Add-Type ???ComTypes Microsoft.Speech.Recognition
   $voices = New-Object -ComObject SAPI.SpVoice
   $voices.GetVoices() | Select-Object -ExpandProperty GetDescription
   ```
3. If you see voice names → Windows has voices
4. If empty → Need to install voices in Windows Settings

**Check app's view of voices:**
1. DevTools Console
2. Run:
   ```javascript
   JSON.stringify(speechSynthesis.getVoices().map(v => ({
     name: v.name,
     lang: v.lang,
     uri: v.voiceURI.substring(0, 50)
   })), null, 2)
   ```
3. Copy the output
4. If empty array `[]` → Web Speech API not connecting to SAPI5

## 🔧 Advanced Debugging

### Enable Verbose Logging
1. Open DevTools console
2. Run:
   ```javascript
   // Listen for voice changes
   speechSynthesis.onvoiceschanged = () => {
     console.log('Voice event fired!');
     console.log(speechSynthesis.getVoices().length, 'voices now available');
   }
   
   // Manually request voices
   const voices = speechSynthesis.getVoices();
   console.log(voices.length, 'voices initially');
   ```
3. Leave DevTools open
4. Click Rescan button
5. Watch console for events

### Check Specific Voice Details
```javascript
const voice = speechSynthesis.getVoices()[0];
console.table({
  name: voice.name,
  lang: voice.lang,
  voiceURI: voice.voiceURI,
  localService: voice.localService,
  default: voice.default
});
```

## 📋 Reporting Issues

If problems persist, provide this info:

```javascript
// Run in DevTools console and share output:
{
  appVersion: navigator.appVersion,
  voiceCount: speechSynthesis.getVoices().length,
  voiceNames: speechSynthesis.getVoices().map(v => v.name),
  voiceLanguages: [...new Set(speechSynthesis.getVoices().map(v => v.lang))],
  windowsVoiceTestResult: "Run PowerShell command above"
}
```

## ✨ Expected Results (After Fix)

When working correctly, you should see:

1. **In Voice Settings tab:**
   ```
   ✓ 5+ system voices available
   ✓ No API key required
   ✓ Works offline
   ```

2. **In DevTools Console:**
   ```
   [Main] Web Speech API initialized with 5 voices
   [TTS] Loaded 5 voices from Web Speech API
   [TTS] Voices by language: {en: 5, ...}
   [TTS] Sample voice: {name: "Microsoft Aria", lang: "en-US", ...}
   ```

3. **In Voice Dropdown:**
   - Multiple voices listed by category
   - Each shows: `[ID] | [Name] [Gender Icon]`
   - Examples: "001 | Microsoft Aria ♀️", "002 | David ♂️"

## 📞 Still Not Working?

1. Check: https://support.microsoft.com/en-gb/windows/appendix-a-supported-languages-and-voices-4446e345-7730-53da-fcfe-55cc64300f01
2. Verify voices installed in Windows
3. Try system restart
4. Check that you're in Voice Settings (not Rules or Viewers tab)
5. Report console output and Windows voice list
