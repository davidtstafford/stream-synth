# Discord Auto-Post Feature

## Overview
Automatically update the Discord voice catalogue when the app starts, ensuring your Discord channel always has the latest available voices.

## Features

### 1. Auto-Update on Startup Checkbox
**Location:** Discord Screen → Voice Catalogue Tab

**Setting:**
- `🔄 Auto-update on startup` - Checkbox toggle
- Saves to `discord_settings.autoPostOnStartup` in database

**Description:**
When enabled, the app will:
1. Delete all previous webhook messages
2. Post an updated voice catalogue with current voices
3. Happens automatically when the app starts

### 2. Automatic Message Cleanup
Before posting the new catalogue, the app:
- Fetches all existing messages from the webhook
- Deletes them one by one (with rate limiting)
- Ensures your Discord channel only shows the latest voice list

### 3. Updated Voice Catalogue
The auto-posted catalogue:
- Shows all currently available voices
- Includes stable numeric IDs
- Organized by language and region
- Displays gender symbols (♂️♀️⚧)
- Footer notes "Auto-updated on startup"

## Technical Implementation

### Frontend Changes
**File:** `src/frontend/screens/discord/discord.tsx`

**Interface Update:**
```typescript
interface DiscordSettings {
  webhookUrl?: string;
  autoPostOnStartup: boolean;  // NEW
  notificationsEnabled: boolean;
  goLiveWebhookUrl?: string;
  mentionRole?: string;
}
```

**UI Component:**
```tsx
<div className="setting-group">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={settings.autoPostOnStartup}
      onChange={(e) => saveSetting('autoPostOnStartup', e.target.checked)}
    />
    <span>🔄 Auto-update on startup</span>
  </label>
  <p className="setting-hint">
    When enabled, the app will delete previous webhook messages and 
    automatically post an updated voice catalogue on startup.
    This keeps your Discord channel current with the latest available voices.
  </p>
</div>
```

**CSS:** `src/frontend/screens/discord/discord.css`
- Added `.checkbox-label` styling
- Discord blurple accent color (#5865F2)
- Checkbox sizing and cursor styles

### Backend Changes

#### 1. IPC Handlers
**File:** `src/backend/core/ipc-handlers.ts`

**New Handlers:**

##### `discord:delete-webhook-messages`
Deletes all messages posted by the webhook.

**Process:**
1. Extract webhook ID and token from URL
2. Fetch all messages from webhook endpoint
3. Delete each message individually
4. Rate limit: 100ms delay between deletions

**Returns:**
```typescript
{
  success: boolean;
  deletedCount: number;
  totalMessages: number;
  error?: string;
}
```

##### `discord:auto-update-catalogue`
Combined operation: delete old + post new.

**Process:**
1. Delete previous messages
2. Wait 500ms for Discord API
3. Generate voice catalogue embed
4. Post to webhook
5. Mark as "Auto-updated" in footer

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

#### 2. Startup Tasks
**File:** `src/backend/main.ts`

**Implementation:**
```typescript
mainWindow.webContents.on('did-finish-load', () => {
  runStartupTasks();
});
```

**Function:** `runStartupTasks()`
**File:** `src/backend/core/ipc-handlers.ts`

**Process:**
1. Load Discord settings from database
2. Check if `autoPostOnStartup` is enabled
3. Check if webhook URL is configured
4. Wait 2 seconds for full initialization
5. Delete all existing webhook messages
6. Post new voice catalogue
7. Log success/errors to console

## Usage Instructions

### Setup
1. **Navigate to Discord screen** in Stream Synth
2. **Enter webhook URL** in the input field
3. **Test webhook** to verify connection
4. **Enable auto-update** by checking the checkbox
5. **Restart the app** to see it in action

### Testing
1. Post a voice catalogue manually
2. Enable auto-update checkbox
3. Close and restart Stream Synth
4. Check Discord channel - old message deleted, new one posted

### Disabling
Simply uncheck the "Auto-update on startup" checkbox.
The setting saves immediately.

## Discord API Details

### Webhook Message Management

**Get Messages:**
```
GET /webhooks/{webhook.id}/{webhook.token}/messages
```

**Delete Message:**
```
DELETE /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}
```

**Post Message:**
```
POST /webhooks/{webhook.id}/{webhook.token}
Body: { embeds: [...] }
```

### Rate Limiting
- **Message Deletion:** 100ms delay between operations
- **Startup Wait:** 2 seconds before starting
- **Between Delete/Post:** 500ms delay

### Error Handling
- Invalid webhook URL → Skip auto-post
- Network errors → Log and continue
- Delete failures → Log but continue to post
- API errors → Log with status code

## Benefits

### For Streamers
- ✅ Always up-to-date voice list in Discord
- ✅ No manual posting required
- ✅ Clean Discord channel (only one message)
- ✅ Automatic after voice changes
- ✅ Viewer convenience

### For Viewers
- ✅ Current voice list always available
- ✅ Easy to reference IDs for ~setmyvoice command
- ✅ See latest voices added to system
- ✅ Single message to bookmark

## Logging

### Console Output
All operations log to backend console:
- `[Startup] Running startup tasks...`
- `[Startup] Discord auto-post enabled, updating voice catalogue...`
- `[Startup] Found X messages to delete`
- `[Startup] Discord voice catalogue auto-posted successfully`

### Error Logging
- `[Startup] No Discord settings found, skipping auto-post`
- `[Startup] Discord auto-post not enabled or no webhook URL`
- `[Startup] Error deleting message: ...`
- `[Startup] Error in startup tasks: ...`

## Future Enhancements

### Potential Features
- **Schedule updates** - Hourly/daily automatic updates
- **Change detection** - Only post if voices changed
- **Multiple webhooks** - Different channels for different purposes
- **Message history** - Keep last N messages instead of deleting all
- **Custom messages** - Add custom text before/after catalogue
- **Voice count alerts** - Notify when new voices added

### Integration Ideas
- **Voice sync** - Auto-sync voices on startup too
- **Status updates** - Post stream status changes
- **Command help** - Auto-post command list
- **Stats** - Post voice usage statistics

## Configuration

### Settings Storage
**Database:** SQLite
**Table:** `settings`
**Key:** `discord_settings`

**Value Format:**
```json
{
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "autoPostOnStartup": true,
  "notificationsEnabled": false,
  "goLiveWebhookUrl": "",
  "mentionRole": ""
}
```

## Troubleshooting

### Auto-post not working
1. Check if checkbox is enabled
2. Verify webhook URL is valid
3. Check console logs for errors
4. Test webhook manually first
5. Check Discord webhook permissions

### Messages not deleted
1. Webhook might not have permission
2. Messages might be from different webhook
3. Check console for delete errors
4. Verify webhook URL format

### Rate limiting errors
- Discord may temporarily block requests
- Wait a few minutes and restart
- Check Discord API status

## Security Notes

### Webhook URL
- Contains webhook token - keep private!
- Anyone with URL can post to channel
- Stored in database (user-only access)
- Not logged or transmitted elsewhere

### Best Practices
- Use dedicated channel for voice catalogue
- Restrict webhook to specific channel
- Regenerate webhook if compromised
- Don't share webhook URL publicly
