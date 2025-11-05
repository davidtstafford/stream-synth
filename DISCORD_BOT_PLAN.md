# Discord Bot Integration Plan
## Revised Architecture for Voice Discovery Only

---

## **Overview**

The Discord bot serves as a **voice discovery tool only**. Users:
1. Use Discord bot to **browse and find voices** they like
2. Copy the voice ID
3. Use Twitch chat command (`~setvoice <ID>`) to **activate their voice**

This solves the main problem: **"How do I know which voice to pick?"**

---

## **Phase 1: Discord Bot Setup Guide (UI Component)**

### **File Structure**
```
src/frontend/screens/discord/
├── DiscordSetupGuide.tsx        (Modal/popup guide)
└── components/
    ├── BotCreationStep.tsx      (Step 1-2)
    ├── BotPermissionsStep.tsx   (Step 3)
    ├── BotInviteStep.tsx        (Step 4)
    └── BotTestStep.tsx          (Step 5)
```

### **Guide Content**

#### **Step 1: Create Discord Application**
```
Screenshot of Discord Developer Portal
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Enter name: "Stream Synth Voice Helper"
4. Accept ToS, click Create
5. Copy Application ID (shown in General Information)
   - Save this for later
```

#### **Step 2: Create Bot User**
```
1. In left sidebar, click "Bot"
2. Click "Add Bot"
3. Under TOKEN section, click "Copy"
   ⚠️ WARNING: This token is like your password!
      - NEVER share it publicly
      - Stream Synth stores it encrypted
      - If exposed, regenerate immediately
4. Paste into Stream Synth Discord tab
```

#### **Step 3: Set Bot Permissions**
```
1. Still in left sidebar, click "OAuth2" → "URL Generator"
2. In SCOPES section, check:
   ☑ bot
   ☑ applications.commands

3. In PERMISSIONS section, check:
   ☑ Send Messages
   ☑ Embed Links
   ☑ Use Slash Commands
   ☑ Use Application Commands
   ☑ Read Message History

4. Copy the generated URL at bottom
```

#### **Step 4: Invite Bot to Your Server**
```
1. Paste the URL from Step 3 into your browser
2. Select your Discord server from dropdown
3. Click "Authorize"
4. Complete any CAPTCHA if prompted
5. You should see: "Authorization successful"
6. Return to Discord - bot should now appear in your server's member list
```

#### **Step 5: Test Connection**
```
1. Return to Stream Synth Discord tab
2. Paste bot token you copied in Step 2
3. Click [Test Connection]
4. Bot should send a message to your Discord server:
   "✅ Stream Synth Bot Connected!"
5. If successful, bot is ready!
```

---

## **Phase 2: Bot Commands**

### **Command: `/findvoice`**
**Purpose:** Help users discover voices

**User runs:** `/findvoice`

**Bot responds with interactive message:**
```
🎤 Voice Discovery Helper

Select filters to find your voice:

[Language dropdown ▼]
- English
- Spanish
- French
- German
- ...

[Gender dropdown ▼]
- Male ♂️
- Female ♀️
- Neutral ⚧

[Provider dropdown ▼]
- WebSpeech (Free, system voices)
- Azure (Neural, high-quality)
- Google (Natural, realistic)

[🔍 Search] [🎲 Random] [❓ Help]
```

**After user selects filters:**
```
Showing 5 of 42 English Female voices:

001 │ Aria (Azure) - Neural ♀️
     📍 English (United States)
     [🔊 Listen] [✅ Pick This] [➕ More Info]

002 │ Sofia (Google) - Natural ♀️
     📍 English (United States)
     [🔊 Listen] [✅ Pick This] [➕ More Info]

[◀ Previous] [Next ▶] [🏠 Back to Filters]
```

**User clicks [✅ Pick This]:**
```
✅ You selected: Aria (001) - Azure Neural ♀️ English

📋 Voice ID: 001

To use this voice in Stream Synth:
1. Go to Twitch chat
2. Type: ~setvoice 001
3. Your voice is now set! 🎉

[🔍 Search Again] [View My Current Voice]
```

---

### **Command: `/help`**
**Purpose:** Show quick reference guide

**Bot responds:**
```
🎤 Stream Synth Voice Commands

📚 DISCORD COMMANDS (Voice Discovery)
├ /findvoice    - Search for your perfect voice
├ /help         - Show this help message
└ /voice-test   - Preview any voice by ID

📝 TWITCH CHAT COMMANDS (Voice Activation)
├ ~setvoice <ID>    - Set your voice (e.g., ~setvoice 001)
├ ~myvoice          - Show your current voice
└ ~voices           - Link to full voice list

💡 WORKFLOW:
1. Use /findvoice in Discord to find a voice you like
2. Note the voice ID (e.g., 001)
3. Go to Twitch chat during stream
4. Type: ~setvoice 001
5. Your voice is now active! 🎉

❓ Questions?
- Full guide: ~voices (in Twitch chat)
- Issue? Ask a moderator

[🔍 Start Discovery] [🎤 Test Voice] [View Catalogue]
```

---

### **Command: `/voice-test <ID>`**
**Purpose:** Play audio sample of a voice

**User runs:** `/voice-test 001`

**Bot responds:**
```
🔊 Testing Voice: Aria (001)

[▶️ Play Sample]

"Hello! This is a test of the Aria voice. 
How does it sound to you?"

📊 Voice Details:
- Name: Aria
- Provider: Azure (Neural)
- Gender: Female ♀️
- Language: English (United States)
- Quality: High (Neural engine)

💾 Use in Stream Synth:
Type in Twitch chat: ~setvoice 001

[🔍 Find Similar] [◀ Browse More] [Browse Catalogue]
```

---

## **Phase 3: Discord UI Tab**

### **Discord Settings Tab (in app)**
```
═══════════════════════════════════════════════
    🤖 DISCORD BOT CONFIGURATION
═══════════════════════════════════════════════

STATUS
├─ ● Connected
├─ Server: YourStreamServer (125 members)
└─ Latency: 45ms

BOT TOKEN INPUT
├─ Token: [••••••••••••••••••••••] (encrypted)
├─ [Paste Token] [Hide/Show] [🔄 Regenerate]
└─ ⓘ Get token from Discord Developer Portal

CONNECTION TESTS
├─ [✓] Test Connection
├─ [✓] Send Messages
├─ [✓] Slash Commands
└─ [View Logs]

FEATURES
├─ ☑ /findvoice (Search voices)
├─ ☑ /help (Show commands)
├─ ☑ /voice-test (Preview voices)
├─ ☑ Auto-join messages
└─ ☑ Log interactions

SETUP GUIDE
├─ [📖 Show Setup Guide]
├─ [🔗 Discord Developer Portal]
└─ [⚙️ Advanced Settings]

═══════════════════════════════════════════════
```

---

## **Phase 4: Implementation Checklist**

### **UI Components**
- [ ] `DiscordSetupGuide.tsx` - Modal with 5 steps (reuse WebSpeech guide pattern)
- [ ] `BotTokenInput.tsx` - Secure token input with paste/copy
- [ ] `DiscordStatusDisplay.tsx` - Show connection status & server info

### **Backend Services**
- [ ] `discord-bot-client.ts` - Initialize discord.js bot
- [ ] `discord-commands.ts` - Implement /findvoice, /help, /voice-test
- [ ] `discord-interactions.ts` - Handle buttons, dropdowns, pagination
- [ ] `discord-voice-discovery.ts` - Filter & search logic

### **Database**
- [ ] Add `discord_settings` table:
  ```sql
  CREATE TABLE discord_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bot_token TEXT,              -- encrypted
    bot_status TEXT,             -- 'connected' | 'disconnected'
    last_connected DATETIME,
    server_id TEXT,
    channel_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (id = 1)
  );
  ```

### **IPC Handlers**
- [ ] `discord:start-bot` - Connect bot with token
- [ ] `discord:stop-bot` - Disconnect bot
- [ ] `discord:test-connection` - Test bot is working
- [ ] `discord:send-message` - Send message to Discord channel

---

## **Key Differences from Original Plan**

| Aspect | Original | Revised |
|--------|----------|---------|
| `/setvoice` in Discord | ❌ Won't work (different users) | ❌ Removed |
| `/myvoice` in Discord | ❌ Won't work (different users) | ❌ Removed |
| Voice preference storage | Discord DB | Twitch DB (already have) |
| Primary function | Passive catalogue | **Active voice discovery** |
| User workflow | Browse in Discord | Discord → Find → Twitch → Activate |

---

## **User Journey**

```
User wants to find a voice:

1. Opens Discord
   ↓
2. Types: /findvoice
   ↓
3. Bot shows filters (language, gender, provider)
   ↓
4. User selects: "English, Female, Azure"
   ↓
5. Bot shows 5 voices at a time with buttons
   ↓
6. User listens to samples with [🔊 Listen] button
   ↓
7. User clicks [✅ Pick This] on voice they like
   ↓
8. Bot shows voice ID: "001"
   ↓
9. User goes to Twitch chat during stream
   ↓
10. Types: ~setvoice 001
    ↓
11. Broadcaster confirms: "✅ You voice is set to Aria!"
    ↓
12. When user sends chat message, TTS uses Aria voice! 🎉
```

---

## **Technology Stack**

- **Bot Library:** discord.js v14
- **Storage:** App's existing SQLite database
- **Encryption:** Node.js crypto (for token storage)
- **IPC:** Existing IPC framework

---

## **Next Steps**

1. Create `DiscordSetupGuide.tsx` (copy WebSpeechSetupGuide pattern)
2. Install discord.js: `npm install discord.js`
3. Create bot client manager
4. Implement slash commands
5. Add interactive components (buttons, selects)

