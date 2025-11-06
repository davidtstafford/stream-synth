# Discord Bot - Complete System Analysis & Issues

**Date**: November 5, 2025  
**Analysis Type**: Full Stack Root Cause Analysis

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### **1. Discord Bot Intents Not Enabled in Developer Portal**

**Error in Terminal:**
```
[Discord Bot] Error initializing bot: Used disallowed intents
```

**Root Cause:**
The code requests these intents:
- `GatewayIntentBits.Guilds` ✅ (allowed by default)
- `GatewayIntentBits.GuildMessages` ❌ (PRIVILEGED - not enabled)
- `GatewayIntentBits.DirectMessages` ✅ (allowed by default)
- `GatewayIntentBits.MessageContent` ❌ (PRIVILEGED - not enabled)

**Location:** `/src/backend/services/discord-bot-client.ts:43-46`

**Why This Breaks Everything:**
- Bot CAN'T login without required intents enabled in Discord Developer Portal
- Every attempt to start bot fails immediately
- No commands can be registered because bot never connects
- User sees "Disconnected" forever even though token is correct

**Fix Required:**
1. User must go to Discord Developer Portal → Bot section
2. Scroll to "Privileged Gateway Intents"
3. Enable:
   - ✅ MESSAGE CONTENT INTENT
   - ✅ SERVER MEMBERS INTENT (if needed)
4. Click "Save Changes"
5. THEN restart bot in app

**HOWEVER:** For slash commands only, we DON'T need these intents at all!

---

### **2. React Component State Reset on Navigation**

**User Report:**
> "the token disappears when i toggle away from the screen"
> "the auto refresh button deselect when i navigate away from the screen"

**Root Cause:**
React component is completely **UNMOUNTED** when user navigates away:

```tsx
// app.tsx - line 140
const renderScreen = () => {
  switch (activeScreen) {
    case 'discord-bot':
      return <DiscordBot />;  // ← NEW INSTANCE EVERY TIME
    // ...
  }
};
```

**What Happens:**
1. User enters token → saved to DB ✅
2. User navigates to TTS screen → `<DiscordBot />` unmounted
3. User navigates back → `<DiscordBot />` creates FRESH STATE
4. `useEffect` runs → calls `loadSettings()`
5. `loadSettings()` SHOULD restore token from DB...
6. BUT somewhere in this flow, state is not persisting

**Evidence from Code:**
```tsx
// discord-bot.tsx:34
useEffect(() => {
  loadSettings();
}, []); // ← Only runs on mount

const loadSettings = async () => {
  const settings = await ipcRenderer.invoke('discord:get-settings');
  if (settings.bot_token) {
    setBotToken(settings.bot_token);  // ← Should restore token
    setTokenSaved(true);
  }
};
```

**The Real Problem:**
The `loadSettings()` is async but component may render before it completes!

---

### **3. Setup Guide Closes After Token Entry**

**User Report:**
> "the guide closes when i enter the token and click connect"

**Root Cause:**
```tsx
// discord-bot.tsx:396
<button
  onClick={() => {
    if (tokenInput.trim()) {
      onTokenEntered(tokenInput);  // ← Calls parent's onTokenEntered
    }
  }}
>
```

**What `onTokenEntered` Does:**
```tsx
// discord-bot.tsx:305
onTokenEntered={(token: string) => {
  setBotToken(token);
  setTokenSaved(false);
  setShowSetupGuide(false);  // ← CLOSES THE GUIDE!
}}
```

**Why This Is Bad:**
User hasn't finished setup yet! They still need to:
- Save the token
- Start the bot
- Invite bot to server
- Test commands

---

### **4. No Auto-Start Implementation**

**User Expectation:**
> "it also allows auto start"

**Current Reality:**
- Auto-start checkbox exists ✅
- Setting saved to database ✅
- **BUT:** Nothing in `main.ts` or app startup reads this setting
- Bot never auto-starts on app launch ❌

**Evidence:**
```bash
# grep for auto-start in main.ts
No matches found
```

There's NO code that:
1. Checks `auto_start_enabled` on app startup
2. Calls `discord:start-bot` if enabled
3. Loads token from DB and starts bot automatically

---

### **5. Incorrect Intents for Slash Commands**

**Current Intents (line 43-46):**
```typescript
intents: [
  GatewayIntentBits.Guilds,           // ✅ NEEDED
  GatewayIntentBits.GuildMessages,    // ❌ NOT NEEDED (privileged)
  GatewayIntentBits.DirectMessages,   // ❌ NOT NEEDED
  GatewayIntentBits.MessageContent    // ❌ NOT NEEDED (privileged)
]
```

**What We Actually Need for `/findvoice`:**
```typescript
intents: [
  GatewayIntentBits.Guilds  // ← ONLY THIS!
]
```

**Why:**
- Slash commands work through Discord's API, not message parsing
- We're not reading message content
- We're not monitoring DMs
- We only need `Guilds` intent to receive interaction events

**This Would Fix the "disallowed intents" Error Immediately!**

---

### **6. Status Not Updating After Bot Start**

**User Report:**
> "even when i click start bot the disconnected message shows at the top"

**Why This Happens:**

The bot startup flow is:
1. User clicks Start → calls `handleStartBot()`
2. IPC handler `discord:start-bot` runs
3. Bot logs in (but fails due to intents)
4. IPC returns error: "Used disallowed intents"
5. Error displayed in message
6. Status stays "Disconnected"

**But Even If Bot Started Successfully:**

```tsx
// discord-bot.tsx:115
const status = await ipcRenderer.invoke('discord:get-status');
setBotStatus(status);
```

There's a 1-second delay before status check:
```tsx
await new Promise(resolve => setTimeout(resolve, 1000));
```

But the bot login is async and may take 2-3 seconds!

**The Real Issue:**
`getBotStatus()` returns cached `botStatus` object:

```typescript
// discord-bot-client.ts:200
export function getBotStatus(): BotStatus {
  return {
    ...botStatus,  // ← This may be stale!
    latency: client?.ws.ping,
    uptime: client?.uptime ?? undefined
  };
}
```

If bot hasn't fully connected yet, `botStatus.connected` is still `false`.

---

### **7. Database Persistence Actually Works (NOT the Problem)**

**Evidence from Logs:**
```
[Discord Bot IPC] Saving Discord settings...
[CryptoUtils] DISCORD_ENCRYPTION_KEY not set, using fallback key. This is NOT SECURE for production.
[Discord Bot IPC] Token updated: 415f31a0e494
```

**This Shows:**
- Token IS being saved to database ✅
- Encryption IS working ✅
- `discord:save-settings` IPC handler IS working ✅

**The problem is NOT persistence!**

---

## 🎯 ROOT CAUSES SUMMARY

| Issue | Root Cause | Severity |
|-------|------------|----------|
| Bot won't start | Privileged intents not enabled in Discord Portal | 🔴 CRITICAL |
| Bot won't start | Code requests unnecessary intents | 🔴 CRITICAL |
| Token disappears | Async `loadSettings()` race condition | 🟡 MEDIUM |
| Guide closes | `onTokenEntered` closes modal too early | 🟡 MEDIUM |
| No auto-start | Not implemented in app startup | 🟡 MEDIUM |
| Status shows disconnected | Timing issue + bot never connects | 🟡 MEDIUM |

---

## ✅ FIXES REQUIRED

### **Fix #1: Remove Unnecessary Intents (IMMEDIATE FIX)**

**File:** `/src/backend/services/discord-bot-client.ts`

**Change:**
```typescript
// BEFORE:
client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,    // ← REMOVE
    GatewayIntentBits.DirectMessages,   // ← REMOVE
    GatewayIntentBits.MessageContent    // ← REMOVE
  ],
  failIfNotExists: false
});

// AFTER:
client = new Client({
  intents: [
    GatewayIntentBits.Guilds  // ← ONLY THIS!
  ],
  failIfNotExists: false
});
```

**Why This Works:**
- Slash commands only need `Guilds` intent
- No privileged intents = no need to enable in portal
- Bot will connect immediately

---

### **Fix #2: Don't Close Guide After Token Entry**

**File:** `/src/frontend/screens/discord-bot/discord-bot.tsx`

**Change:**
```tsx
// BEFORE:
onTokenEntered={(token: string) => {
  setBotToken(token);
  setTokenSaved(false);
  setShowSetupGuide(false);  // ← DON'T CLOSE!
}}

// AFTER:
onTokenEntered={(token: string) => {
  setBotToken(token);
  setTokenSaved(false);
  // Keep guide open so user can continue with next steps
}}
```

---

### **Fix #3: Add Loading State for Settings**

**File:** `/src/frontend/screens/discord-bot/discord-bot.tsx`

**Change:**
```tsx
// Add loading state
const [settingsLoaded, setSettingsLoaded] = useState(false);

const loadSettings = async () => {
  try {
    const settings = await ipcRenderer.invoke('discord:get-settings');
    
    if (settings.bot_token) {
      setBotToken(settings.bot_token);
      setTokenSaved(true);
    }
    
    setAutoStartEnabled(settings.auto_start_enabled || false);
    
    const status = await ipcRenderer.invoke('discord:get-status');
    setBotStatus(status);
    
    setSettingsLoaded(true);  // ← Mark as loaded
  } catch (err: any) {
    console.error('Error loading settings:', err);
    setSettingsLoaded(true);  // ← Even on error, we tried
  }
};

// Show loading spinner until settings loaded
if (!settingsLoaded) {
  return <div className="loading">Loading settings...</div>;
}
```

---

### **Fix #4: Implement Auto-Start**

**File:** `/src/backend/main.ts`

**Add:**
```typescript
// After app is ready and IPC handlers are set up
async function checkAutoStart() {
  const discordSettingsRepo = new DiscordSettingsRepository();
  const settings = discordSettingsRepo.getSettings();
  
  if (settings.auto_start_enabled === 1 && settings.bot_token) {
    console.log('[Main] Auto-starting Discord bot...');
    try {
      const decryptedToken = decryptToken(settings.bot_token);
      await initializeDiscordBot(decryptedToken);
      console.log('[Main] Discord bot auto-started successfully');
    } catch (err: any) {
      console.error('[Main] Failed to auto-start Discord bot:', err.message);
    }
  }
}

// Call after a short delay
app.whenReady().then(() => {
  // ... existing setup code ...
  
  setTimeout(checkAutoStart, 2000);  // Wait 2 seconds after app ready
});
```

---

### **Fix #5: Wait for Bot Ready Before Returning**

**File:** `/src/backend/services/discord-bot-client.ts`

**Already exists but may need longer timeout:**
```typescript
// Wait for bot to be ready
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Bot login timeout after 10 seconds'));
  }, 10000);  // ← Increase to 15000 if needed

  client!.once('ready', () => {
    clearTimeout(timeout);
    console.log('[Discord Bot] ✓ Ready event fired');
    resolve();
  });
});
```

---

### **Fix #6: Update Status Immediately on Ready**

**File:** `/src/backend/services/discord-bot-client.ts`

**Change:**
```typescript
client!.once('ready', () => {
  clearTimeout(timeout);
  
  // Update status immediately when ready fires
  botStatus = {
    connected: true,
    botId: client!.user?.id,
    latency: client!.ws.ping
  };
  
  console.log('[Discord Bot] ✓ Bot status updated:', botStatus);
  resolve();
});
```

---

## 🧪 TESTING PLAN

### **Test 1: Bot Connection**
1. Apply Fix #1 (remove intents)
2. Rebuild app
3. Enter token
4. Click "Start Bot"
5. **Expected:** Bot connects successfully
6. **Expected:** Status shows "Connected" with bot ID

### **Test 2: Token Persistence**
1. Enter token → Save
2. Navigate to TTS screen
3. Navigate back to Discord Bot
4. **Expected:** Token still visible
5. **Expected:** "✓ Saved" button state preserved

### **Test 3: Setup Guide Flow**
1. Open setup guide
2. Go to Step 3
3. Enter token → Click "Use This Token"
4. **Expected:** Guide stays open
5. **Expected:** Token appears in main UI
6. Continue to Step 4 & 5
7. Click "Done"
8. **Expected:** Guide closes

### **Test 4: Auto-Start**
1. Start bot successfully
2. Enable auto-start checkbox
3. Quit app completely
4. Restart app
5. **Expected:** Bot connects automatically
6. **Expected:** Status shows "Connected"

---

## 📋 PRIORITY ORDER

1. **FIX INTENTS FIRST** ← Without this, nothing else matters
2. Fix setup guide flow
3. Fix token visibility on navigation
4. Implement auto-start
5. Polish status updates

---

## 🔍 WHY THIS WAS SO CONFUSING

1. **Multiple Symptoms, One Root Cause:** All issues stem from bot never connecting due to intents
2. **Misleading Error Message:** "Used disallowed intents" doesn't explain WHICH intents or WHY
3. **UI Works But Bot Doesn't:** Frontend persistence works perfectly, but backend can't connect
4. **Logs Don't Show Full Picture:** Error happens deep in discord.js, not in our code
5. **Documentation Gap:** Discord's intent requirements changed, old tutorials still reference message intents

---

## ✅ NEXT STEPS

1. Apply Fix #1 (intents) → Rebuild → Test
2. If bot connects, apply other fixes
3. If bot still fails, check Discord Developer Portal settings
4. Document intent requirements in setup guide

---

**END OF ANALYSIS**
