# ACTION REQUIRED: Install Prahbat in the Correct Location

## What You Need to Do (2 minutes)

### Step 1: Open the Correct Settings

**IMPORTANT:** Do NOT use Accessibility > Narrator!

Instead, use:
1. Press `Win + I` to open Settings
2. Go to **System** (left sidebar)
3. Click **Sound** (or search for "Sound")
4. Scroll down to **Text-to-speech** section
5. Click **"Manage voices"**

### Step 2: Add Microsoft Prahbat

1. In the "Manage voices" window, look for a button:
   - **"Add voices"** or
   - **"Download voices"** or
   - **"+"** button

2. Search for: **"English (India)"** or **"Prahbat"**

3. Find **"Microsoft Prahbat"** in the list

4. Click **Download** (if not already installed)

5. Wait for completion (usually 30 seconds - 1 minute)

### Step 3: Verify Installation

Still in "Manage voices" window, you should see:
```
Microsoft Prahbat
  ├─ Download: (completed - shows as installed)
  └─ Language: English (India)
```

### Step 4: Restart Stream Synth

1. **Close** Stream Synth completely
2. Wait 2 seconds
3. **Open** Stream Synth
4. Go to **Voice Settings** tab
5. Look in the voice dropdown for **"Microsoft Prahbat"**

### Step 5: Verify It Works

1. Open DevTools: `Ctrl+Shift+I`
2. Go to **Console** tab
3. Look for the message: `[TTS] Indian English voices found: ["Microsoft Prahbat"]`
4. If you see it: ✓ **SUCCESS!**

## Expected Results

### Before (Wrong Location - Narrator)
```
[TTS] Loaded 21 voices from Web Speech API
Voice count: 21
Microsoft Prahbat: ✗ NOT in dropdown
```

### After (Correct Location - Text-to-Speech)
```
[TTS] Loaded 22 voices from Web Speech API
[TTS] Indian English voices found: ["Microsoft Prahbat"]
Voice count: 22
Microsoft Prahbat: ✓ IN dropdown
```

## Screenshots: Where to Go

### RIGHT (What You Should Do)
```
Settings
└─ System
   └─ Sound
      └─ Text-to-speech
         └─ "Manage voices" ← CLICK HERE
```

### WRONG (What NOT to Do)
```
Settings
└─ Accessibility
   └─ Narrator
      └─ "Add natural voice" ← NOT THIS
```

## Common Issues

### "I can't find Text-to-speech option"
- You might be on older Windows
- Try: Settings > **Time & Language** > **Speech** > **Manage voices**

### "Manage voices shows no button to add"
- Try refreshing the page
- Try a different browser/edge case: Restart Settings app

### "Microsoft Prahbat shows but not downloading"
- Make sure you clicked the actual voice entry
- Some voices may require an internet connection
- Check if it says "Download" or already "Remove" (means it's there)

### "Still not showing in app after restart"
- Did you restart the APP, not just Windows?
- Make sure to completely close Stream Synth first
- Check DevTools console - does it show Prahbat detected?

## Why This Works

```
You install in: Time & Language > Speech
        ↓
Windows stores in: SAPI5 Registry
        ↓
Web Speech API can read it
        ↓
Stream Synth displays it ✓
```

Compare to what you were doing:

```
You installed in: Accessibility > Narrator
        ↓
Windows stores in: Narrator Registry
        ↓
Web Speech API CANNOT read it
        ↓
Stream Synth cannot display it ✗
```

## One-Minute Summary

1. Settings > System > Sound > Text-to-speech > Manage voices
2. Download "Microsoft Prahbat" (English India)
3. Restart Stream Synth
4. Check Voice Settings - should see Prahbat ✓

**Go do it now!** This is the actual fix. 🚀
