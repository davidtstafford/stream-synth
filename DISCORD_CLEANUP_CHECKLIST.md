# Discord Webhook to Bot Migration - Complete Cleanup Checklist

## **Overview**
This document outlines ALL files and code that need to be removed, replaced, or modified when migrating from webhook-based Discord to bot-based Discord.

---

## **Phase 1: Files to REMOVE**

### **Frontend Files**
- [ ] `/src/frontend/screens/discord/discord.tsx` - **REMOVE ENTIRELY**
  - Contains webhook configuration UI
  - Contains voice catalogue posting logic
  - All webhook-specific code
  - Status: DELETE (replace with new bot UI)

- [ ] `/src/frontend/screens/discord/discord.css` - **REMOVE ENTIRELY**
  - Discord screen styling for old webhook UI
  - Status: DELETE (create new discord.css for bot UI)

### **Backend Files**
- [ ] `/src/backend/core/ipc-handlers/discord.ts` - **REMOVE ENTIRELY**
  - Contains webhook POST operations:
    - `discord:test-webhook` handler
    - `discord:generate-voice-catalogue` handler
    - `discord:post-voice-catalogue` handler
    - `discord:delete-message` handler
    - Webhook URL validation
  - Status: DELETE (replace with new discord-bot.ts)

### **Database/Settings References**
- [ ] Old webhook URL storage references
  - Settings key: `discord_settings` (contains webhookUrl)
  - Status: Will be replaced with new `discord_settings` table with bot_token

---

## **Phase 2: Files to MODIFY**

### **Frontend Navigation**
- [ ] `/src/frontend/app.tsx`
  - **Remove:**
    ```tsx
    import { Discord } from './screens/discord/discord';
    ```
  - **Remove:**
    ```tsx
    { id: 'discord', label: 'Discord' },
    ```
    from nav tabs
  - **Remove:**
    ```tsx
    case 'discord':
      return <Discord />;
    ```
    from screen render logic
  - **Add:**
    ```tsx
    import { DiscordBot } from './screens/discord-bot/discord-bot';
    
    { id: 'discord-bot', label: 'Discord Bot' },  // in tabs
    
    case 'discord-bot':
      return <DiscordBot />;  // in render logic
    ```
  - Status: UPDATE

### **Backend IPC Handlers Index**
- [ ] `/src/backend/core/ipc-handlers/index.ts`
  - **Remove:**
    ```ts
    import { setupDiscordHandlers } from './discord';
    ```
  - **Remove:**
    ```ts
    setupDiscordHandlers();
    ```
  - **Add:**
    ```ts
    import { setupDiscordBotHandlers } from './discord-bot';
    setupDiscordBotHandlers();
    ```
  - Status: UPDATE

### **Backend IPC Handlers README**
- [ ] `/src/backend/core/ipc-handlers/README.md`
  - **Remove:** Discord webhook documentation
  - **Add:** Discord bot documentation
  - Status: UPDATE

### **Startup Logic**
- [ ] `/src/backend/core/ipc-handlers/startup.ts`
  - **Remove:**
    ```ts
    // Check if Discord auto-post is enabled
    const discordSettingsStr = settingsRepo.get('discord_settings');
    if (!discordSettingsStr) {
      console.log('[Startup] No Discord settings found, skipping auto-post');
    }
    ```
  - **Add:**
    ```ts
    // Initialize Discord Bot if token is configured
    const discordSettingsStr = settingsRepo.get('discord_settings');
    if (discordSettingsStr) {
      const discordSettings = JSON.parse(discordSettingsStr);
      if (discordSettings.bot_token) {
        console.log('[Startup] Initializing Discord Bot...');
        await ipcRenderer.invoke('discord:start-bot', discordSettings.bot_token);
      }
    }
    ```
  - Status: UPDATE

### **Validation Rules**
- [ ] `/src/shared/validation/validator.ts`
  - **Remove:**
    ```ts
    discordWebhook: [
      { type: 'required', message: 'Discord webhook URL is required' },
      { type: 'pattern', regex: /^https:\/\/discord\.com\/api\/webhooks\/\d+\// }
    ]
    ```
  - **Add:**
    ```ts
    discordBotToken: [
      { type: 'required', message: 'Discord bot token is required' },
      { type: 'pattern', regex: /^[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/ }  // Discord bot token format
    ]
    ```
  - Status: UPDATE

---

## **Phase 3: Files to CREATE**

### **Frontend Components**
- [ ] `/src/frontend/screens/discord-bot/discord-bot.tsx` - **CREATE NEW**
  - Bot configuration UI
  - Status display
  - Token input (with encryption indicator)
  - Test connection button
  - Setup guide integration
  - Feature toggles

- [ ] `/src/frontend/screens/discord-bot/discord-bot.css` - **CREATE NEW**
  - Styling for bot UI
  - Status indicator styles
  - Token input security styling

- [ ] `/src/frontend/screens/discord-bot/DiscordBotSetupGuide.tsx` - **CREATE NEW**
  - 5-step setup guide (following WebSpeechSetupGuide pattern)
  - Step 1: Create Application
  - Step 2: Create Bot User
  - Step 3: Set Permissions
  - Step 4: Invite to Server
  - Step 5: Test Connection

- [ ] `/src/frontend/screens/discord-bot/components/BotTokenInput.tsx` - **CREATE NEW**
  - Secure token input field
  - Show/hide toggle
  - Copy/paste helpers
  - Clear button

- [ ] `/src/frontend/screens/discord-bot/components/BotStatusDisplay.tsx` - **CREATE NEW**
  - Connection status
  - Server info
  - Latency display
  - Uptime

### **Backend Services**
- [ ] `/src/backend/services/discord-bot-client.ts` - **CREATE NEW**
  - Initialize discord.js client
  - Handle bot ready event
  - Handle errors/disconnects

- [ ] `/src/backend/services/discord-commands.ts` - **CREATE NEW**
  - Register slash commands
  - `/findvoice` command
  - `/help` command
  - `/voice-test` command

- [ ] `/src/backend/services/discord-interactions.ts` - **CREATE NEW**
  - Button handlers (pagination, selection)
  - Select menu handlers (filters)
  - Modal handlers (if needed)

- [ ] `/src/backend/services/discord-voice-discovery.ts` - **CREATE NEW**
  - Voice filtering logic (language, gender, provider)
  - Pagination logic
  - Embed generation for bot responses

### **Backend IPC Handlers**
- [ ] `/src/backend/core/ipc-handlers/discord-bot.ts` - **CREATE NEW**
  - Replace entire `/src/backend/core/ipc-handlers/discord.ts`
  - Handlers:
    - `discord:start-bot` - Connect with token
    - `discord:stop-bot` - Disconnect bot
    - `discord:test-connection` - Test bot is working
    - `discord:get-status` - Get bot status

---

## **Phase 4: Database Migration**

### **Old Settings to Remove**
- [ ] `discord_settings` setting key in `app_settings` table
  - Old format: `{ webhookUrl: "...", autoUpdate: true }`
  - Action: DELETE this setting entry

### **New Table to Create**
- [ ] Add new table: `discord_settings`
  ```sql
  CREATE TABLE IF NOT EXISTS discord_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bot_token TEXT,                  -- encrypted
    bot_status TEXT,                 -- 'connected' | 'disconnected'
    bot_id TEXT,                     -- Discord bot user ID
    server_id TEXT,                  -- Guild ID
    channel_id TEXT,                 -- Channel ID for bot messages
    last_connected DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (id = 1)
  );
  ```
  - Action: CREATE (with migration script)

### **Migration Script**
- [ ] Create migration in `database/migrations.ts`
  - Delete old `discord_settings` from `app_settings`
  - Create new `discord_settings` table
  - Set initial status to 'disconnected'

---

## **Phase 5: Package Dependencies**

### **Add New Dependencies**
- [ ] `npm install discord.js@14`
- [ ] Already have: `better-sqlite3`, `electron`, etc.

### **Remove Old Dependencies** (if any)
- None specific to webhooks (no discord.js yet)

---

## **Phase 6: Documentation Updates**

### **Remove Documentation**
- [ ] Delete webhook-specific docs from:
  - IPC handlers README
  - User guides
  - Setup docs

### **Add Documentation**
- [ ] Create Discord bot setup guide
- [ ] Update navigation docs
- [ ] Update IPC handler reference

---

## **Phase 7: Type Definitions**

### **Update Interface Definitions**
- [ ] `/src/shared/types/discord.ts` (if exists)
  - **Remove:**
    ```ts
    interface DiscordWebhookSettings {
      webhookUrl: string;
      autoUpdate: boolean;
    }
    ```
  - **Add:**
    ```ts
    interface DiscordBotSettings {
      botToken: string;
      botStatus: 'connected' | 'disconnected';
      botId?: string;
      serverId?: string;
      channelId?: string;
    }
    ```

---

## **Phase 8: Testing & Verification Checklist**

### **Before Migration**
- [ ] Backup database with webhook settings
- [ ] Document any custom webhook URLs in use
- [ ] Create git branch for this work

### **During Migration**
- [ ] Remove all old files
- [ ] Create all new files
- [ ] Update all references
- [ ] Test compilation (`npm run build`)
- [ ] Test TypeScript errors (`npx tsc --noEmit`)

### **After Migration**
- [ ] Test bot connection with valid token
- [ ] Test bot connection with invalid token (should fail gracefully)
- [ ] Test `/findvoice` command
- [ ] Test `/help` command
- [ ] Test `/voice-test` command
- [ ] Test interactive buttons/dropdowns
- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Verify no webhook references remain
- [ ] Check console for "Discord webhook" logs (should be gone)

### **Final Cleanup**
- [ ] Search codebase for "webhook" (should only find new user-facing docs)
- [ ] Search codebase for "discord:" handlers (should only be new ones)
- [ ] Remove any commented-out webhook code
- [ ] Commit changes with clear message

---

## **Deletion Verification Commands**

Run these after migration to verify cleanup:

```bash
# Check for remaining webhook references
grep -r "webhookUrl" src/
grep -r "discord:post-voice-catalogue" src/
grep -r "discord:test-webhook" src/
grep -r "discord:generate-voice-catalogue" src/

# Check for remaining old discord files
ls -la src/frontend/screens/discord.tsx     # Should NOT exist
ls -la src/backend/core/ipc-handlers/discord.ts  # Should NOT exist

# Check imports still valid
grep -r "from './discord'" src/             # Should be gone or updated
grep -r "import { Discord }" src/frontend/app.tsx  # Should be updated
```

---

## **Rollback Plan**

If something goes wrong:
1. Git history is preserved - can revert commits
2. Database: Old `discord_settings` backed up before migration
3. Restore from git branch if needed

---

## **Summary**

| Category | Count | Action |
|----------|-------|--------|
| Files to DELETE | 3 | Complete removal |
| Files to CREATE | 9 | New implementation |
| Files to MODIFY | 6 | Update imports/logic |
| Database changes | 1 | New table |
| Dependencies | 1 | Add discord.js |

**Total effort:** ~2-3 days of development + testing

