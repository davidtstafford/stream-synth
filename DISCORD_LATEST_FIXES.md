# Discord Bot - Latest Fixes & Remaining Issues

**Date**: November 5, 2025  
**Status**: Partial Fixes Applied - Testing Required

---

## ✅ FIXES APPLIED IN THIS BUILD

### **Fix #1: Status Update Bug** ✅

**Problem:**
Bot was connecting but frontend showed "Disconnected" forever.

**Root Cause:**
When bot was already connected and user clicked "Start Bot" again:
1. Backend returned "Bot already connected"  
2. But `botStatus` object might have been stale
3. Frontend checked status but it was still `{connected: false}`

**Solution:**
```typescript
// discord-bot-client.ts
if (client?.isReady()) {
  console.log('[Discord Bot] Bot already connected');
  // NOW: Update status to reflect actual state
  botStatus = {
    connected: true,
    botId: client.user?.id,
    latency: client.ws.ping
  };
  return botStatus;
}
```

**Expected Result:**
- Click "Start Bot" → Button changes to "Stop Bot"
- Status card shows "Connected" with bot ID
- Works even if bot was already running

---

### **Fix #2: `/findvoice` Without Parameters** ✅

**Problem:**
```
/findvoice
→ ❌ Error finding voices: Invalid number value
```

**Root Cause:**
Code was passing `null` for optional parameters instead of `undefined`, causing filter errors.

**Solution:**
```typescript
// discord-interactions.ts
const language = interaction.options.getString('language') || undefined;
const gender = interaction.options.getString('gender') || undefined;
const provider = interaction.options.getString('provider') || undefined;

// Build filters object, omitting undefined values
const filters: any = {};
if (language) filters.language = language;
if (gender) filters.gender = gender;
if (provider) filters.provider = provider;

const voices = getVoicesByFilters(filters);
```

**Expected Result:**
- `/findvoice` alone → shows ALL voices
- `/findvoice language:Spanish` → filters to Spanish voices
- No more "Invalid number value" error

---

### **Fix #3: Better Status Logging** ✅

**Added:**
```typescript
// discord-bot.ts IPC handler
console.log('[Discord Bot IPC] Getting bot status:', status);
```

**Purpose:**
Now we can see EXACTLY what status the backend is returning, making debugging easier.

---

## 🔴 REMAINING ISSUES (NOT YET FIXED)

### **Issue #1: Missing Commands**

**What You Expected:**
```
/help          - Explain all commands and usage
/findvoice     - Search voices (✅ exists but needs work)
/voice list    - Paginated voice list  
/voice-picker  - Interactive voice selector
```

**What Actually Exists:**
```
/findvoice     - ✅ Exists (just fixed)
/help          - ✅ Exists but help text is wrong
/voice-test    - ✅ Exists but doesn't actually work
```

**Missing:**
- `/voice` command with `list` and `picker` subcommands
- No implementation at all

---

### **Issue #2: `/voice-test` Doesn't Work**

**Current Code:**
```typescript
async function handleVoiceTestCommand(interaction: any) {
  // ... finds voice ...
  
  // TODO: Trigger voice test via IPC to the main Twitch bot
  const successEmbed = new EmbedBuilder()
    .setTitle(`🎤 Testing Voice: ${voice.name}`)
    .setDescription(`Testing audio is playing in the channel...`)
  
  // ← NOTHING ACTUALLY PLAYS AUDIO!
}
```

**What It Does:**
- Shows a pretty embed saying "Testing audio is playing"
- But NO AUDIO actually plays
- It's just a mock-up

**What It Should Do:**
1. Call IPC to main app: `tts:play-sample`
2. Main app plays the voice using TTS engine
3. Audio outputs through configured device
4. Discord receives confirmation

**Why This Is Hard:**
- Discord bot runs in backend
- TTS system runs in backend
- But they're separate services
- Need IPC bridge between them

---

### **Issue #3: Wrong Help Text**

**Current `/help` Output:**
```
/findvoice - Search for voices
/voice-test - Test a voice by ID  ← Says this exists and works
Use /voice-test <ID> to hear it  ← But it doesn't!
```

**What It Should Say:**
```
/findvoice - Browse and search all available voices
  • Use alone to see all voices
  • Add filters: language, gender, provider
  • Interactive pagination and filtering

/help - Show this help message

Note: To set a voice, use ~setvoice <ID> in Twitch chat
```

---

### **Issue #4: `/findvoice` UX Issues**

**Current Behavior:**
```
/findvoice language:Spanish
→ Shows page 1 of Spanish voices
→ Pagination buttons work ✅
→ Filter dropdowns work ✅
```

**BUT:**
- No way to search by NAME (e.g., "find Jorge")
- No way to search by accent (e.g., "Mexican Spanish")
- Gender filter is weird (Male/Female/Non-binary but voices use different terms)
- Provider filter includes options that may not exist

**What Users Want:**
```
/findvoice spanish
→ Shows all Spanish voices (language match)

/findvoice jorge
→ Shows voices with "Jorge" in name

/findvoice spanish male
→ Combines filters
```

---

## 🎯 PRIORITY FIXES NEEDED

### **Priority 1: Fix Status Display** (DONE IN THIS BUILD)
- ✅ Backend returns correct status
- ✅ Frontend should update properly
- **Test this first!**

### **Priority 2: Fix `/findvoice` No-Params** (DONE IN THIS BUILD)
- ✅ Works without parameters
- **Test `/findvoice` alone**

### **Priority 3: Fix Help Text** (NOT DONE)
Remove `/voice-test` from help or fix it to actually work.

### **Priority 4: Implement Real Voice Testing** (NOT DONE)
Need IPC bridge between Discord bot and TTS system.

### **Priority 5: Add Missing Commands** (NOT DONE)
- `/voice list <language>` - Simple paginated list
- `/voice-picker` - Interactive modal selector

---

## 🧪 TESTING INSTRUCTIONS

### **Test 1: Status Display**

1. Restart app (important!)
2. Go to Discord Bot screen
3. **If bot is already running:**
   - Should see "Connected" status ✅
   - Should see "Stop Bot" button ✅
4. **If bot is not running:**
   - Click "Start Bot"
   - Wait 3-4 seconds
   - Should see "Connected" status ✅
   - Button should change to "Stop Bot" ✅

**If this still doesn't work:**
Check terminal for:
```
[Discord Bot IPC] Getting bot status: { connected: true, botId: '...', ... }
```

If it says `connected: false`, the bot isn't actually connecting.

---

### **Test 2: `/findvoice` Without Params**

1. Go to Discord
2. Type `/findvoice` (no parameters)
3. Press Enter

**Expected:**
- Shows all voices (probably hundreds)
- Pagination buttons work
- Filter dropdowns work

**If you see "Invalid number value":**
Build didn't apply correctly. Try:
```bash
rm -rf dist
npm run build
npm start
```

---

### **Test 3: `/findvoice` With Filters**

Try these:
```
/findvoice language:Spanish
/findvoice gender:Male
/findvoice provider:Azure
/findvoice language:French gender:Female
```

**Expected:**
- Filters work
- Shows matching voices
- Can change page
- Can change filters with dropdowns

---

## 📋 WHAT COMMANDS ACTUALLY EXIST

### **✅ Working Commands**

| Command | Status | Notes |
|---------|--------|-------|
| `/findvoice` | ✅ Fixed | Now works without params |
| `/findvoice language:X` | ✅ Works | Filters by language |
| `/findvoice gender:X` | ✅ Works | Filters by gender |
| `/findvoice provider:X` | ✅ Works | Filters by provider |
| `/help` | ⚠️ Works | But help text is misleading |

### **⚠️ Broken Commands**

| Command | Status | Issue |
|---------|--------|-------|
| `/voice-test` | ❌ Mock | Doesn't play audio |

### **❌ Missing Commands**

| Command | Status | Notes |
|---------|--------|-------|
| `/voice list` | ❌ Not implemented | Would need subcommands |
| `/voice-picker` | ❌ Not implemented | Would need modal UI |

---

## 🔧 HOW TO IMPLEMENT MISSING FEATURES

### **Real Voice Testing**

Need to create IPC bridge:

**1. Add IPC handler in TTS service:**
```typescript
// backend/core/ipc-handlers/tts.ts
ipcRegistry.register('tts:play-discord-sample', {
  execute: async ({ voiceId, message }) => {
    const voice = getVoiceById(voiceId);
    // Use existing TTS engine to play sample
    await playSample(voice, message);
    return { success: true };
  }
});
```

**2. Call from Discord bot:**
```typescript
// discord-interactions.ts
async function handleVoiceTestCommand(interaction: any) {
  const voiceId = interaction.options.getInteger('voiceid');
  const message = interaction.options.getString('message') || 'Test message';
  
  // Call main app to play audio
  const result = await ipcRenderer.invoke('tts:play-discord-sample', {
    voiceId,
    message
  });
  
  if (result.success) {
    await interaction.editReply('✅ Voice test played!');
  }
}
```

**Problem:**
Discord bot service doesn't have access to `ipcRenderer` - it's backend-only.
Need different architecture (event emitter or service locator pattern).

---

### **Add `/voice list` Command**

**Option 1: Subcommands**
```typescript
new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Voice management commands')
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('List voices by language')
      .addStringOption(opt =>
        opt.setName('language').setDescription('Language').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('picker')
      .setDescription('Open interactive voice picker')
  );
```

**Option 2: Separate Commands**
```typescript
new SlashCommandBuilder()
  .setName('voicelist')
  .setDescription('List voices by language')
  // ...

new SlashCommandBuilder()
  .setName('voicepicker')
  .setDescription('Open interactive voice picker')
```

---

## 💡 RECOMMENDATIONS

### **Short Term (Do Now)**

1. ✅ Test status display (should work now)
2. ✅ Test `/findvoice` without params (should work now)
3. ❌ Update `/help` text to remove `/voice-test` or mark as "coming soon"
4. ❌ Add note that voice testing happens in Twitch, not Discord

### **Medium Term (Next)**

1. Implement proper voice testing (IPC bridge)
2. Add `/voice list` as separate command
3. Improve `/findvoice` to search by name
4. Better error messages

### **Long Term (Future)**

1. Add `/voice-picker` with modal UI
2. Voice favorites system
3. Voice recommendations based on language
4. Stats (most popular voices, etc.)

---

## 📊 CURRENT STATE

| Feature | Status | Priority |
|---------|--------|----------|
| Bot connects | ✅ Works | DONE |
| Status displays | ✅ Fixed | DONE |
| Token persists | ✅ Works | DONE |
| Auto-start | ✅ Works | DONE |
| `/findvoice` basic | ✅ Fixed | DONE |
| `/findvoice` filters | ✅ Works | DONE |
| `/help` command | ⚠️ Wrong text | HIGH |
| `/voice-test` | ❌ Mock only | MEDIUM |
| `/voice list` | ❌ Missing | LOW |
| `/voice-picker` | ❌ Missing | LOW |

---

## 🚀 NEXT STEPS

1. **Test the status fix:**
   - Restart app
   - Go to Discord Bot screen
   - Check if status shows "Connected"
   - Check if button says "Stop Bot"

2. **Test `/findvoice`:**
   - Try `/findvoice` alone
   - Should show all voices (not error)

3. **Report back:**
   - Does status work now?
   - Does `/findvoice` work without params?
   - Then we can fix help text and implement real voice testing

---

**Build Status:** ✅ Compiled (625 KiB)  
**Fixes Applied:** 2/5  
**Ready for Testing:** ✅ YES

---

**END OF DOCUMENT**
