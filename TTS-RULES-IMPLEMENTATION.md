# TTS Rules Configuration - Implementation

## Overview
Made TTS filtering rules configurable through the UI instead of being hardcoded. Users now have full control over message filtering and processing.

## What Changed

### ✅ User-Configurable Rules
All filtering is now controlled by the user through the **TTS Rules** tab:

1. **Filter Commands** - Toggle on/off (default: ON)
   - Skip messages starting with `!` or `~`
   - Examples: `!followage`, `~setmyvoice`

2. **Filter Bot Messages** - Toggle on/off (default: ON)
   - Skip messages from known bots
   - Bots: Nightbot, StreamElements, Streamlabs, Moobot, Fossabot, Wizebot

3. **Remove URLs** - Toggle on/off (default: ON)
   - Strip `http://` and `https://` links from messages
   - Example: "Check out http://test.com" → "Check out"

4. **Announce Username** - Toggle on/off (default: ON)
   - ON: "Username says: message"
   - OFF: "message"

5. **Minimum Message Length** - 0-50 characters (default: 0)
   - Skip messages shorter than this
   - Useful for filtering single-emoji spam

6. **Maximum Message Length** - 50-500 characters (default: 500)
   - Truncate messages longer than this
   - Prevents excessive reading of copypastas

## Database Changes

### New Settings in `tts_settings` table:
```sql
('filter_commands', 'true'),
('filter_bots', 'true'),
('filter_urls', 'true'),
('announce_username', 'true'),
('min_message_length', '0'),
('max_message_length', '500')
```

## Code Changes

### 1. Backend Type Definition (`src/backend/services/tts/base.ts`)
```typescript
export interface TTSSettings {
  enabled: boolean;
  provider: 'webspeech' | 'azure' | 'google';
  voiceId: string;
  volume: number;
  rate: number;
  pitch: number;
  azureApiKey?: string;
  azureRegion?: string;
  googleApiKey?: string;
  // TTS Rules
  filterCommands?: boolean;
  filterBots?: boolean;
  filterUrls?: boolean;
  announceUsername?: boolean;
  minMessageLength?: number;
  maxMessageLength?: number;
}
```

### 2. Frontend Type Definition (`src/frontend/services/tts.ts`)
```typescript
// Same interface as backend
export interface TTSSettings {
  // ... same fields
}
```

### 3. TTS Manager (`src/backend/services/tts/manager.ts`)

**Loading Settings:**
```typescript
private async loadSettings(): Promise<void> {
  const dbSettings = this.repository.getSettings();
  
  this.settings = {
    // ... existing settings
    filterCommands: dbSettings.filter_commands !== undefined ? dbSettings.filter_commands as boolean : true,
    filterBots: dbSettings.filter_bots !== undefined ? dbSettings.filter_bots as boolean : true,
    filterUrls: dbSettings.filter_urls !== undefined ? dbSettings.filter_urls as boolean : true,
    announceUsername: dbSettings.announce_username !== undefined ? dbSettings.announce_username as boolean : true,
    minMessageLength: dbSettings.min_message_length !== undefined ? dbSettings.min_message_length as number : 0,
    maxMessageLength: dbSettings.max_message_length !== undefined ? dbSettings.max_message_length as number : 500,
  };
}
```

**Saving Settings:**
```typescript
async saveSettings(settings: Partial<TTSSettings>): Promise<void> {
  const dbSettings: Record<string, any> = {};
  
  // ... existing settings
  if (settings.filterCommands !== undefined) dbSettings.filter_commands = settings.filterCommands;
  if (settings.filterBots !== undefined) dbSettings.filter_bots = settings.filterBots;
  if (settings.filterUrls !== undefined) dbSettings.filter_urls = settings.filterUrls;
  if (settings.announceUsername !== undefined) dbSettings.announce_username = settings.announceUsername;
  if (settings.minMessageLength !== undefined) dbSettings.min_message_length = settings.minMessageLength;
  if (settings.maxMessageLength !== undefined) dbSettings.max_message_length = settings.maxMessageLength;
  
  this.repository.saveSettings(dbSettings);
  await this.loadSettings();
}
```

**Handling Messages:**
```typescript
async handleChatMessage(username: string, message: string, userId?: string): Promise<void> {
  if (!this.settings || !this.settings.enabled) {
    return; // TTS disabled
  }

  // Check if bot (if filter enabled)
  if (this.settings.filterBots && this.isBot(username)) {
    console.log('[TTS] Skipping bot:', username);
    return;
  }

  // Filter the message
  const filteredMessage = this.filterMessage(message);
  if (!filteredMessage) {
    return; // Message filtered out
  }
  
  // ... queue message
}
```

**Filtering Messages:**
```typescript
private filterMessage(message: string): string | null {
  // Skip empty messages
  if (!message || message.trim().length === 0) {
    return null;
  }

  // Skip commands (starting with ! or ~) if filter enabled
  if (this.settings?.filterCommands && (message.startsWith('!') || message.startsWith('~'))) {
    console.log('[TTS] Skipping command:', message);
    return null;
  }

  let filtered = message.trim();

  // Remove URLs if filter enabled
  if (this.settings?.filterUrls) {
    filtered = filtered.replace(/https?:\/\/\S+/gi, '');
  }

  // Check message length limits
  if (this.settings?.minMessageLength && filtered.length < this.settings.minMessageLength) {
    console.log('[TTS] Message too short:', filtered.length, 'chars');
    return null;
  }

  // Truncate if over max length
  if (this.settings?.maxMessageLength && filtered.length > this.settings.maxMessageLength) {
    console.log('[TTS] Truncating message from', filtered.length, 'to', this.settings.maxMessageLength);
    filtered = filtered.substring(0, this.settings.maxMessageLength);
  }

  // Skip if empty after filtering
  if (filtered.trim().length === 0) {
    return null;
  }

  return filtered.trim();
}
```

**Processing Queue:**
```typescript
private async processQueue(): Promise<void> {
  // ...
  while (this.messageQueue.length > 0) {
    const item = this.messageQueue.shift()!;

    // Format the message with username (if enabled)
    const textToSpeak = this.settings?.announceUsername 
      ? `${item.username} says: ${item.message}`
      : item.message;
    
    // ... speak message
  }
}
```

### 4. Frontend UI (`src/frontend/screens/tts/tts.tsx`)

**TTS Rules Tab:**
```tsx
function renderTTSRulesTab() {
  return (
    <div className="rules-tab">
      <h3>📋 TTS Filtering & Rules</h3>
      
      {/* Message Filtering */}
      <div className="rules-section">
        <h4>🔇 Message Filtering</h4>
        
        {/* Filter Commands */}
        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.filterCommands ?? true}
              onChange={(e) => handleSettingChange('filterCommands', e.target.checked)}
            />
            <span className="checkbox-text">
              Filter Commands
              <span className="setting-hint">
                Skip messages starting with ! or ~ (e.g., !followage, ~setmyvoice)
              </span>
            </span>
          </label>
        </div>
        
        {/* Similar for filterBots, filterUrls */}
      </div>

      {/* Username Announcement */}
      <div className="rules-section">
        <h4>👤 Username Announcement</h4>
        
        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.announceUsername ?? true}
              onChange={(e) => handleSettingChange('announceUsername', e.target.checked)}
            />
            <span className="checkbox-text">
              Announce Username
              <span className="setting-hint">
                Say "Username says:" before each message
              </span>
            </span>
          </label>
        </div>

        {/* Live Example */}
        <div className="example-box">
          <strong>Example:</strong>
          <div className="example-text">
            {settings.announceUsername ?? true
              ? '🔊 "ViewerName says: Hello everyone!"'
              : '🔊 "Hello everyone!"'}
          </div>
        </div>
      </div>

      {/* Message Length Limits */}
      <div className="rules-section">
        <h4>📏 Message Length Limits</h4>
        
        {/* Min Length Slider */}
        <div className="setting-group">
          <label className="setting-label">
            Minimum Length: {settings.minMessageLength ?? 0} characters
          </label>
          <input
            type="range"
            min="0"
            max="50"
            value={settings.minMessageLength ?? 0}
            onChange={(e) => handleSettingChange('minMessageLength', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Skip messages shorter than this. Set to 0 to disable.
          </p>
        </div>

        {/* Max Length Slider */}
        <div className="setting-group">
          <label className="setting-label">
            Maximum Length: {settings.maxMessageLength ?? 500} characters
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={settings.maxMessageLength ?? 500}
            onChange={(e) => handleSettingChange('maxMessageLength', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Truncate messages longer than this.
          </p>
        </div>
      </div>
    </div>
  );
}
```

## UI Screenshots (Conceptual)

### TTS Rules Tab Layout:

```
┌─────────────────────────────────────────────────────────┐
│ 📋 TTS Filtering & Rules                                │
│ Control which messages are read aloud                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ 🔇 Message Filtering ──────────────────────────────┐ │
│ │                                                      │ │
│ │ ☑ Filter Commands                                   │ │
│ │   Skip messages starting with ! or ~                │ │
│ │                                                      │ │
│ │ ☑ Filter Bot Messages                               │ │
│ │   Skip messages from Nightbot, StreamElements...    │ │
│ │                                                      │ │
│ │ ☑ Remove URLs                                        │ │
│ │   Strip http:// and https:// links                  │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 👤 Username Announcement ─────────────────────────┐  │
│ │                                                      │ │
│ │ ☑ Announce Username                                 │ │
│ │   Say "Username says:" before each message          │ │
│ │                                                      │ │
│ │ Example:                                             │ │
│ │ 🔊 "ViewerName says: Hello everyone!"              │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 📏 Message Length Limits ─────────────────────────┐  │
│ │                                                      │ │
│ │ Minimum Length: 0 characters                         │ │
│ │ [────────────────────────────────────────]          │ │
│ │                                                      │ │
│ │ Maximum Length: 500 characters                       │ │
│ │ [────────────────────────────────────────]          │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ ✨ Coming Soon ────────────────────────────────────┐ │
│ │ • Per-viewer voice assignments                       │ │
│ │ • Chat command: ~setmyvoice [voice_id]              │ │
│ │ • Muted viewers list                                 │ │
│ │ • Emoji/emote filtering                              │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Testing Guide

### Test Each Rule

1. **Filter Commands**
   - ✅ ON: `!followage` → Not spoken
   - ❌ OFF: `!followage` → Spoken as "Username says: !followage"

2. **Filter Bots**
   - ✅ ON: Nightbot message → Not spoken
   - ❌ OFF: Nightbot message → Spoken

3. **Remove URLs**
   - ✅ ON: "Check http://test.com" → Spoken as "Check"
   - ❌ OFF: "Check http://test.com" → Spoken as "Check http://test.com"

4. **Announce Username**
   - ✅ ON: "Hello" → Spoken as "Username says: Hello"
   - ❌ OFF: "Hello" → Spoken as "Hello"

5. **Min Length (set to 5)**
   - Message "Hi" (2 chars) → Not spoken
   - Message "Hello" (5 chars) → Spoken

6. **Max Length (set to 20)**
   - Message "This is a very long message that exceeds the limit" → Truncated to "This is a very long "

## Console Output Examples

### With URL Filtering ON:
```
[IRC] Message from eggiebert: Http://test.com
[TTS] Speaking: eggiebert says:
(Empty after filtering - not spoken)

[IRC] Message from eggiebert: this site http://test.com
[TTS] Speaking: eggiebert says: this site
```

### With Command Filtering ON:
```
[IRC] Message from viewer: !followage
[TTS] Skipping command: !followage
```

### With Bot Filtering ON:
```
[IRC] Message from nightbot: User has been here for 5 days
[TTS] Skipping bot: nightbot
```

### With Username Announcement OFF:
```
[IRC] Message from viewer: Hello everyone!
[TTS] Speaking: Hello everyone!
```

## Benefits

### ✅ User Control
- Users can customize filtering to their preference
- No need to modify code for different use cases
- Settings persist in database

### ✅ Flexibility
- Turn off URL filtering if you want URLs spoken
- Disable username announcement for cleaner audio
- Adjust length limits for your audience

### ✅ Future-Proof
- Architecture ready for more advanced rules
- Easy to add new filter options
- Maintains backward compatibility

## Future Enhancements

Still to come in TTS Rules tab:
- 📝 Per-viewer voice assignments
- 🎤 `~setmyvoice` command for viewers
- 🔇 Muted viewers list
- 😀 Emoji/emote filtering and limits
- 🔁 Duplicate message detection
- 👑 Role-based voice rules (subscribers, mods, VIPs)
- ⏱️ Rate limiting per user
- ⭐ Priority queue for specific users

## Summary

🎉 **You're now in full control!**

All the hardcoded filtering rules are now configurable through the UI. Toggle features on/off, adjust length limits, and customize the TTS experience exactly how you want it.

Navigate to: **TTS Screen → TTS Rules Tab** to configure all settings.
