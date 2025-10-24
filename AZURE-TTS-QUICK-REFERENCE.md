# Azure TTS Quick Reference

## 🎯 Quick Links

- **Main Plan**: `AZURE-TTS-INTEGRATION-PLAN.md`
- **Roadmap**: `AZURE-TTS-IMPLEMENTATION-ROADMAP.md`
- **This Document**: Quick reference for developers

---

## 📋 Voice ID Format Convention

| Provider | Format | Example | Notes |
|----------|--------|---------|-------|
| Web Speech | `webspeech_<voiceURI>` | `webspeech_com.apple.speech.synthesis.voice.samantha` | System-dependent |
| Azure | `azure_<locale>_<name>` | `azure_en-US_AriaNeural` | Consistent across systems |
| Google (future) | `google_<locale>_<name>` | `google_en-US_WavenetF` | WaveNet/Studio voices |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Chat Message                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              TTSManager.handleChatMessage()              │
│  • Apply filters                                         │
│  • Check viewer rules                                    │
│  • Resolve voice (viewer custom or global)               │
│  • Add to queue                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 TTSManager.processQueue()                │
│  • Pop message from queue                                │
│  • Check voice ID prefix                                 │
│  • Route to appropriate provider                         │
└─────────┬───────────────────────────┬────────────────────┘
          │                           │
          │ webspeech_*               │ azure_*
          ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│   Web Speech API    │     │    Azure TTS Provider       │
│   (Renderer)        │     │    (Main Process)           │
│                     │     │                             │
│ • Local synthesis   │     │ • Cloud synthesis           │
│ • System voices     │     │ • Neural voices             │
│ • Free/Instant      │     │ • SSML support              │
└─────────┬───────────┘     └─────────┬───────────────────┘
          │                           │
          └───────────┬───────────────┘
                      │
                      ▼
              ┌──────────────┐
              │   Speakers   │
              │   (Audio)    │
              └──────────────┘
```

---

## 🔧 Key Classes & Files

### Backend

**`src/backend/services/tts/base.ts`**
- Interface definitions
- `TTSProvider` interface
- `TTSVoice` type
- `TTSOptions` type
- `TTSSettings` type

**`src/backend/services/tts/azure-provider.ts`** (NEW)
- Implements `TTSProvider`
- Azure Speech SDK integration
- SSML generation
- Voice fetching

**`src/backend/services/tts/manager.ts`**
- Manages all providers
- Voice routing logic
- Queue processing
- Chat message handling

**`src/backend/database/repositories/voices.ts`**
- Voice CRUD operations
- Voice sync logic
- Numeric ID management

**`src/backend/core/ipc-handlers.ts`**
- IPC handler registration
- Discord catalog generation
- Startup tasks

### Frontend

**`src/frontend/components/AzureSetupWizard.tsx`** (NEW)
- 7-step setup wizard
- Azure onboarding
- Credential validation

**`src/frontend/screens/tts/tts.tsx`**
- Voice Settings tab
- Viewers tab
- Azure credentials UI
- Voice picker with grouping

**`src/frontend/services/tts.ts`**
- Frontend TTS service
- IPC communication
- Web Speech API wrapper

---

## 🎨 UI Components

### Azure Setup Wizard States

```typescript
type WizardStep = 
  | 'introduction'
  | 'create-account'
  | 'create-resource'
  | 'get-credentials'
  | 'enter-credentials'
  | 'test-connection'
  | 'success';

interface WizardState {
  currentStep: WizardStep;
  apiKey: string;
  region: string;
  isLoading: boolean;
  error: string | null;
  canGoBack: boolean;
  canGoNext: boolean;
}
```

### Voice Picker Grouping

```tsx
<select value={selectedVoiceId} onChange={handleVoiceChange}>
  <optgroup label="🌐 Web Speech (Free)">
    {webSpeechVoices.map(v => (
      <option key={v.voice_id} value={v.voice_id}>
        {v.name}
      </option>
    ))}
  </optgroup>
  
  {azureConfigured && (
    <optgroup label="☁️ Azure Neural (API Key Required)">
      {azureVoices.map(v => (
        <option key={v.voice_id} value={v.voice_id}>
          {v.name}
        </option>
      ))}
    </optgroup>
  )}
</select>
```

### Provider Badge

```tsx
interface ProviderBadgeProps {
  provider: 'webspeech' | 'azure' | 'google';
}

const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider }) => {
  const icons = {
    webspeech: '🌐',
    azure: '☁️',
    google: '🔵'
  };
  
  const labels = {
    webspeech: 'Web Speech',
    azure: 'Azure Neural',
    google: 'Google WaveNet'
  };
  
  return (
    <span className={`provider-badge provider-${provider}`}>
      {icons[provider]} {labels[provider]}
    </span>
  );
};
```

---

## 🔌 Azure Speech SDK Usage

### Initialize

```typescript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region);
const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
```

### Get Voices

```typescript
const getVoices = (): Promise<TTSVoice[]> => {
  return new Promise((resolve, reject) => {
    synthesizer.getVoicesAsync(
      (result) => {
        if (result.reason === sdk.ResultReason.VoicesListRetrieved) {
          const voices = result.voices.map(v => ({
            id: `azure_${v.Locale}_${v.DisplayName}`,
            name: `${v.DisplayName} (Azure ${v.VoiceType})`,
            language: v.Locale,
            languageName: v.LocaleName,
            gender: v.Gender.toLowerCase() as 'male' | 'female',
            provider: 'azure' as const,
            styles: v.StyleList || []
          }));
          resolve(voices);
        } else {
          reject(new Error('Failed to retrieve voices'));
        }
      },
      (error) => reject(error)
    );
  });
};
```

### Speak with SSML

```typescript
const speak = (text: string, voiceName: string, options: TTSOptions): Promise<void> => {
  const ssml = buildSSML(text, voiceName, options);
  
  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve();
        } else {
          reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
        }
        result.close();
      },
      (error) => {
        reject(error);
      }
    );
  });
};
```

### Build SSML

```typescript
const buildSSML = (text: string, voiceName: string, options: TTSOptions): string => {
  const volume = options.volume ? `+${options.volume}%` : '+100%';
  const rate = options.rate?.toString() || '1.0';
  const pitchPercent = options.pitch ? `${(options.pitch - 1) * 100}%` : '+0%';
  
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceName}">
        <prosody rate="${rate}" pitch="${pitchPercent}" volume="${volume}">
          ${escapedText}
        </prosody>
      </voice>
    </speak>
  `.trim();
};
```

---

## 🗄️ Database Schema

### Voices Table (No changes needed!)

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

### Settings Table (Add Azure fields)

```sql
-- Existing fields:
tts_enabled INTEGER DEFAULT 1
tts_provider TEXT DEFAULT 'webspeech'
tts_voice_id TEXT
tts_volume INTEGER DEFAULT 100
tts_rate REAL DEFAULT 1.0
tts_pitch REAL DEFAULT 1.0

-- New fields (add via migration):
azure_api_key TEXT
azure_region TEXT DEFAULT 'eastus'
azure_last_sync TEXT
azure_usage_characters INTEGER DEFAULT 0
```

---

## 🧪 Testing Checklist

### Azure Provider Tests
- [ ] Initialize with valid credentials
- [ ] Initialize with invalid credentials
- [ ] Fetch voices successfully
- [ ] Handle API errors (401, 403, 500)
- [ ] Generate correct SSML
- [ ] Speak text successfully
- [ ] Handle network errors
- [ ] Stop speech correctly

### Manager Integration Tests
- [ ] Route webspeech_* to renderer
- [ ] Route azure_* to Azure provider
- [ ] Handle unknown voice ID prefix
- [ ] Resolve viewer custom voice (Web Speech)
- [ ] Resolve viewer custom voice (Azure)
- [ ] Queue processing with mixed providers
- [ ] Fallback when voice not found

### UI Tests
- [ ] Azure Setup Wizard navigation
- [ ] Wizard error handling
- [ ] Wizard progress saving
- [ ] Voice picker grouping
- [ ] Provider badges display
- [ ] Azure credentials form
- [ ] Test connection button
- [ ] Refresh voices button
- [ ] Usage meter display

### Integration Tests
- [ ] End-to-end: Chat → Web Speech
- [ ] End-to-end: Chat → Azure
- [ ] Mixed viewer voices
- [ ] Discord catalog update
- [ ] Startup voice sync
- [ ] Manual voice refresh

---

## 🐛 Common Issues & Solutions

### Issue: "Invalid API Key"
**Solution:**
1. Check key copied correctly (32 chars)
2. Verify using KEY 1 (not KEY 2)
3. Check for extra spaces
4. Regenerate key in Azure Portal

### Issue: "Wrong Region"
**Solution:**
1. Verify region matches Azure Portal
2. Check region dropdown selection
3. Common regions: eastus, westus, westeurope

### Issue: "Quota Exceeded"
**Solution:**
1. Check usage in Azure Portal
2. Wait for next billing cycle
3. Upgrade to paid tier
4. Use Web Speech as fallback

### Issue: "Voice Not Found"
**Solution:**
1. Refresh voice list
2. Check voice ID format
3. Verify Azure credentials still valid
4. Fallback to global default voice

### Issue: "Network Error"
**Solution:**
1. Check internet connection
2. Verify firewall not blocking
3. Check Azure status page
4. Retry after delay

---

## 📊 Monitoring & Metrics

### Track These Metrics
- Setup completion rate
- Azure adoption rate
- Voice usage by provider
- Free tier exhaustion rate
- API error rate
- Speech synthesis latency
- Queue length
- User satisfaction

### Logging Points
```typescript
console.log('[Azure] Initializing with region:', region);
console.log('[Azure] Fetched voices:', voices.length);
console.log('[Azure] Speaking with voice:', voiceName);
console.log('[Azure] SSML generated:', ssml);
console.log('[Azure] Synthesis completed');
console.error('[Azure] Error:', error.message);
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Build successful

### Deployment
- [ ] Create release branch
- [ ] Build production package
- [ ] Test production build
- [ ] Deploy to users
- [ ] Monitor for issues

### Post-Deployment
- [ ] Collect user feedback
- [ ] Monitor error logs
- [ ] Track adoption metrics
- [ ] Address critical bugs
- [ ] Plan next iteration

---

## 🔗 Useful Links

### Azure Documentation
- [Speech Services Overview](https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/)
- [Speech SDK Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/speech-sdk)
- [SSML Reference](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/speech-synthesis-markup)
- [Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)

### Development
- [Speech SDK npm package](https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk)
- [TypeScript Definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/microsoft-cognitiveservices-speech-sdk)

---

**Ready to start implementation! 🎉**

Next step: Begin Phase 0 - Create Azure Setup Wizard
