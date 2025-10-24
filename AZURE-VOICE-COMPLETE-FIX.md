# Complete Azure Voice Fix - Final

## All Issues Fixed

### Issue 1: Provider Detection in Frontend
**Problem**: When testing Azure voice, frontend was checking `settings.provider` (legacy single-provider mode) which was still set to `webspeech`, so it tried to use Web Speech API for Azure voices.

**Fix**: Changed frontend `speak()` to detect provider from voice ID prefix instead of settings.
```typescript
// BEFORE
if (settings.provider === 'webspeech') { ... }

// AFTER
const isAzureVoice = voiceId?.startsWith('azure_');
const isGoogleVoice = voiceId?.startsWith('google_');
if (!isAzureVoice && !isGoogleVoice) { // use webspeech }
```

### Issue 2: Voice ID Not Resolved in Backend
**Problem**: When chat messages came in, `processQueue()` was calling Azure provider directly with our internal voice ID (`azure_af-ZA_Willem`) instead of Azure's actual voice name (`af-ZA-WillemNeural`).

**Fix**: Created `resolveVoiceId()` helper method that looks up voice metadata and returns the `shortName`. Used this in:
- `speak()` method
- `testVoice()` method
- `processQueue()` method

```typescript
private resolveVoiceId(voiceId: string): string {
  if (voiceId?.startsWith('azure_')) {
    const voiceRecord = this.voicesRepo.getVoiceById(voiceId);
    if (voiceRecord?.metadata) {
      const metadata = JSON.parse(voiceRecord.metadata);
      if (metadata.shortName) {
        return metadata.shortName; // e.g., "af-ZA-WillemNeural"
      }
    }
  }
  return voiceId;
}
```

### Issue 3: ShortName Not Stored in Database
**Problem**: Azure voices were synced without storing the full Azure voice name (`shortName`) in metadata, so we couldn't look it up later.

**Fix**: 
1. Added `shortName` property to `TTSVoice` interface
2. Azure provider now includes `shortName` when mapping voices
3. Voice sync stores `shortName` in metadata JSON

```typescript
// In azure-provider.ts
return {
  id: voiceId,  // azure_en-US_Aria
  name: `${displayName} (Azure ${voiceType})`,
  language: voice.Locale,
  languageName: voice.LocaleName || voice.Locale,
  gender,
  provider: 'azure',
  styles: voice.StyleList || [],
  shortName: voice.ShortName  // "en-US-AriaNeural"
};

// In voice-sync.ts
metadata: JSON.stringify({ 
  styles: voice.styles || [],
  shortName: voice.shortName  // Stored for lookup
})
```

### Issue 4: Azure Provider Generating Invalid SSML
**Problem**: `generateSSML()` was trying to reconstruct the voice name from our internal ID, always assuming "Neural", which was incorrect.

**Fix**: Since we now pass the resolved `shortName` directly, simplified `generateSSML()` to use the voice name as-is:

```typescript
// BEFORE - Reconstructing incorrectly
const parts = voiceId.replace('azure_', '').split('_');
const fullVoiceName = `${locale}-${voiceName}Neural`; // WRONG!

// AFTER - Using the actual Azure voice name
private generateSSML(text: string, voiceId: string, options?: TTSOptions): string {
  // voiceId is now the full Azure ShortName (e.g., "en-US-AriaNeural")
  const localeParts = voiceId.split('-');
  const locale = localeParts.length >= 2 ? `${localeParts[0]}-${localeParts[1]}` : 'en-US';
  
  return `<speak version="1.0" xmlns="..." xml:lang="${locale}">
    <voice name="${voiceId}">...</voice>
  </speak>`;
}
```

## Complete Flow Now

### Test Voice Button Flow:
1. User selects Azure voice `azure_en-US_Aria` from dropdown
2. Clicks "Test Voice"
3. Frontend `speak()` checks if voice starts with `azure_` → uses backend
4. Backend receives `azure_en-US_Aria`
5. `testVoice()` calls `resolveVoiceId()` → looks up metadata → returns `en-US-AriaNeural`
6. Azure provider receives `en-US-AriaNeural`
7. `generateSSML()` creates valid SSML with `<voice name="en-US-AriaNeural">`
8. Azure API accepts it and speaks! ✅

### Chat Message Flow:
1. Chat message arrives
2. `processQueue()` gets `voiceId` from viewer rules or default settings
3. Calls `resolveVoiceId(azure_en-US_Aria)` → returns `en-US-AriaNeural`
4. Passes resolved name to Azure provider
5. Azure speaks successfully! ✅

## Files Changed

1. **src/backend/services/tts/base.ts**
   - Added `shortName?: string` to `TTSVoice` interface

2. **src/backend/services/tts/azure-provider.ts**
   - Added `shortName: voice.ShortName` when mapping voices
   - Simplified `generateSSML()` to use voice name directly

3. **src/backend/services/tts/voice-sync.ts**
   - Store `shortName` in metadata when syncing Azure voices

4. **src/backend/services/tts/manager.ts**
   - Added `resolveVoiceId()` helper method
   - Updated `speak()` to use `resolveVoiceId()`
   - Updated `testVoice()` to use `resolveVoiceId()`
   - Updated `processQueue()` to use `resolveVoiceId()`

5. **src/frontend/services/tts.ts**
   - Changed `speak()` to detect provider from voice ID prefix instead of settings

## Testing

You **MUST** re-sync Azure voices for the fix to work:
1. Restart app
2. Disable Azure (if enabled)
3. Re-enable Azure → This fetches voices with new `shortName` in metadata
4. Select an English Azure voice
5. Click "Test Voice" → Should speak! 🎉
6. Send chat message → Should speak! 🎉
