# Visual Guide: Getting Microsoft Prahbat to Work

## Problem Visualization

```
You Install Prahbat
        ↓
Windows Knows About It (File System)
        ✓ Prahbat files are in C:\Windows\Speech_OneCore\...
        ✓ Windows Settings shows it installed
        ✗ BUT: SAPI5 Cache not updated yet
        ↓
Stream Synth Asks Windows "What voices do you have?"
        ↓
Windows Returns OLD Cached List (21 voices)
        ↓
Prahbat Not In List ✗ (But it WILL be after cache refresh!)
```

## Solution Flow

```
┌──────────────────────────────────────┐
│ 1. Open PowerShell as Administrator  │
│    (Win+R → powershell → Ctrl+Shift+Ent)
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ 2. Run Cache Clear Command           │
│    (Clears SAPI5 voice registry)     │
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ 3. Windows Re-Indexes Voices         │
│    (Finds Prahbat in voice folder)   │
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ 4. Restart Stream Synth App          │
│    (Gets updated voice list)         │
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ 5. ✓ Prahbat Appears in Dropdown!    │
│    (22 voices now visible)           │
└──────────────────────────────────────┘
```

## Step-by-Step Screenshots (Text)

### Step 1: Open PowerShell
```
[Search] type "powershell"
          ↓
[Result] Windows PowerShell
         • Click with Ctrl+Shift held
         • Or right-click → Run as Administrator
         ↓
[Prompt] Administrator: C:\Windows\System32\WindowsPowerShell\v1.0
```

### Step 2: Paste Command
```
PS C:\Users\YourName> [Paste the command]
PS C:\Users\YourName> Stop-Service "Windows Speech Recognition Service" -Force ...

[Output] Stopping Windows Speech Recognition Service...
         Clearing speech cache...
         Restarting Windows Speech Recognition Service...
         Waiting 3 seconds for service to initialize...
         Done!
```

### Step 3: Close PowerShell
```
PS C:\Users\YourName> exit
[Window closes]
```

### Step 4: Restart Stream Synth
```
[App was open] ← Close it completely
       ↓
[App was closed] ← Wait 2 seconds
       ↓
[App is opening] ← Watch the console
       ↓
[App is ready]
[Go to Voice Settings tab]
      ↓
[Look for voice dropdown]
      ↓
[21 voices] ✗ (before fix)
[22 voices] ✓ (after fix - Prahbat added!)
```

### Step 5: Verify in DevTools
```
Stream Synth App
      ↓
Ctrl+Shift+I (Open DevTools)
      ↓
Console Tab
      ↓
Search for: "en-IN" or "Prahbat"
      ↓
Should see:
[TTS] Indian English voices found: ["Microsoft Prahbat"]
```

## Before & After Console Output

### BEFORE (Current - 21 voices)
```
[TTS] Loaded 21 voices from Web Speech API
[TTS] Voices by language: Object
[TTS] Loaded 21 voices from Web Speech API
[TTS] Voices by language: Object
[TTS] Polling timeout - voices may not be available or failed to load
```

### AFTER (Expected - 22 voices)
```
[TTS] Loaded 22 voices from Web Speech API
[TTS] Voices by language: {en: 6, es: 2, fr: 2, de: 2, it: 2, pt: 1, ja: 1, ko: 1, ru: 1, ar: 1, hi: 1}
[TTS] Sample voice: {name: "Microsoft David Desktop", lang: "en-US", voiceURI: "native|HKEY_LOCAL_MACHINE\...", localService: true, default: true}
[TTS] Newly detected voices: ["Microsoft Prahbat|en-IN"]
[TTS] Indian English voices found: ["Microsoft Prahbat"]
```

Key differences:
- ✓ 22 voices instead of 21
- ✓ `hi: 1` (Hindi) in languages
- ✓ "Newly detected voices" message
- ✓ "Indian English voices found" message

## Voice Dropdown View

### BEFORE (Without Prahbat)
```
Voice Selection
[Select a voice...]
├─ System Voices
│  ├─ Microsoft David Desktop ♂️
│  ├─ Microsoft Zira Desktop ♀️
│  ├─ ... (19 more)
└─ (No en-IN voices)
```

### AFTER (With Prahbat)
```
Voice Selection
[Select a voice...]
├─ System Voices
│  ├─ Microsoft David Desktop ♂️
│  ├─ Microsoft Zira Desktop ♀️
│  ├─ ... (19 more)
│  ├─ Microsoft Prahbat ♀️  ← NEW!
└─ (Now shows en-IN voice!)
```

## Timeline

```
You:              PowerShell → "run command" → Close → Restart App
Time:             30 sec         30 sec        10 sec    30 sec
                  ├─────────────┤
                  [1 minute total setup]
                                            ├───────────┤
                                            [Prahbat appears!]
```

## Troubleshooting Quick Reference

| What You See | What To Do |
|------|------|
| 21 voices in dropdown | Run PowerShell command above |
| Still 21 after restart | Click 🔄 Rescan button |
| Rescan shows no change | Run "Deep Registry Clear" (PRAHBAT-VOICE-SETUP.md) |
| Console shows "Prahbat" but app shows old count | Rebuild: `npm run build` |
| Prahbat not even in Windows Settings | Reinstall it via Settings > Sound > Text-to-speech |

## Success Checklist

- [ ] PowerShell command ran successfully
- [ ] App restarted
- [ ] Voice count increased (21 → 22)
- [ ] Can see "Microsoft Prahbat" in dropdown
- [ ] DevTools shows "Indian English voices found"
- [ ] Can select Prahbat and test it
- [ ] Sounds work! 🎤

## Got Stuck?

1. Read: `PRAHBAT-VOICE-SETUP.md` (Detailed guide)
2. Check: `PRAHBAT-SUMMARY.md` (Quick overview)
3. Try: `QUICK-FIX-PRAHBAT.txt` (One-liner fix)
4. Last resort: "Nuclear Option" in `PRAHBAT-VOICE-SETUP.md`
