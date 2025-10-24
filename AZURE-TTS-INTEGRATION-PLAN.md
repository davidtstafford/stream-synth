# Azure TTS Integration Plan

## Overview
Add Azure Cognitive Services Text-to-Speech as a hybrid provider alongside Web Speech API. This will enable high-quality cloud voices while maintaining the existing Web Speech voices for users without Azure credentials.

## Goals
1. ✅ **Seamless Integration** - Azure voices appear in the same voice picker as Web Speech voices
2. ✅ **Hybrid Operation** - Users can mix Web Speech and Azure voices (different voices for different viewers)
3. ✅ **Provider Transparency** - UI clearly shows which provider each voice comes from
4. ✅ **Discord Integration** - Voice catalog includes Azure voices with proper identification
5. ✅ **Zero Breaking Changes** - Existing Web Speech functionality remains unchanged

---

## Architecture

### Current State
```
┌─────────────────────────────────────────────┐
│         Web Speech API (Renderer)            │
│         - 157 voices (system dependent)      │
│         - voice_id: "webspeech_<voiceURI>"   │
│         - No API key needed                  │
└─────────────────────────────────────────────┘
```

### Target State
```
┌─────────────────────────────────────────────┐
│         Web Speech API (Renderer)            │
│         - ~157 voices (system dependent)     │
│         - voice_id: "webspeech_<voiceURI>"   │
│         - No API key needed                  │
└─────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────┐
│      Azure TTS (Main Process/Backend)        │
│         - ~400+ voices (53 languages)        │
│         - voice_id: "azure_<locale>_<name>"  │
│         - API key required                   │
│         - Neural & Standard voices           │
│         - Speaking styles support            │
└─────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Azure Provider Implementation
**Location**: `src/backend/services/tts/azure-provider.ts`

#### 1.1 Create Azure Provider Class
```typescript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { TTSProvider, TTSVoice, TTSOptions } from './base';

export class AzureTTSProvider implements TTSProvider {
  name = 'azure';
  needsApiKey = true;
  
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private config: sdk.SpeechConfig | null = null;
  private apiKey: string = '';
  private region: string = '';
  
  async initialize(credentials: { apiKey?: string; region?: string }): Promise<void>;
  async getVoices(): Promise<TTSVoice[]>;
  async speak(text: string, voiceId: string, options?: TTSOptions): Promise<void>;
  stop(): void;
  async test(voiceId: string, options?: TTSOptions): Promise<void>;
}
```

**Key Features:**
- ✅ Initialize Speech SDK with API key and region
- ✅ Fetch available voices via `synthesizer.getVoicesAsync()`
- ✅ Convert Azure voice format to our `TTSVoice` interface
- ✅ Implement SSML-based speech synthesis
- ✅ Support volume, rate, pitch adjustments via SSML
- ✅ Handle audio playback (speaker output)
- ✅ Error handling for invalid credentials, quota limits

#### 1.2 Voice ID Format
```typescript
// Web Speech: "webspeech_com.apple.speech.synthesis.voice.samantha"
// Azure:      "azure_en-US_AriaNeural"
//             azure_<locale>_<voiceName>
```

#### 1.3 Voice Metadata Mapping
```typescript
interface AzureVoiceInfo {
  Name: string;           // "en-US-AriaNeural"
  DisplayName: string;    // "Aria"
  LocalName: string;      // "Aria" or localized
  ShortName: string;      // "en-US-AriaNeural"
  Gender: string;         // "Female" | "Male"
  Locale: string;         // "en-US"
  LocaleName: string;     // "English (United States)"
  SampleRateHertz: string;
  VoiceType: string;      // "Neural" | "Standard"
  Status: string;         // "GA"
  StyleList?: string[];   // ["cheerful", "sad", "angry"]
}

// Map to our format
const voice: TTSVoice = {
  id: `azure_${info.Locale}_${info.DisplayName}`,
  name: `${info.DisplayName} (Azure ${info.VoiceType})`,
  language: info.Locale,
  languageName: info.LocaleName,
  gender: info.Gender.toLowerCase() as 'male' | 'female',
  provider: 'azure',
  styles: info.StyleList
};
```

---

### Phase 2: Manager Integration
**Location**: `src/backend/services/tts/manager.ts`

#### 2.1 Register Azure Provider
```typescript
import { AzureTTSProvider } from './azure-provider';

constructor(db: Database.Database) {
  this.repository = new TTSRepository(db);
  this.viewerRulesRepo = new ViewerRulesRepository(db);
  this.voicesRepo = new VoicesRepository();
  this.providers = new Map();
  
  // Register Azure provider
  this.providers.set('azure', new AzureTTSProvider());
}
```

#### 2.2 Hybrid Voice Loading
```typescript
async getVoices(): Promise<TTSVoice[]> {
  const allVoices: TTSVoice[] = [];
  
  // Web Speech voices from renderer (already in DB)
  // Azure voices from provider
  if (this.settings?.azureApiKey && this.settings?.azureRegion) {
    try {
      const azureProvider = this.providers.get('azure') as AzureTTSProvider;
      await azureProvider.initialize({
        apiKey: this.settings.azureApiKey,
        region: this.settings.azureRegion
      });
      const azureVoices = await azureProvider.getVoices();
      allVoices.push(...azureVoices);
    } catch (error) {
      console.error('[TTS] Failed to load Azure voices:', error);
    }
  }
  
  return allVoices;
}
```

#### 2.3 Smart Voice Resolution
```typescript
async speak(text: string, options?: Partial<TTSOptions>): Promise<void> {
  const voiceId = options?.voiceId ?? this.settings.voiceId;
  
  // Determine provider from voice ID
  if (voiceId.startsWith('webspeech_')) {
    // Send to renderer for Web Speech
    this.mainWindow?.webContents.send('tts:speak', { ... });
  } else if (voiceId.startsWith('azure_')) {
    // Use Azure provider
    const azureProvider = this.providers.get('azure');
    await azureProvider.speak(text, voiceId, options);
  } else {
    throw new Error(`Unknown voice provider for: ${voiceId}`);
  }
}
```

---

### Phase 3: Database Schema Updates
**Location**: `src/backend/database/migrations.ts`

#### 3.1 Voices Table (Already exists, no changes needed)
```sql
CREATE TABLE IF NOT EXISTS voices (
  numeric_id INTEGER PRIMARY KEY AUTOINCREMENT,
  voice_id TEXT UNIQUE NOT NULL,      -- "webspeech_..." or "azure_..."
  provider TEXT NOT NULL,              -- "webspeech" or "azure"
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  language_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

✅ **No schema changes needed** - existing structure supports multiple providers

#### 3.2 Voice Sync Strategy
```typescript
// When Azure credentials are added/changed:
1. Fetch Azure voices from API
2. Insert/update voices table with provider='azure'
3. Assign sequential numeric_ids
4. Preserve existing Web Speech voices
5. Update Discord catalog
```

---

### Phase 4: Frontend UI Updates

#### 4.1 Voice Settings Tab
**Location**: `src/frontend/screens/tts/tts.tsx`

**Changes:**
1. ✅ **Provider Status Indicator**
   ```tsx
   {settings.provider === 'webspeech' && (
     <div className="provider-status">
       ✓ Using Web Speech API (No API key needed)
     </div>
   )}
   {settings.provider === 'azure' && !settings.azureApiKey && (
     <div className="provider-warning">
       ⚠️ Azure credentials required
     </div>
   )}
   ```

2. ✅ **Azure Credentials Section** (Conditional)
   ```tsx
   {/* Show only when provider switches or Azure selected */}
   <div className="azure-credentials">
     <label>Azure API Key</label>
     <input 
       type="password" 
       value={azureApiKey}
       placeholder="Enter your Azure Speech Services API key"
     />
     <label>Azure Region</label>
     <select value={azureRegion}>
       <option value="eastus">East US</option>
       <option value="westus">West US</option>
       <option value="westeurope">West Europe</option>
       {/* ... all Azure regions */}
     </select>
     <button onClick={testAzureConnection}>Test Connection</button>
   </div>
   ```

3. ✅ **Voice Picker Enhancement**
   ```tsx
   // Group voices by provider in dropdown
   <select value={selectedVoiceId}>
     <optgroup label="🌐 Web Speech (Free)">
       {webSpeechVoices.map(v => (
         <option value={v.voice_id}>{v.name}</option>
       ))}
     </optgroup>
     <optgroup label="☁️ Azure Neural (API Key Required)">
       {azureVoices.map(v => (
         <option value={v.voice_id}>{v.name}</option>
       ))}
     </optgroup>
   </select>
   ```

4. ✅ **Voice Preview Button**
   ```tsx
   // Already exists, but ensure it works for both providers
   <button onClick={() => testVoice(selectedVoiceId)}>
     🔊 Test Voice
   </button>
   ```

#### 4.2 Viewers Tab
**Location**: `src/frontend/screens/tts/tts.tsx` (Viewers tab section)

**Changes:**
1. ✅ **Provider Badge in Voice Display**
   ```tsx
   {viewerVoice && (
     <div className="voice-info">
       <span className="voice-name">{viewerVoice.name}</span>
       <span className={`provider-badge provider-${viewerVoice.provider}`}>
         {viewerVoice.provider === 'webspeech' ? '🌐' : '☁️'}
       </span>
     </div>
   )}
   ```

2. ✅ **Grouped Voice Picker** (Same as Voice Settings)
   ```tsx
   // Voice picker should show provider grouping
   <optgroup label="🌐 Web Speech">...</optgroup>
   <optgroup label="☁️ Azure Neural">...</optgroup>
   ```

3. ✅ **Warning for Azure Voices Without Credentials**
   ```tsx
   {selectedVoice?.provider === 'azure' && !azureConfigured && (
     <div className="warning">
       ⚠️ Azure voice selected but credentials not configured.
       Go to Voice Settings to add your API key.
     </div>
   )}
   ```

---

### Phase 5: Discord Integration Updates

#### 5.1 Voice Catalog Format
**Location**: `src/backend/core/ipc-handlers.ts` (startup tasks)

**Current Format:**
```
🎤 TTS Voice Catalogue

157 voices available

Use ~setmyvoice <ID> to select your voice
Example: ~setmyvoice 22 for Eddy

━━━━━━━━━━━━━━━━━━━━
English (United States)
━━━━━━━━━━━━━━━━━━━━
001 │ Samantha ♀️
002 │ Alex ♂️
...
```

**New Format:**
```
🎤 TTS Voice Catalogue

**557 voices available** (157 Web Speech + 400 Azure Neural)

Use `~setmyvoice <ID>` to select your voice
Example: `~setmyvoice 22` for Eddy (Web Speech)
Example: `~setmyvoice 301` for Aria Neural (Azure)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Web Speech - English (US)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
001 │ Samantha ♀️
002 │ Alex ♂️
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━
☁️ Azure Neural - English (US)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
301 │ Aria Neural ♀️
302 │ Guy Neural ♂️
...
```

**Implementation:**
```typescript
// Modify grouping logic to include provider
const groupKey = `${voice.provider === 'webspeech' ? '🌐 Web Speech' : '☁️ Azure Neural'} - ${voice.language_name}`;

// Update description
embed.description = `**${stats.available} voices available** ` +
  `(${webSpeechCount} Web Speech + ${azureCount} Azure Neural)\n\n` +
  `Use \`~setmyvoice <ID>\` to select your voice\n` +
  `Example: \`~setmyvoice 22\` for Eddy (Web Speech)\n` +
  `Example: \`~setmyvoice 301\` for Aria (Azure Neural)`;
```

---

### Phase 6: Voice Sync Flow

#### 6.1 Initial Sync (On First Azure Setup)
```typescript
// When user saves Azure credentials for first time:
1. Test Azure connection
2. Fetch all Azure voices (await provider.getVoices())
3. Sync to database (voicesRepo.syncVoices('azure', azureVoices))
4. Generate new Discord catalog
5. Post to Discord (if auto-post enabled)
6. Reload voice picker in UI
```

#### 6.2 Incremental Sync (On App Startup)
```typescript
// On app startup:
1. Load Web Speech voices (renderer process)
2. If Azure credentials exist:
   a. Load Azure voices (backend)
   b. Sync to database
3. Merge all voices in UI
4. Post to Discord (if auto-post enabled)
```

#### 6.3 Re-sync Trigger
```typescript
// User can manually trigger re-sync:
- Button in Voice Settings: "🔄 Refresh Azure Voices"
- Useful when Azure adds new voices
- Fetches latest from API and syncs to DB
```

---

### Phase 7: Voice Selection Logic

#### 7.1 Global Voice (Voice Settings Tab)
```typescript
// User selects voice in Voice Settings
- Can be Web Speech or Azure
- Stored in tts_settings.tts_voice_id
- Format: "webspeech_..." or "azure_..."
- Used as fallback for all viewers without custom voice
```

#### 7.2 Viewer Custom Voice (Viewers Tab)
```typescript
// User assigns custom voice to viewer
- Can be Web Speech or Azure (mixed!)
- Stored in viewer_tts_rules.custom_voice_id (numeric ID)
- Resolved to voice_id string via voices table
- Overrides global voice for that specific viewer
```

#### 7.3 Speaking Flow
```typescript
async handleChatMessage(username, message) {
  // 1. Get viewer rule (if exists)
  const viewerRule = this.viewerRulesRepo.getByUsername(username);
  
  // 2. Determine voice to use
  let voiceId = this.settings.voiceId; // Global default
  
  if (viewerRule?.customVoiceId) {
    // Viewer has custom voice
    const voice = this.voicesRepo.getVoiceByNumericId(viewerRule.customVoiceId);
    if (voice) {
      voiceId = voice.voice_id; // Could be "webspeech_..." or "azure_..."
    }
  }
  
  // 3. Queue message with resolved voiceId
  this.messageQueue.push({ username, message, voiceId });
  
  // 4. Process queue
  // When speaking, manager routes to correct provider based on voiceId prefix
}
```

---

## Technical Details

### Dependencies
```json
{
  "microsoft-cognitiveservices-speech-sdk": "^1.36.0"
}
```

### Azure Speech SDK Setup
```typescript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Initialize
const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region);
const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Get voices
synthesizer.getVoicesAsync((result) => {
  if (result.reason === sdk.ResultReason.VoicesListRetrieved) {
    const voices = result.voices; // Array of VoiceInfo
  }
});

// Speak with SSML
const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-AriaNeural">
    <prosody rate="1.2" pitch="+10%" volume="+20%">
      Hello world!
    </prosody>
  </voice>
</speak>
`;

synthesizer.speakSsmlAsync(ssml, (result) => {
  if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
    console.log('Speech synthesis completed');
  }
});
```

### SSML Volume/Rate/Pitch Mapping
```typescript
// Our settings → SSML
volume: 0-100     → volume="+0%" to "+100%" or "-50%" for quieter
rate:   0.5-2.0   → rate="0.5" to "2.0" (or "x-slow", "slow", "medium", "fast", "x-fast")
pitch:  0.5-2.0   → pitch="-50%" to "+100%" (relative change)

function buildSSML(text: string, voiceName: string, options: TTSOptions): string {
  const volume = options.volume ? `+${options.volume}%` : '+100%';
  const rate = options.rate?.toString() || '1.0';
  const pitch = options.pitch ? `${(options.pitch - 1) * 100}%` : '+0%';
  
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceName}">
        <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
          ${escapeXML(text)}
        </prosody>
      </voice>
    </speak>
  `;
}
```

---

## UI Mockups

### Voice Settings Tab - Azure Section
```
┌─────────────────────────────────────────────────────────┐
│ 🎙️ Voice Settings                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ TTS Provider: [Hybrid (Web Speech + Azure)       ▼]     │
│                                                          │
│ ╔════════════════════════════════════════════════════╗  │
│ ║ ☁️ Azure Speech Services                          ║  │
│ ║                                                    ║  │
│ ║ API Key:  [••••••••••••••••••••••••] 🔄           ║  │
│ ║ Region:   [East US                          ▼]    ║  │
│ ║                                                    ║  │
│ ║ Status: ✓ Connected • 400 voices available        ║  │
│ ║                                                    ║  │
│ ║ [Test Connection]  [Refresh Voices]               ║  │
│ ╚════════════════════════════════════════════════════╝  │
│                                                          │
│ Select Voice:                                            │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🔍 Search voices...                                 │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🌐 Web Speech - English (United States)            │  │
│ │   001 │ Samantha ♀️                                 │  │
│ │   002 │ Alex ♂️                                     │  │
│ │   ...                                               │  │
│ │                                                     │  │
│ │ ☁️ Azure Neural - English (United States)          │  │
│ │   301 │ Aria Neural ♀️  [🔊 Preview]               │  │ ← Selected
│ │   302 │ Guy Neural ♂️                               │  │
│ │   ...                                               │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Volume:  [████████░░] 80%                               │
│ Rate:    [██████░░░░] 1.2x                              │
│ Pitch:   [█████░░░░░] 1.0x                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Viewers Tab - Custom Voice Display
```
┌─────────────────────────────────────────────────────────┐
│ 👥 Viewers                                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Search: [nightbot____________________]                  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ nightbot                                    [Delete]│  │
│ │                                                     │  │
│ │ Voice: Aria Neural ☁️                  [🔊 Test]   │  │
│ │ Volume:  [████████░░] 80%                          │  │
│ │ Rate:    [██████░░░░] 1.2x                         │  │
│ │ Pitch:   [█████░░░░░] 1.0x                         │  │
│ │                                                     │  │
│ │ ☑ Mute                                              │  │
│ │   Duration: [──────░░░░] 0m (Permanent)            │  │
│ │                                                     │  │
│ │ ☑ Custom Cooldown (overrides global)               │  │
│ │   Window: [██████░░░░] 60s                         │  │
│ │   Duration: [──────░░░░] 0m (Permanent)            │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Testing Plan

### Unit Tests
1. ✅ Azure Provider
   - Initialize with valid/invalid credentials
   - Fetch voices successfully
   - Handle API errors gracefully
   - Generate correct SSML
   - Map volume/rate/pitch correctly

2. ✅ Voice Resolution
   - Correct provider routing (webspeech_ vs azure_)
   - Numeric ID → voice_id lookup
   - Fallback to global when viewer has no custom voice

3. ✅ Voice Sync
   - Insert new Azure voices
   - Update existing voices
   - Preserve Web Speech voices
   - Handle duplicate voice_id

### Integration Tests
1. ✅ End-to-End Speech Flow
   - Chat message → Web Speech voice
   - Chat message → Azure voice
   - Viewer with custom Web Speech voice
   - Viewer with custom Azure voice
   - Viewer with muted status
   - Global cooldown enforcement
   - Viewer cooldown enforcement

2. ✅ UI Tests
   - Azure credentials form
   - Voice picker grouping
   - Provider badges
   - Test voice button (both providers)
   - Discord catalog update

### Manual Testing Checklist
- [ ] Install Azure SDK: `npm install microsoft-cognitiveservices-speech-sdk`
- [ ] Add Azure credentials in Voice Settings
- [ ] Click "Test Connection" → Success message
- [ ] Click "Refresh Voices" → Azure voices appear
- [ ] Select Azure voice in Voice Settings
- [ ] Test voice → Should hear Azure voice
- [ ] Assign Azure voice to viewer in Viewers tab
- [ ] Send chat message as that viewer → Should use Azure voice
- [ ] Check Discord catalog → Should show grouped voices
- [ ] Restart app → Azure voices persist
- [ ] Remove Azure credentials → Azure voices hidden, Web Speech still works

---

## Error Handling

### Azure API Errors
```typescript
try {
  const voices = await azureProvider.getVoices();
} catch (error) {
  if (error.message.includes('401')) {
    // Invalid API key
    showError('Invalid Azure API key. Please check your credentials.');
  } else if (error.message.includes('403')) {
    // Quota exceeded
    showError('Azure quota exceeded. Please check your subscription.');
  } else if (error.message.includes('Network')) {
    // Network error
    showError('Cannot connect to Azure. Check your internet connection.');
  } else {
    // Generic error
    showError('Failed to load Azure voices. Using Web Speech only.');
  }
}
```

### Graceful Degradation
```typescript
// If Azure fails, fall back to Web Speech
if (!azureVoices || azureVoices.length === 0) {
  console.warn('[TTS] Azure voices unavailable, using Web Speech only');
  // UI shows warning but remains functional
}

// If voice not found, use global default
if (!voice) {
  console.warn(`[TTS] Voice ${voiceId} not found, using global default`);
  voiceId = this.settings.voiceId;
}
```

---

## Migration & Rollback

### User Migration (Existing Users)
1. ✅ **Zero Breaking Changes**
   - Existing Web Speech voices continue working
   - Existing viewer assignments preserved
   - No action required from users

2. ✅ **Opt-In Azure**
   - Azure is optional
   - Users can add credentials at any time
   - Can remove credentials to disable Azure

3. ✅ **Database Migration**
   ```sql
   -- No schema changes needed!
   -- Existing voices table already supports multiple providers
   -- Just insert new Azure voices with provider='azure'
   ```

### Rollback Plan
If issues arise:
1. Remove Azure credentials from UI
2. Azure voices hidden from pickers
3. Viewers with Azure voices fall back to global Web Speech voice
4. Discord catalog shows Web Speech only
5. No data loss - Azure voice assignments preserved in DB

---

## Performance Considerations

### Voice Loading
- **Web Speech**: Instant (loaded from system)
- **Azure**: ~1-2 seconds to fetch 400+ voices via API
- **Solution**: Cache Azure voices in database, refresh on demand

### Speech Synthesis
- **Web Speech**: Instant (local)
- **Azure**: ~200-500ms network latency + synthesis time
- **Solution**: Queue messages, stream audio when available

### Memory
- **Web Speech**: Minimal (system handles it)
- **Azure**: SDK holds audio buffer in memory
- **Solution**: Release audio after playback, limit queue size

### Rate Limiting
- **Azure**: 20 requests/sec, 100k chars/month (Free tier)
- **Solution**: Track usage, warn when approaching limits

---

## Cost Analysis

### Web Speech API
- **Cost**: Free
- **Limitations**: System voices only, quality varies by OS
- **Best For**: Casual users, testing, variety

### Azure Speech Services
- **Free Tier**: 500,000 characters/month free
- **Standard**: $1 per 1M characters (Neural voices)
- **Typical Usage**: 
  - 100 chat messages/day
  - Average 50 characters/message
  - ~150k characters/month
  - **Cost**: Free! (within free tier)

### Recommendation
- Start with Web Speech (free, unlimited)
- Add Azure for premium voices
- Monitor usage in UI
- Warn when approaching free tier limit

---

## Documentation Updates

### User Guide
1. **Getting Started with Azure**
   - How to get Azure API key
   - Where to find region
   - How to add credentials

2. **Voice Selection**
   - Difference between Web Speech and Azure
   - How to assign custom voices to viewers
   - Voice preview feature

3. **Troubleshooting**
   - Azure connection issues
   - Quota exceeded
   - Voice not found

### Developer Guide
1. **Architecture Overview**
2. **Adding New Providers** (future: Google TTS)
3. **Voice ID Format Conventions**
4. **SSML Generation**

---

## Future Enhancements (Post-Azure)

### Phase 8: Google TTS Integration
- Same hybrid approach
- voice_id format: "google_<locale>_<name>"
- WaveNet voices support

### Phase 9: Voice Styles (Azure)
- Azure voices support styles (cheerful, sad, angry, etc.)
- Add style picker for Azure voices
- Store in viewer_tts_rules.voice_style

### Phase 10: Usage Analytics
- Track characters spoken per provider
- Show usage graphs in UI
- Warn when approaching limits

### Phase 11: Voice Cloning
- ElevenLabs integration
- Custom voice upload
- voice_id format: "elevenlabs_<custom_id>"

---

## Summary

### What This Achieves
✅ Seamless hybrid TTS with Web Speech + Azure  
✅ Zero breaking changes for existing users  
✅ Clear provider identification in UI  
✅ Mixed voice assignments (viewer A uses Web Speech, viewer B uses Azure)  
✅ Discord catalog shows all voices with provider badges  
✅ Graceful degradation if Azure unavailable  
✅ Foundation for future providers (Google, ElevenLabs)  

### Critical Success Factors
1. **Voice ID Consistency**: `webspeech_*` vs `azure_*` prefix
2. **Provider Routing**: Manager correctly routes to Web Speech or Azure
3. **UI Clarity**: Users understand which voices need API keys
4. **Database Integrity**: Numeric IDs remain stable across syncs
5. **Discord Integration**: Catalog properly groups and labels voices

### Next Steps
1. ✅ Review and approve this plan
2. 🔄 Implement Phase 1: Azure Provider
3. 🔄 Implement Phase 2: Manager Integration
4. 🔄 Test hybrid voice resolution
5. 🔄 Update UI for Azure credentials
6. 🔄 Update Discord catalog
7. ✅ Deploy and monitor

---

## Questions & Decisions Needed

1. **Azure Region Default**: Should we default to a specific region (e.g., "eastus") or require user selection?
   - ✅ **APPROVED**: Default to "eastus", allow change

2. **Voice Sync Frequency**: When should we re-sync Azure voices?
   - ✅ **APPROVED**: Manual button + optional auto-sync on startup (can be disabled)

3. **Free Tier Warning**: When should we warn about approaching free tier limit?
   - ✅ **APPROVED**: 80% warning, 95% urgent warning

4. **Voice Grouping in Discord**: Should we group by provider or language first?
   - ✅ **APPROVED**: Option A (Provider → Language) for clarity

5. **Test Connection**: Should we fetch voices to test, or just validate credentials?
   - ✅ **APPROVED**: Validate + fetch first 10 voices (fast test)

---

## Phase 0: User Onboarding - Azure Setup Guide

### Overview
Create an intuitive, step-by-step popup guide that walks non-technical users through setting up Azure Speech Services. The guide should be accessible from the Voice Settings tab and provide clear instructions with screenshots/diagrams.

### 0.1 Azure Setup Wizard Component
**Location**: `src/frontend/components/AzureSetupWizard.tsx`

#### Wizard Structure
```
Step 1: Introduction
  ↓
Step 2: Create Azure Account
  ↓
Step 3: Create Speech Resource
  ↓
Step 4: Get API Key & Region
  ↓
Step 5: Enter Credentials
  ↓
Step 6: Test Connection
  ↓
Step 7: Success!
```

#### Step-by-Step Content

**Step 1: Introduction**
```
╔══════════════════════════════════════════════════════════╗
║  🎤 Welcome to Azure Neural Voices!                      ║
╚══════════════════════════════════════════════════════════╝

Azure Neural Voices provide premium, natural-sounding text-to-speech
with over 400 voices in 53 languages.

✨ Benefits:
   • Ultra-realistic voices with emotion and expression
   • Wide language support
   • 500,000 characters FREE per month
   • Perfect for professional streams

💰 Cost:
   • FREE TIER: 500k characters/month (plenty for most streamers!)
   • After free tier: $1 per 1 million characters
   • Typical usage: ~150k chars/month = FREE!

⏱️ Setup Time: 5-10 minutes

This wizard will guide you through:
1. Creating a FREE Azure account (no credit card for free tier!)
2. Creating a Speech Services resource
3. Getting your API key and region
4. Testing your connection

[Cancel]                             [Next: Create Account →]
```

**Step 2: Create Azure Account**
```
╔══════════════════════════════════════════════════════════╗
║  Step 1 of 6: Create Azure Account                      ║
╚══════════════════════════════════════════════════════════╝

📋 Instructions:

1. Go to Azure Portal
   → [Open Azure Portal] (button opens: https://portal.azure.com)

2. Click "Start free" or "Sign in"
   • If you have a Microsoft account, sign in
   • If not, click "Create one!" to make a Microsoft account
   
3. Choose FREE account option
   ℹ️ The free tier includes Speech Services at no cost!
   ℹ️ You can use Azure without adding a credit card

4. Complete account setup
   • Enter your email
   • Verify your email
   • Set up 2-factor authentication (recommended)

✅ Once you're logged into Azure Portal, click Next

[← Back]                                          [Next →]
```

**Step 3: Create Speech Resource**
```
╔══════════════════════════════════════════════════════════╗
║  Step 2 of 6: Create Speech Services Resource           ║
╚══════════════════════════════════════════════════════════╝

Now we'll create a Speech Services resource (this is what gives
you access to the voices).

📋 Instructions:

1. In Azure Portal, click "Create a resource"
   (Blue + button in top-left, or search bar)

2. Search for "Speech Services"
   Type: speech
   Select: "Speech Services" (with microphone icon 🎤)

3. Click "Create"

4. Fill in the form:

   Subscription: [Select your subscription]
   
   Resource Group: 
   → Click "Create new"
   → Name it: "StreamSynthResources"
   
   Region: "East US"
   ℹ️ This determines where your data is processed
   ℹ️ We recommend East US for best performance
   
   Name: "StreamSynthSpeech"
   ℹ️ Must be unique across Azure
   ℹ️ Try: "StreamSynthSpeech-[your-username]"
   
   Pricing Tier: "Free F0"
   ⚠️ IMPORTANT: Select "Free F0" for 500k chars/month free!

5. Click "Review + Create"

6. Click "Create"

7. Wait for deployment (usually 30-60 seconds)

8. When you see "Your deployment is complete", click "Go to resource"

✅ Once you're viewing your Speech resource, click Next

[← Back]                                          [Next →]
```

**Step 4: Get API Key & Region**
```
╔══════════════════════════════════════════════════════════╗
║  Step 3 of 6: Get Your API Key and Region               ║
╚══════════════════════════════════════════════════════════╝

Now we'll copy your API credentials so Stream Synth can connect
to Azure.

📋 Instructions:

1. In your Speech Services resource, look at the left sidebar

2. Under "Resource Management", click "Keys and Endpoint"

3. You'll see two sections:

   ┌─────────────────────────────────────────────────┐
   │ KEY 1                                           │
   │ [••••••••••••••••••••••••••••]  [👁️ Show] [📋] │
   ├─────────────────────────────────────────────────┤
   │ KEY 2                                           │
   │ [••••••••••••••••••••••••••••]  [👁️ Show] [📋] │
   ├─────────────────────────────────────────────────┤
   │ Location/Region: eastus                         │
   └─────────────────────────────────────────────────┘

4. Copy KEY 1:
   • Click the [👁️ Show] button to reveal the key
   • Click the [📋 Copy] button to copy it
   • ℹ️ Keys are 32 characters, look like: a1b2c3d4e5f6...

5. Note your Region:
   • Usually shown as "Location/Region: eastus"
   • Common regions: eastus, westus, westeurope
   • ℹ️ This matches what you chose in Step 3

⚠️ Keep your API key secret! Don't share it with anyone.

✅ Once you've copied your key, click Next to enter it

[← Back]                                          [Next →]
```

**Step 5: Enter Credentials**
```
╔══════════════════════════════════════════════════════════╗
║  Step 4 of 6: Enter Your Credentials                    ║
╚══════════════════════════════════════════════════════════╝

Paste your API key and select your region below:

┌────────────────────────────────────────────────────────┐
│ API Key:                                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [Paste your KEY 1 here]                            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ℹ️ 32-character key from Azure Portal                 │
│ ℹ️ Starts with letters and numbers                    │
│ ℹ️ Example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Region:                                                │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [East US (eastus)                              ▼] │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ℹ️ Must match the region from Azure Portal            │
│ ℹ️ Common: eastus, westus, westeurope                 │
└────────────────────────────────────────────────────────┘

[← Back]                      [Test Connection →]
```

**Step 6: Test Connection**
```
╔══════════════════════════════════════════════════════════╗
║  Step 5 of 6: Testing Connection...                     ║
╚══════════════════════════════════════════════════════════╝

⏳ Connecting to Azure Speech Services...
⏳ Validating credentials...
⏳ Fetching available voices...

[Status updates appear here in real-time]

✅ Connection successful!
✅ Credentials validated
✅ Found 400+ voices available

Preview:
• en-US-AriaNeural (Female, Neural)
• en-US-GuyNeural (Male, Neural)
• en-GB-SoniaNeural (Female, Neural)
• es-ES-ElviraNeural (Female, Neural)
• fr-FR-DeniseNeural (Female, Neural)
• de-DE-KatjaNeural (Female, Neural)
• ja-JP-NanamiNeural (Female, Neural)
• ko-KR-SunHiNeural (Female, Neural)
• pt-BR-FranciscaNeural (Female, Neural)
• it-IT-ElsaNeural (Female, Neural)
... and 390+ more!

[← Back]                                    [Finish Setup →]
```

**Step 7: Success**
```
╔══════════════════════════════════════════════════════════╗
║  🎉 Setup Complete!                                      ║
╚══════════════════════════════════════════════════════════╝

Your Azure Neural Voices are now ready to use!

✅ API Key saved securely
✅ 400+ premium voices available
✅ Free tier active (500k characters/month)

🎤 What's Next:

1. Select an Azure voice in the Voice Settings tab
   → Look for voices labeled "Azure Neural"
   → Preview voices with the 🔊 Test button

2. Assign Azure voices to specific viewers
   → Go to the Viewers tab
   → Search for a viewer
   → Choose an Azure voice just for them!

3. Azure voices will be used automatically
   → When TTS is enabled, chat messages will use Azure voices
   → Mixed voices are supported (some viewers Web Speech, some Azure)

4. Monitor your usage
   → Voice Settings tab shows usage stats
   → You'll get warnings at 80% and 95% of free tier

💡 Tips:
   • Neural voices sound more natural than Standard
   • Try different voices to find your favorites
   • Azure voices work great for international viewers

📖 Need help? Check the documentation in the Help menu.

                              [Close and Start Using Azure →]
```

### 0.2 Error Handling in Wizard

**Invalid API Key Error:**
```
❌ Connection Failed

The API key you entered appears to be invalid.

Common issues:
• Key copied incorrectly (missing characters)
• Wrong key selected (use KEY 1, not KEY 2)
• Spaces added before/after the key
• Key regenerated in Azure Portal

💡 Solution:
1. Go back to Azure Portal
2. Navigate to: Keys and Endpoint
3. Click [👁️ Show] to reveal KEY 1
4. Click [📋 Copy] to copy it cleanly
5. Paste again in the previous step

[← Back to Fix]                [Try Again]
```

**Wrong Region Error:**
```
❌ Connection Failed

Unable to connect with the selected region.

Common issues:
• Region doesn't match Azure Portal
• Selected wrong region in dropdown

💡 Solution:
1. Go back to Azure Portal
2. Check your resource's Location/Region
3. Select the matching region in the dropdown

Example: If Azure shows "East US", select "East US (eastus)"

[← Back to Fix]                [Try Again]
```

**Network Error:**
```
❌ Connection Failed

Cannot reach Azure servers.

Common issues:
• No internet connection
• Firewall blocking connection
• Azure servers temporarily down

💡 Solution:
1. Check your internet connection
2. Try again in a few moments
3. If problem persists, check Azure status:
   https://status.azure.com

[← Back]                        [Try Again]
```

### 0.3 UI Integration

#### Voice Settings Tab - Azure Section
```tsx
┌─────────────────────────────────────────────────────────┐
│ ☁️ Azure Speech Services                                │
│                                                          │
│ ┌─ Not Configured ──────────────────────────────────┐  │
│ │                                                    │  │
│ │  Azure Neural Voices provide premium, natural     │  │
│ │  text-to-speech with 400+ voices in 53 languages. │  │
│ │                                                    │  │
│ │  • 500,000 characters FREE per month              │  │
│ │  • Ultra-realistic neural voices                  │  │
│ │  • Perfect for professional streams               │  │
│ │                                                    │  │
│ │  [📚 Setup Guide]  [Already Have Credentials]     │  │
│ │                                                    │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

// After credentials entered:

┌─────────────────────────────────────────────────────────┐
│ ☁️ Azure Speech Services                                │
│                                                          │
│ ┌─ Connected ───────────────────────────────────────┐  │
│ │                                                    │  │
│ │  Status: ✓ Active                                 │  │
│ │  Region: East US                                  │  │
│ │  Voices: 400+ available                           │  │
│ │                                                    │  │
│ │  Usage this month:                                │  │
│ │  [████░░░░░░░░░░░░] 150k / 500k chars (30%)      │  │
│ │                                                    │  │
│ │  [🔄 Refresh Voices]  [⚙️ Manage]  [❌ Remove]    │  │
│ │                                                    │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 0.4 Wizard Features

#### Progress Saving
- Save wizard progress in local storage
- Resume from last step if wizard closed mid-setup
- Clear progress on successful completion

#### Help at Every Step
- "?" help icon in each step
- Hover for quick tips
- Click for detailed help

#### Quick Links
- "Open Azure Portal" button (opens in browser)
- "View Documentation" button
- "Contact Support" button

#### Visual Aids
- Screenshots/diagrams for each step (optional, can be added later)
- Animated arrows pointing to UI elements
- Color-coded sections (green = success, yellow = warning, red = error)

### 0.5 Alternative Entry Points

#### Quick Setup Button
```tsx
// If no Azure credentials and user selects Azure voice:
<div className="azure-required-warning">
  ⚠️ This is an Azure Neural voice.
  
  Azure credentials are required to use this voice.
  
  [Setup Azure (5 min)]  [Select Different Voice]
</div>
```

#### First-Time Setup Prompt
```tsx
// On first launch after installing:
<div className="welcome-tips">
  💡 Tip: Want premium voices?
  
  Setup Azure to get 400+ ultra-realistic voices FREE!
  
  [Show Me How]  [Maybe Later]
</div>
```

---

## Next: Google TTS Integration (Phase 2)

After Azure is complete, we'll follow the same pattern for Google TTS:

### Google Setup Wizard (Future)
- Step 1: Create Google Cloud Account
- Step 2: Enable Cloud Text-to-Speech API
- Step 3: Create API Key
- Step 4: Enter Credentials
- Step 5: Test Connection
- Step 6: Success!

### Voice ID Format
- Google: `google_<locale>_<name>`
- Example: `google_en-US_WavenetF`

### Key Differences from Azure
- Google uses single API key (no region)
- WaveNet voices (similar quality to Azure Neural)
- Studio voices (even higher quality)
- Different pricing model

---

**Ready to implement!** 🚀

**Implementation Order:**
1. Phase 0: Azure Setup Wizard (NEW)
2. Phase 1: Azure Provider Implementation
3. Phase 2: Manager Integration
4. Phase 3-7: Database, UI, Discord, Voice Sync
5. Testing and Deployment
6. Then: Google TTS Integration (follow same pattern)
