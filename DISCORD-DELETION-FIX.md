# Discord Message Deletion - How It Works

## Problem
Discord webhooks cannot list their own messages through the API. The only way to delete a webhook's messages is if you know the **message ID** of each message you want to delete.

## Solution
**Store the message ID when we post**, then use it to delete the message on the next startup/post.

## Implementation

### 1. Store Message ID After Posting

When a message is posted (manually or on startup), Discord returns the message data including its ID:

```typescript
const response = await fetch(webhookUrl, {
  method: 'POST',
  body: JSON.stringify({ embeds: [embed] })
});

const messageData = await response.json();
// messageData.id contains the Discord message ID (snowflake)
```

We save this ID to settings:
```typescript
discordSettings.lastMessageId = messageData.id;
settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
```

### 2. Delete Previous Message on Next Startup

When the app starts and auto-post is enabled:

```typescript
// Check if we have a previous message ID
if (discordSettings.lastMessageId) {
  // Delete using webhook ID, token, and message ID
  const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${discordSettings.lastMessageId}`;
  await fetch(deleteUrl, { method: 'DELETE' });
}
```

### 3. Post New Message

After deletion, post the new voice catalogue and save the new message ID for the next cycle.

## Flow Diagram

```
First Post:
┌─────────────────────────────────────────┐
│ 1. User posts voice catalogue           │
│ 2. Discord returns message ID: 12345    │
│ 3. Save 12345 to discord_settings       │
└─────────────────────────────────────────┘

Second Post (Startup):
┌─────────────────────────────────────────┐
│ 1. App starts, auto-post enabled        │
│ 2. Load discord_settings                │
│ 3. Found lastMessageId: 12345           │
│ 4. DELETE message 12345                 │
│ 5. Post new catalogue                   │
│ 6. Discord returns new ID: 67890        │
│ 7. Save 67890 to discord_settings       │
└─────────────────────────────────────────┘

Third Post (Startup):
┌─────────────────────────────────────────┐
│ 1. App starts, auto-post enabled        │
│ 2. Load discord_settings                │
│ 3. Found lastMessageId: 67890           │
│ 4. DELETE message 67890                 │
│ 5. Post new catalogue                   │
│ 6. Save new message ID...               │
└─────────────────────────────────────────┘
```

## Settings Structure

```typescript
interface DiscordSettings {
  webhookUrl: string;           // Discord webhook URL
  autoPostOnStartup: boolean;   // Enable auto-post on startup
  lastMessageId?: string;       // Snowflake ID of last posted message
  notificationsEnabled: boolean;
  goLiveWebhookUrl?: string;
  mentionRole?: string;
}
```

**Stored in:** SQLite database, `settings` table, key `discord_settings`

## Discord API Endpoints

### Post Message (with wait for response)
```
POST /webhooks/{webhook.id}/{webhook.token}?wait=true
```
- `wait=true` makes Discord return the created message data
- Response includes `id` field with message snowflake

### Delete Message
```
DELETE /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}
```
- Only works for messages posted by this webhook
- Returns 204 No Content on success
- Returns 404 if message already deleted

## Testing Steps

### First Time Setup
1. ✅ Post a voice catalogue manually (from Discord screen)
2. ✅ Check database - `lastMessageId` should be saved
3. ✅ Check Discord - message appears

### Test Auto-Delete
1. ✅ Enable "Auto-update on startup" checkbox
2. ✅ Close and restart the app
3. ✅ Check console logs:
   - `[Startup] Discord auto-post enabled`
   - `[Startup] Deleting previous message: [ID]`
   - `[Startup] Successfully deleted previous message`
   - `[Startup] Posted message ID: [NEW_ID]`
4. ✅ Check Discord - old message deleted, new one posted

### Verify Message ID Storage
1. ✅ Open database with SQLite browser
2. ✅ Query: `SELECT * FROM settings WHERE key = 'discord_settings'`
3. ✅ Check JSON contains `lastMessageId` field
4. ✅ Match ID with Discord message (right-click → Copy ID)

## Advantages of This Approach

### ✅ Reliable
- Only deletes messages we posted
- No risk of deleting other messages
- Works with Discord API limitations

### ✅ Efficient
- Single DELETE request per startup
- No need to fetch message lists
- Immediate deletion

### ✅ Clean
- Only one voice catalogue message in Discord
- Automatically updates on restart
- No manual cleanup needed

## Limitations

### Only Deletes Last Message
- If user posts multiple times manually, only last one is deleted
- Previous messages remain until manually deleted
- **Solution:** Don't post manually if auto-post is enabled

### Requires Message ID
- First post has nothing to delete (no previous ID)
- If user deletes settings, loses message ID
- **Solution:** Accept first message stays, clean start

### Can't Delete Other Bot Messages
- Only deletes messages from this specific webhook
- Can't delete messages from other bots/users
- **Solution:** Use dedicated channel for voice catalogue

## Error Handling

### Message Already Deleted (404)
```typescript
if (deleteResponse.ok || deleteResponse.status === 404) {
  console.log('Successfully deleted or already gone');
}
```

### Invalid Message ID
```typescript
if (!discordSettings.lastMessageId) {
  console.log('No previous message ID, skipping deletion');
}
```

### Network Errors
```typescript
try {
  await fetch(deleteUrl, { method: 'DELETE' });
} catch (err) {
  console.error('Delete failed, continuing with post');
}
```

## Console Logging

### Successful Flow
```
[Startup] Running startup tasks...
[Startup] Discord auto-post enabled, updating voice catalogue...
[Startup] Webhook ID: 1234567890
[Startup] Deleting previous message: 1234567890123456789
[Startup] Successfully deleted previous message
[Startup] Posted message ID: 9876543210987654321
[Startup] Saved message ID for future deletion
[Startup] Discord voice catalogue auto-posted successfully
```

### First Run (No Previous Message)
```
[Startup] Running startup tasks...
[Startup] Discord auto-post enabled, updating voice catalogue...
[Startup] Webhook ID: 1234567890
[Startup] No previous message ID stored, skipping deletion
[Startup] Posted message ID: 9876543210987654321
[Startup] Saved message ID for future deletion
[Startup] Discord voice catalogue auto-posted successfully
```

## Future Enhancements

### Track Multiple Messages
Store array of message IDs to delete multiple messages:
```typescript
lastMessageIds: string[]  // Array of IDs
```

### Expiry Time
Auto-delete messages older than X days:
```typescript
messageExpiry: number  // Timestamp
```

### Manual Delete Button
Add UI button to delete current message:
```typescript
<button onClick={deleteCurrentMessage}>
  🗑️ Delete Current Catalogue
</button>
```

### History Log
Keep history of posted messages:
```typescript
messageHistory: Array<{
  id: string;
  timestamp: number;
  voiceCount: number;
}>
```

## Summary

The fix works by:
1. **Saving the message ID** when posting
2. **Loading the ID** on next startup
3. **Deleting using the ID** before posting new message
4. **Saving the new ID** for next time

This creates a self-cleaning cycle where each startup removes the previous message and posts a fresh one, keeping your Discord channel tidy with just one up-to-date voice catalogue message.
