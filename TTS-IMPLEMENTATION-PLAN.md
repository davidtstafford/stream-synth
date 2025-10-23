# TTS Implementation Plan

## Multi-Provider Text-to-Speech System

### Providers
1. **Web Speech API** (Browser-based, free, unlimited)
   - Windows: Microsoft voices
   - macOS: Apple voices
   - No API key needed
   - ~40+ voices depending on OS

2. **Azure TTS** (5M chars/month free, perpetual)
   - 300+ neural voices
   - Requires API key + region
   - Best free tier

3. **Google Cloud TTS** (1M chars/month free, perpetual)
   - 380+ WaveNet/Neural2 voices
   - Requires API key
   - Backup option

---

## Phase 1: Database Schema

### New Table: `tts_settings`
```sql
CREATE TABLE tts_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);
```

**Settings to store:**
- `tts_enabled` - Global TTS on/off
- `tts_provider` - 'webspeech' | 'azure' | 'google'
- `tts_voice_id` - Selected voice ID
- `tts_volume` - 0-100
- `tts_rate` - Speech rate (0.5-2.0)
- `tts_pitch` - Pitch (0.5-2.0)
- `azure_api_key` - Encrypted Azure key
- `azure_region` - e.g., 'eastus'
- `google_api_key` - Encrypted Google key

### Extend `viewers` table:
```sql
ALTER TABLE viewers ADD COLUMN tts_voice_id TEXT;
ALTER TABLE viewers ADD COLUMN tts_enabled INTEGER DEFAULT 1;
```

---

## Phase 2: Backend Services

### File: `src/backend/services/tts/base.ts`
```typescript
export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: 'webspeech' | 'azure' | 'google';
}

export interface TTSProvider {
  name: string;
  getVoices(): Promise<TTSVoice[]>;
  speak(text: string, voiceId: string, options?: TTSOptions): Promise<void>;
  test(voiceId: string): Promise<void>;
}
```

### File: `src/backend/services/tts/webspeech.ts`
- Uses Electron's native speech synthesis
- No API calls needed
- Voices depend on OS

### File: `src/backend/services/tts/azure.ts`
- REST API to Azure Cognitive Services
- Voice list from: https://[region].tts.speech.microsoft.com/cognitiveservices/voices/list
- Speak via SSML request

### File: `src/backend/services/tts/google.ts`
- REST API to Google Cloud TTS
- Voice list from: https://texttospeech.googleapis.com/v1/voices
- Speak via synthesize endpoint

### File: `src/backend/services/tts/manager.ts`
- Manages all providers
- Audio queue
- Volume control
- Rate limiting

---

## Phase 3: IPC Handlers

**New handlers in `ipc-handlers.ts`:**
```typescript
// Get voices from a provider
ipcMain.handle('tts:get-voices', async (event, provider: string) => {
  // Return list of voices
});

// Test a voice
ipcMain.handle('tts:test-voice', async (event, provider: string, voiceId: string) => {
  // Play "Hello, this is a test message"
});

// Speak text
ipcMain.handle('tts:speak', async (event, text: string) => {
  // Use current settings to speak text
});

// Stop speaking
ipcMain.handle('tts:stop', async () => {
  // Stop current TTS
});

// Save TTS settings
ipcMain.handle('tts:save-settings', async (event, settings: any) => {
  // Save to database
});

// Get TTS settings
ipcMain.handle('tts:get-settings', async () => {
  // Load from database
});
```

---

## Phase 4: Frontend TTS Screen

### File: `src/frontend/screens/tts/tts.tsx`

**UI Components:**

1. **Global Enable Toggle**
   ```
   [x] Enable Text-to-Speech
   ```

2. **Provider Selector**
   ```
   Provider: [Web Speech ▼]
             [Azure TTS]
             [Google Cloud TTS]
   ```

3. **API Keys Section** (conditional)
   ```
   Azure TTS Configuration:
   API Key:    [••••••••••••••] [Show]
   Region:     [eastus ▼]
   
   Google Cloud Configuration:
   API Key:    [••••••••••••••] [Show]
   ```

4. **Voice Picker**
   ```
   Voice: [David (English - US, Male) ▼]
          [Refresh Voices]
   
   Language Filter: [All ▼]
   Gender Filter:   [All ▼]
   ```

5. **Test & Controls**
   ```
   Test Message: [Hello! This is a test message.]
   [Test Voice] [Stop]
   
   Volume: [========|---] 80%
   Rate:   [====|-------] 1.0x
   Pitch:  [====|-------] 1.0x
   ```

6. **Status**
   ```
   Provider: Web Speech API
   Voices Available: 42
   Characters Used This Month: 0 / unlimited
   ```

---

## Phase 5: Message Filtering (Next Phase)

### Settings to add later:
- Max emojis per message
- Max emotes per message
- Block duplicate messages
- Min/max message length
- Rate limit per user
- Blacklist words/phrases

---

## Implementation Order

### MVP (This Session):
1. ✅ Database schema for TTS settings
2. ✅ Backend TTS service structure
3. ✅ Web Speech API implementation
4. ✅ Azure TTS implementation
5. ✅ Google Cloud TTS implementation
6. ✅ IPC handlers
7. ✅ Frontend TTS screen
8. ✅ Voice selection UI
9. ✅ Test voice functionality

### Phase 2 (Next):
- Hook into chat events
- Speak chat messages
- Per-viewer voice assignment
- Message filtering
- TTS queue management

### Phase 3 (Later):
- Advanced filtering rules
- TTS history/logs
- Voice cloning (ElevenLabs)
- Custom pronunciation dictionary
- SSML support

---

## Key Features

### Cross-Platform Voice Discovery
- **Windows**: Detects Microsoft SAPI voices
- **macOS**: Detects Apple voices via Speech Synthesis API
- **Linux**: Uses espeak if available

### Voice Caching
- Cache voice lists for 24 hours
- Refresh button to force update
- Store in database for offline access

### Audio Queue
- Queue messages if multiple arrive
- Interrupt option for important messages
- Volume fade-in/fade-out

### Error Handling
- Invalid API keys → Show error, fall back to Web Speech
- Network issues → Retry with exponential backoff
- Rate limits → Queue and wait

---

## Testing Checklist

### Web Speech API:
- [ ] List voices on Windows
- [ ] List voices on macOS
- [ ] Speak test message
- [ ] Volume control works
- [ ] Rate control works

### Azure TTS:
- [ ] Fetch voice list with API key
- [ ] Speak test message
- [ ] Handle invalid API key
- [ ] Handle network errors
- [ ] Character counting

### Google Cloud TTS:
- [ ] Fetch voice list with API key
- [ ] Speak test message
- [ ] Handle invalid API key
- [ ] Handle network errors
- [ ] Character counting

### Integration:
- [ ] Switch between providers
- [ ] Settings persist
- [ ] Encrypted API keys
- [ ] Voice selection persists
- [ ] Test button works

---

## File Structure

```
src/
├── backend/
│   ├── database/
│   │   └── repositories/
│   │       └── tts.ts (NEW)
│   └── services/
│       └── tts/
│           ├── base.ts (NEW - interfaces)
│           ├── manager.ts (NEW - main TTS manager)
│           ├── webspeech.ts (NEW)
│           ├── azure.ts (NEW)
│           └── google.ts (NEW)
└── frontend/
    ├── screens/
    │   └── tts/
    │       └── tts.tsx (NEW)
    └── services/
        └── tts.ts (NEW - frontend API)
```

---

## Next Steps

1. Start with database migrations
2. Implement Web Speech provider (simplest)
3. Add TTS screen skeleton
4. Implement Azure provider
5. Implement Google provider
6. Polish UI and error handling

Ready to begin! 🎙️
