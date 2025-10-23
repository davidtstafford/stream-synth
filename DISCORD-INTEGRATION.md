# Discord Integration

## Overview
Discord webhook integration for posting TTS voice catalogues and future stream notifications.

## Features Implemented

### 1. Discord Screen (Frontend)
**Location:** `src/frontend/screens/discord/discord.tsx`

**Tabs:**
- **Voice Catalogue** - Post voice list to Discord via webhook
  - Webhook URL configuration
  - Voice count display (157 voices)
  - Live preview of catalogue formatting
  - Test webhook connection
  - Post catalogue to Discord channel
  
- **Notifications** (Placeholder) - Future go-live alerts
  - Coming soon

**State Management:**
- Settings: `webhookUrl`, `notificationsEnabled`
- UI: `loading`, `error`, `success`, `posting`
- Data: `voiceCount`, `cataloguePreview`

### 2. Discord Styling
**Location:** `src/frontend/screens/discord/discord.css`

**Theme:**
- Discord blurple accent: `#5865F2`
- Dark theme matching app
- Tab navigation (consistent with TTS screen)
- Info boxes, webhook inputs, preview sections
- Success/error message styling

### 3. Navigation Integration
**Location:** `src/frontend/app.tsx`

**Changes:**
- Added Discord import: `import { Discord } from './screens/discord/discord';`
- Added to menu: `{ id: 'discord', label: 'Discord' }`
- Added to routing: `case 'discord': return <Discord />;`

### 4. Backend IPC Handlers
**Location:** `src/backend/core/ipc-handlers.ts`

**Handlers Added:**

#### `discord:test-webhook`
Tests webhook connection by sending a simple message.
```typescript
Input: webhookUrl (string)
Output: { success: boolean, error?: string }
```

#### `discord:generate-voice-catalogue`
Generates formatted text preview of voice catalogue.
```typescript
Output: { success: boolean, catalogue: string, error?: string }
```
Format:
```
🎤 TTS Voice Catalogue (157 voices available)

Use the command: `~setmyvoice <ID>` to select your voice
Example: `~setmyvoice 22` for Eddy

**English** (United States)
`001` │ Aaron ♂️
`022` │ Eddy ♂️
`023` │ Flo ♀️
...
```

#### `discord:post-voice-catalogue`
Posts voice catalogue to Discord as a rich embed.
```typescript
Input: webhookUrl (string)
Output: { success: boolean, error?: string }
```
Embed Features:
- Title: "🎤 TTS Voice Catalogue"
- Description: Usage instructions
- Fields: Language groups with voice listings
- Color: Discord blurple (#5865F2)
- Footer: "Stream Synth • Voice IDs are permanent"
- Timestamp: Current time

## Voice Catalogue Format

### Database Structure
- **157 total voices** from macOS Web Speech API
- Categorized by: Provider → Source → Language → Region
- Each voice has a stable **numeric ID** (1-157)
- Properties: name, gender, language, region, provider, source

### Display Format
```
ID  │ Name (Region) Gender
022 │ Eddy (United States) ♂️
```

### Discord Embed Groups
Voices grouped by language and region:
- **English (United States)** - 48 voices
- **English (United Kingdom)** - 12 voices
- **Arabic (Saudi Arabia)** - 3 voices
- etc.

## Usage Flow

1. **Navigate to Discord screen** - Click "Discord" in sidebar
2. **Configure webhook** - Enter Discord webhook URL
3. **Test connection** - Click "Test Webhook" to verify
4. **Preview catalogue** - Click "Generate Preview" to see formatting
5. **Post to Discord** - Click "Post Catalogue" to send to channel

## Technical Details

### Webhook Format
Discord webhooks accept POST requests with JSON body:
```json
{
  "content": "Simple text message",
  "embeds": [{
    "title": "Embed title",
    "description": "Embed description",
    "color": 5814034,
    "fields": [...]
  }]
}
```

### Error Handling
- Invalid webhook URL → Error message displayed
- Network errors → Error message with details
- Discord API errors → Status code + response text
- Database errors → Console logging + error message

### Voice Synchronization
- Voices synced on TTS screen load
- Database stores all voice metadata
- Numeric IDs are permanent and stable
- ~setmyvoice command uses numeric IDs

## Future Enhancements

### Notifications Tab
- Go-live alerts via Discord webhook
- Raid notifications
- Follower milestones
- Custom event notifications

### Voice Catalogue Features
- Schedule automatic updates (daily/weekly)
- Multiple webhook support (different channels)
- Customizable embed formatting
- Filter by language/gender

## Testing Checklist

- [x] Discord screen added to navigation
- [x] Tab switching works
- [x] Webhook URL saves to settings
- [ ] Test webhook sends message successfully
- [ ] Preview shows correct voice count
- [ ] Preview shows proper formatting
- [ ] Post to Discord creates rich embed
- [ ] Embed shows all language groups
- [ ] Voice IDs are correctly formatted (001-157)
- [ ] Gender symbols display correctly (♂️♀️⚧)
- [ ] Error messages show for invalid webhooks
- [ ] Success messages show after posting

## Commands

### User Commands
- `~setmyvoice <ID>` - Set TTS voice by numeric ID
- Example: `~setmyvoice 22` - Set voice to Eddy

### Discord Webhook Setup
1. Go to Discord server settings
2. Navigate to Integrations → Webhooks
3. Click "New Webhook"
4. Configure name, channel, avatar
5. Copy webhook URL
6. Paste into Stream Synth Discord screen

## Dependencies
- Electron IPC (main ↔ renderer communication)
- Fetch API (webhook HTTP requests)
- SQLite database (voice storage)
- React (frontend UI)
- TypeScript (type safety)

## Related Files
- `src/backend/database/repositories/voices.ts` - Voice database operations
- `src/backend/services/tts/voice-sync.ts` - Voice synchronization
- `src/backend/services/tts/voice-parser.ts` - Voice metadata parsing
- `src/frontend/screens/tts/tts.tsx` - TTS configuration screen
- `src/shared/types/tts.ts` - TTS type definitions
