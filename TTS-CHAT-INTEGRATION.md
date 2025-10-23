# TTS Chat Integration - Implementation

## Overview
Integrated Text-to-Speech with Twitch chat messages. When TTS is enabled, chat messages are automatically spoken using the selected voice.

## Features Implemented

### 1. Message Queue System
- **Queue management** - Messages are queued and spoken one at a time
- **Async processing** - Non-blocking queue processing
- **Timing estimation** - Calculates speaking time based on word count and rate
- **Graceful handling** - Errors don't crash the queue

### 2. Message Filtering
Built-in filters to skip unwanted messages:
- ✅ **Commands** - Skip messages starting with `!` or `~`
- ✅ **Bot messages** - Skip common bot names (nightbot, streamelements, etc.)
- ✅ **URLs** - Strip URLs from messages
- ✅ **Empty messages** - Skip empty or whitespace-only messages
- ✅ **Filtered content** - Skip messages that become empty after filtering

### 3. IRC Integration
- **Message listener** - Captures all chat messages via IRC
- **User info** - Includes username and user ID
- **Event handling** - Non-blocking event processing
- **Error recovery** - Failures don't break chat connection

### 4. Web Speech API Integration
- **Backend → Renderer communication** - Backend sends messages to renderer
- **Voice selection** - Uses currently selected voice from settings
- **Volume/Rate/Pitch** - Applies all voice settings
- **Cross-platform** - Works on macOS, Windows, Linux

### 5. Username Announcement
Messages are formatted as:
```
"Username says: message text here"
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Twitch IRC                            │
│                  (chat messages)                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ chat.message event
                     ▼
┌─────────────────────────────────────────────────────────┐
│           IRC Service (twitch-irc.ts)                    │
│         - Emits chat.message events                      │
│         - Includes username, message, userId             │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ event
                     ▼
┌─────────────────────────────────────────────────────────┐
│          IPC Handlers (ipc-handlers.ts)                  │
│         - Listens to chat.message                        │
│         - Calls ttsManager.handleChatMessage()           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ handleChatMessage()
                     ▼
┌─────────────────────────────────────────────────────────┐
│            TTS Manager (manager.ts)                      │
│         - Filters message                                │
│         - Checks if bot/command                          │
│         - Adds to queue                                  │
│         - Processes queue sequentially                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ IPC: tts:speak
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend App (app.tsx)                      │
│         - Listens to tts:speak                           │
│         - Uses Web Speech API                            │
│         - Applies voice/volume/rate/pitch                │
│         - Speaks message                                 │
└─────────────────────────────────────────────────────────┘
                     │
                     │ Audio output
                     ▼
              ┌──────────────┐
              │   Speakers   │
              │  (& OBS)     │
              └──────────────┘
```

## Code Changes

### 1. IRC Service (`src/backend/services/twitch-irc.ts`)
**Added message event listener:**
```typescript
this.client.on('message', (channel, userstate, message, self) => {
  if (self) return;
  
  const event: IRCChatEvent = {
    type: 'irc.chat.message',
    channel: channel.replace('#', ''),
    username: userstate.username || userstate['display-name'],
    userId: userstate['user-id'],
    message,
    timestamp: new Date().toISOString(),
  };
  
  this.emit('chat.message', event);
});
```

### 2. TTS Manager (`src/backend/services/tts/manager.ts`)
**Added queue and filtering:**
```typescript
private messageQueue: TTSQueueItem[] = [];
private isProcessing: boolean = false;
private mainWindow: Electron.BrowserWindow | null = null;

async handleChatMessage(username: string, message: string, userId?: string) {
  // Filter message
  const filtered = this.filterMessage(message);
  if (!filtered) return;
  
  // Check if bot
  if (this.isBot(username)) return;
  
  // Add to queue
  this.messageQueue.push({
    username,
    message: filtered,
    voiceId: this.settings.voiceId,
    timestamp: new Date().toISOString()
  });
  
  // Process
  this.processQueue();
}
```

### 3. IPC Handlers (`src/backend/core/ipc-handlers.ts`)
**Added chat message listener:**
```typescript
twitchIRCService.on('chat.message', async (event: any) => {
  try {
    const manager = await initializeTTS();
    await manager.handleChatMessage(event.username, event.message, event.userId);
  } catch (error) {
    console.error('[TTS] Error handling chat message:', error);
  }
});
```

### 4. Frontend App (`src/frontend/app.tsx`)
**Added TTS renderer:**
```typescript
useEffect(() => {
  const handleTTSSpeak = (event: any, data: any) => {
    const { text, voiceId, volume, rate, pitch } = data;
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.voiceURI === voiceId || v.name === voiceId);
    
    if (voice) utterance.voice = voice;
    utterance.volume = volume / 100;
    utterance.rate = rate;
    utterance.pitch = pitch;
    
    window.speechSynthesis.speak(utterance);
  };

  ipcRenderer.on('tts:speak', handleTTSSpeak);
  return () => ipcRenderer.removeListener('tts:speak', handleTTSSpeak);
}, []);
```

## Message Filtering Details

### Commands Filter
Skips messages starting with:
- `!` - Twitch commands (e.g., !followage)
- `~` - Custom commands (e.g., ~setmyvoice)

### Bot Filter
Skips messages from these bots:
- nightbot
- streamelements
- streamlabs
- moobot
- fossabot
- wizebot

### URL Filter
Removes patterns matching:
- `http://...`
- `https://...`

### Empty Message Filter
Skips messages that are:
- Empty string
- Only whitespace
- Become empty after filtering

## Queue Processing

### Sequential Processing
1. Check if already processing (skip if true)
2. Check if queue empty (exit if true)
3. Shift first message from queue
4. Check if bot username (skip if true)
5. Format message: `"Username says: message"`
6. Send to Web Speech API (via IPC)
7. Wait for estimated speaking time
8. Add 500ms delay
9. Process next message

### Speaking Time Estimation
```typescript
const wordsPerMinute = 150 * (rate || 1.0);
const words = text.split(' ').length;
const estimatedMs = (words / wordsPerMinute) * 60 * 1000;
```

Example: "Hello world" at 1.0x rate = 2 words @ 150 wpm = 800ms

## Testing

### Enable TTS
1. Navigate to TTS screen
2. Enable "Text-to-Speech Enabled" toggle
3. Select a voice
4. Adjust volume/rate/pitch as desired

### Test Chat Messages
1. Connect to IRC (Connection screen)
2. Have someone send a message in chat
3. Message should be spoken: "Username says: message text"

### What Gets Spoken
✅ Regular chat messages
✅ Emotes (as text)
✅ Emoji (as text)

### What Gets Filtered
❌ Commands (`!followage`, `~setmyvoice`)
❌ Bot messages (nightbot, streamelements, etc.)
❌ Empty messages
❌ URLs stripped from message

### Example Console Output
```
[IRC] Message from testuser: Hello everyone!
[TTS] Speaking: testuser says: Hello everyone!
[TTS Renderer] Speaking: testuser says: Hello everyone! with voice: Eddy

[IRC] Message from nightbot: @user has been here for 5 days
[TTS] Skipping bot: nightbot

[IRC] Message from viewer: !followage
[TTS] Skipping command: !followage

[IRC] Message from viewer: Check out https://example.com
[TTS] Speaking: viewer says: Check out
```

## Future Enhancements

### Phase 2 (Next)
- **Per-viewer voices** - Each viewer can have their own voice
- **`~setmyvoice` command** - Viewers choose their voice
- **Mute list** - Skip messages from specific users
- **TTS Rules UI** - Configure filters in UI

### Phase 3 (Later)
- **Emote filtering** - Remove excessive emotes/emojis
- **Message length limits** - Truncate long messages
- **Duplicate detection** - Skip repeated messages
- **Volume ducking** - Lower volume when speaking
- **Audio output to OBS** - Browser source for OBS capture

### Phase 4 (Future)
- **Azure TTS integration** - Cloud voices
- **Google TTS integration** - Cloud voices
- **Voice cloning** - ElevenLabs integration
- **SSML support** - Advanced voice control
- **Pronunciation dictionary** - Custom word pronunciations

## Configuration

### Current Settings (TTS Screen)
- **Enable TTS** - Global on/off
- **Voice Selection** - Choose from 157 voices
- **Volume** - 0-100%
- **Rate** - 0.5x - 2.0x speed
- **Pitch** - 0.5x - 2.0x

### Future Settings (TTS Rules Tab)
- Min/max message length
- Emote/emoji limits
- Mute list
- Allowed/blocked words
- Rate limiting per user
- Priority users

## Known Limitations

### Web Speech API
- **Platform dependent** - Voice availability varies by OS
- **No audio stream** - Can't directly route to OBS
- **Timing estimates** - Approximate, not exact
- **No queuing control** - Browser handles the queue

### Current Implementation
- **No per-viewer voices** - All use default voice
- **Basic filtering** - Limited filter options
- **No volume ducking** - Speaks at full volume
- **No OBS integration** - Audio goes to system output

### Workarounds
- Use virtual audio cables for OBS capture
- Configure system audio routing
- Use Azure/Google TTS for more control (future)

## Troubleshooting

### TTS Not Speaking
1. Check TTS is enabled (TTS screen)
2. Check voice is selected
3. Check volume is not 0
4. Check IRC is connected
5. Check console for errors

### Bot Messages Still Speaking
- Add bot name to bot filter list in `manager.ts`

### Commands Being Spoken
- Check they start with `!` or `~`

### Messages Cut Off
- Queue timing might be too short
- Adjust estimation in `processQueue()`

## Summary

✅ **Implemented:** Basic TTS integration with chat
✅ **Working:** Messages are spoken with selected voice
✅ **Filtering:** Commands, bots, URLs filtered out
✅ **Queue:** Messages processed sequentially
✅ **Settings:** Voice/volume/rate/pitch applied

⏳ **Next:** Per-viewer voices, mute list, TTS rules UI
🔮 **Future:** Azure/Google TTS, OBS integration, advanced filtering

The foundation is solid and extensible. Ready for the next phase!
