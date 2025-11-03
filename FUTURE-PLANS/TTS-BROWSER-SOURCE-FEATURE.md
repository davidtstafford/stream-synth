# TTS Browser Source Audio Feature

**Status:** 📋 Planned  
**Priority:** 🔥 High (Critical for OBS Integration)  
**Estimated Time:** 1-2 hours  
**Dependencies:** Event Actions Browser Source Server (✅ Complete)

---

## 📋 Overview

Enable TTS audio output to be captured by OBS via the existing Browser Source Server. This allows streamers to capture TTS chat readings in OBS without using virtual audio cables or complex audio routing.

### 🎯 User Goal

> "When TTS speaks a chat message in Stream Synth, I want OBS to also hear and capture that audio through a browser source."

---

## 🏗️ Architecture

### Current TTS Flow

```
Chat Message
    ↓
TTS Manager (handleChatMessage)
    ↓
Filter & Validate (200+ lines of logic)
    ↓
Queue System
    ↓
Speak Audio
    ↓
Output: App Only ❌ (OBS cannot capture)
```

### Proposed TTS Flow (with Browser Source)

```
Chat Message
    ↓
TTS Manager (handleChatMessage)
    ↓
Filter & Validate (reuse existing logic)
    ↓
Queue System
    ↓
Speak Audio
    ↓
Output: App + Browser Source ✅
         ↓
    Browser Source Server (Socket.IO)
         ↓
    OBS Browser Source (Web Speech API)
```

---

## 🎨 UI Design: Voice Settings Tab Integration

**Location:** `src/frontend/screens/tts/tabs/VoiceSettingsTab.tsx`

**Add New Section After "TTS Providers":**

```tsx
{/* Browser Source Audio Output - NEW SECTION */}
<div className="setting-group" style={{ marginTop: '20px' }}>
  <label className="setting-label">
    🎥 OBS Browser Source Integration
    <span className="setting-hint" style={{ display: 'block', fontWeight: 'normal', fontSize: '0.9em', marginTop: '5px' }}>
      Output TTS audio to OBS via browser source (no virtual audio cables needed)
    </span>
  </label>

  <div style={{
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    border: '1px solid #555',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  }}>
    {/* Enable Toggle */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={settings.browserSourceEnabled ?? false}
          onChange={(e) => onSettingChange('browserSourceEnabled', e.target.checked)}
        />
        <span className="checkbox-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
          Enable TTS in Browser Source
        </span>
      </label>
    </div>

    {/* Browser Source URL */}
    {settings.browserSourceEnabled && (
      <>
        <div>
          <label className="setting-label" style={{ marginBottom: '8px', display: 'block' }}>
            Browser Source URL:
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value="http://localhost:7474/alert"
              readOnly
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '0.95em'
              }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText('http://localhost:7474/alert');
                // Show toast notification
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: '#28a745',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              📋 Copy URL
            </button>
            <button
              onClick={async () => {
                // Test TTS in browser source
                await onTestVoice();
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: '#0078d4',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              🔊 Test
            </button>
          </div>
        </div>

        {/* Setup Instructions */}
        <div style={{
          padding: '12px',
          backgroundColor: '#1f3a5f',
          borderLeft: '4px solid #0078d4',
          borderRadius: '4px',
          fontSize: '0.9em',
          lineHeight: '1.6'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            📝 How to Add to OBS:
          </div>
          <ol style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Copy the URL above</li>
            <li>In OBS, add a new <strong>Browser</strong> source</li>
            <li>Paste the URL into the <strong>URL</strong> field</li>
            <li>Set width to <strong>1920</strong> and height to <strong>1080</strong></li>
            <li>✅ Click OK - TTS audio will now play through OBS!</li>
          </ol>
        </div>

        {/* Quality Notice */}
        <div style={{
          padding: '10px',
          backgroundColor: '#3a2a1a',
          borderLeft: '4px solid #ffa500',
          borderRadius: '4px',
          fontSize: '0.85em',
          lineHeight: '1.5'
        }}>
          <strong>⚠️ Note:</strong> Browser source uses Web Speech API for audio output.
          For best quality TTS in the app, continue using your configured provider (Azure/Google).
          OBS will capture the browser's Web Speech output.
        </div>

        {/* Advanced Settings (Collapsed by default) */}
        <details style={{ marginTop: '10px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 'bold',
            padding: '8px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            userSelect: 'none'
          }}>
            ⚙️ Advanced Settings
          </summary>
          <div style={{ 
            marginTop: '10px',
            padding: '12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            border: '1px solid #444'
          }}>
            {/* Browser Source Voice Override */}
            <div style={{ marginBottom: '12px' }}>
              <label className="setting-label">
                Browser Source Voice (Optional Override):
              </label>
              <select
                value={settings.browserSourceVoiceId || ''}
                onChange={(e) => onSettingChange('browserSourceVoiceId', e.target.value)}
                className="voice-select"
              >
                <option value="">Use Default Voice</option>
                {voiceGroups
                  .filter(g => g.voices.some(v => v.provider === 'webspeech'))
                  .map(group => (
                    <optgroup key={group.category} label={group.category}>
                      {group.voices
                        .filter(v => v.provider === 'webspeech')
                        .map(voice => (
                          <option key={voice.voice_id} value={voice.voice_id}>
                            {formatVoiceOption(voice)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
              <span className="setting-hint">
                Override the voice used only for browser source output (useful for testing)
              </span>
            </div>

            {/* Browser Source Volume Override */}
            <div>
              <label className="setting-label">
                Browser Source Volume: {settings.browserSourceVolume ?? 100}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.browserSourceVolume ?? 100}
                onChange={(e) => onSettingChange('browserSourceVolume', parseInt(e.target.value))}
                className="slider"
              />
              <span className="setting-hint">
                Adjust volume for browser source output only (doesn't affect in-app TTS)
              </span>
            </div>
          </div>
        </details>
      </>
    )}
  </div>
</div>
```

---

## 🔧 Implementation Details

### Phase 1: Database Schema (5 min)

**File:** `src/backend/database/migrations.ts`

```typescript
// Add to TTS settings table
ALTER TABLE tts_settings ADD COLUMN browser_source_enabled INTEGER DEFAULT 0;
ALTER TABLE tts_settings ADD COLUMN browser_source_voice_id TEXT DEFAULT NULL;
ALTER TABLE tts_settings ADD COLUMN browser_source_volume INTEGER DEFAULT 100;
```

### Phase 2: TTS Manager Integration (15 min)

**File:** `src/backend/services/tts/manager.ts`

```typescript
export class TTSManager {
  private browserSourceServer: BrowserSourceServer | null = null;

  /**
   * Set browser source server for audio mirroring
   */
  setBrowserSourceServer(server: BrowserSourceServer): void {
    this.browserSourceServer = server;
    console.log('[TTS Manager] Browser source server connected');
  }

  /**
   * Process queue and emit to browser source
   */
  private async processQueue(): Promise<void> {
    // ... existing queue processing ...
    
    const item = this.messageQueue.shift()!;
    
    // 🆕 Emit to browser source if enabled
    if (this.settings?.browserSourceEnabled && this.browserSourceServer) {
      this.emitToBrowserSource(item);
    }
    
    // ... existing speak logic ...
  }

  /**
   * Emit TTS audio to browser source
   */
  private emitToBrowserSource(item: TTSQueueItem): void {
    if (!this.browserSourceServer) return;

    const payload = {
      type: 'tts',
      text: item.message,
      username: item.username,
      voice: this.settings?.browserSourceVoiceId || item.voiceId,
      pitch: item.pitch || 1.0,
      rate: item.rate || 1.0,
      volume: (this.settings?.browserSourceVolume ?? 100) / 100,
      timestamp: item.timestamp
    };

    console.log('[TTS Manager] Emitting to browser source:', payload);
    this.browserSourceServer.io.emit('tts', payload);
  }
}
```

### Phase 3: Browser Source Client (10 min)

**File:** `src/backend/public/browser-source.js`

```javascript
class BrowserSourceClient {
  init() {
    // ... existing initialization ...
    
    // Listen for TTS events
    this.socket.on('tts', (data) => this.handleTTS(data));
  }

  /**
   * Handle TTS audio event
   */
  handleTTS(data) {
    console.log('[BrowserSource] TTS received:', data.username, '-', data.text);
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(data.text);
    
    // Match voice if available
    const voices = window.speechSynthesis.getVoices();
    if (data.voice && data.voice.startsWith('webspeech_')) {
      const voiceName = data.voice.replace('webspeech_', '');
      const voice = voices.find(v => v.name === voiceName);
      if (voice) {
        utterance.voice = voice;
        console.log('[BrowserSource] Using voice:', voice.name);
      }
    }
    
    // Apply audio settings
    utterance.pitch = data.pitch || 1.0;
    utterance.rate = data.rate || 1.0;
    utterance.volume = data.volume || 1.0;
    
    // Speak
    window.speechSynthesis.speak(utterance);
    
    // Update debug stats
    if (this.debugMode) {
      this.alertCount++;
      this.updateDebugUI();
    }
  }
}
```

### Phase 4: Settings Integration (10 min)

**File:** `src/backend/services/tts/settings-mapper.ts`

```typescript
export class SettingsMapper {
  static fromDatabase(dbSettings: any): TTSSettings {
    return {
      // ... existing settings ...
      browserSourceEnabled: dbSettings.browser_source_enabled === 1,
      browserSourceVoiceId: dbSettings.browser_source_voice_id || null,
      browserSourceVolume: dbSettings.browser_source_volume || 100,
    };
  }

  static toDatabase(settings: Partial<TTSSettings>): any {
    return {
      // ... existing settings ...
      browser_source_enabled: settings.browserSourceEnabled ? 1 : 0,
      browser_source_voice_id: settings.browserSourceVoiceId || null,
      browser_source_volume: settings.browserSourceVolume ?? 100,
    };
  }
}
```

### Phase 5: TypeScript Interfaces (5 min)

**File:** `src/frontend/services/tts.ts`

```typescript
export interface TTSSettings {
  // ... existing settings ...
  
  // Browser Source Integration
  browserSourceEnabled?: boolean;
  browserSourceVoiceId?: string | null;
  browserSourceVolume?: number;
}
```

### Phase 6: Main Initialization (5 min)

**File:** `src/backend/main.ts`

```typescript
// After TTS manager initialization
const ttsManager = await getTTSManager();

// Inject browser source server
if (browserSourceServer && ttsManager) {
  ttsManager.setBrowserSourceServer(browserSourceServer);
  console.log('[Main] Browser source server injected into TTS manager');
}
```

---

## 🧪 Testing Checklist

### Setup Testing
- [ ] Enable "Browser Source" toggle in TTS settings
- [ ] Copy URL shows correct address
- [ ] Add browser source to OBS with URL
- [ ] Browser source connects (check console logs)

### Audio Testing
- [ ] Send test chat message in app
- [ ] TTS speaks in Stream Synth app ✅
- [ ] TTS audio also plays in OBS browser source ✅
- [ ] Audio quality is acceptable
- [ ] Volume control works in browser source

### Edge Cases
- [ ] Disable browser source → audio stops in OBS
- [ ] Change voice → browser source uses new voice
- [ ] Adjust volume → browser source volume changes
- [ ] Multiple messages → queue works correctly
- [ ] Browser source disconnects → no errors in app

### Integration Testing
- [ ] TTS filters still apply (blocked words, length limits, etc.)
- [ ] Access control rules still work (mutes, cooldowns)
- [ ] Viewer-specific voices work correctly
- [ ] App TTS quality unchanged (still uses Azure/Google)

---

## 📊 Success Metrics

### User Experience
- ✅ No virtual audio cables needed
- ✅ One-click browser source setup
- ✅ Audio synchronized with app TTS
- ✅ Works with existing TTS configuration

### Technical Quality
- ✅ Reuses existing browser source infrastructure
- ✅ No duplicate filtering logic
- ✅ Minimal performance impact
- ✅ Clean separation of concerns

---

## 🚀 Deployment Steps

1. **Database Migration**
   - Add browser source columns to `tts_settings` table
   - Default: disabled for existing users

2. **Backend Updates**
   - Update TTS Manager with browser source integration
   - Update browser source client with TTS handler
   - Update settings mapper

3. **Frontend Updates**
   - Add browser source section to Voice Settings tab
   - Add TypeScript interface properties
   - Update IPC handlers

4. **Testing**
   - Verify in local OBS instance
   - Test with real chat messages
   - Validate audio quality

5. **Documentation**
   - Update README with browser source TTS setup
   - Create visual guide (screenshots)
   - Add troubleshooting section

---

## 💡 Future Enhancements

### Phase 2 Improvements (Optional)

1. **Multiple Browser Sources**
   - Channel-based routing (like Event Actions)
   - Separate TTS sources for different purposes

2. **Visual Indicators**
   - Show speaking username on screen
   - Animated waveforms
   - Queue visualization

3. **Audio Effects**
   - Reverb/echo effects
   - Voice modulation
   - Background music mixing

4. **Smart Fallback**
   - If Web Speech unavailable, show text overlay
   - Automatic voice selection based on availability

---

## 📝 Notes

### Why This Approach?

1. **Leverages Existing Infrastructure**
   - Browser Source Server already running ✅
   - Socket.IO connection established ✅
   - No new dependencies needed ✅

2. **Maintains TTS Quality**
   - App continues using Azure/Google for premium voices
   - Browser source uses Web Speech API (acceptable quality)
   - Users get best of both worlds

3. **User-Friendly**
   - Simple checkbox to enable
   - Copy-paste URL into OBS
   - No complex audio routing

4. **Architecturally Sound**
   - TTS Manager remains single source of truth
   - Browser source is just another output channel
   - Clean separation of concerns

### Why NOT Part of Event Actions?

- TTS has complex filtering/validation logic (200+ lines)
- TTS has its own queue and processing system
- TTS has viewer-specific rules (mutes, cooldowns, custom voices)
- TTS is triggered by chat, not EventSub events
- TTS is a real-time audio stream, not discrete alerts

**TTS is better as a parallel feature sharing the browser source infrastructure.**

---

## ✅ Ready to Implement

This feature is **well-scoped** and **ready for development**:
- Clear requirements ✅
- Architecture defined ✅
- UI mockup complete ✅
- Implementation plan detailed ✅
- Testing strategy defined ✅

**Estimated Time:** 1-2 hours  
**Complexity:** Low-Medium  
**Impact:** High (Critical for streamers)

---

**Let's build this after Event Actions Phase 12 is complete!** 🚀
