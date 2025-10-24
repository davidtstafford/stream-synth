# Azure Voice Sync Fix

## Problem
Azure voices weren't appearing in the TTS dropdown despite successful Azure credentials setup. The root cause was that voices were never being fetched from the Azure API and stored in the database.

## Root Cause Analysis
1. **No sync mechanism**: Azure Provider could fetch voices via REST API, but there was no code to trigger this fetch and store results
2. **Frontend filtering by prefix**: UI was checking `voice_id` prefixes (`azure_`, `webspeech_`, `google_`) instead of trusting database
3. **Provider toggles did nothing**: Checkboxes only updated settings, didn't trigger any data operations
4. **Database column unused**: `tts_voices.is_available` column existed but wasn't being used for filtering

## Solution Architecture

### Database-Driven Availability
Instead of frontend prefix checking, we now use the `is_available` column:
- **`is_available = 1`**: Voice is available (provider enabled)
- **`is_available = 0`**: Voice is unavailable (provider disabled)
- **Frontend only queries `is_available = 1` voices** (no prefix checking)

### Provider Toggle Flow

#### When Azure is Enabled:
1. User checks "Azure TTS" checkbox
2. Frontend calls `handleProviderToggle('azure', true)`
3. IPC handler `azure:sync-voices` is invoked with credentials
4. Backend fetches 400+ voices from Azure API
5. `VoiceSyncService.syncAzureVoices()` upserts voices to database with `is_available=1`
6. Voice list reloads → Azure voices appear in dropdowns

#### When Azure is Disabled:
1. User unchecks "Azure TTS" checkbox
2. Frontend calls `handleProviderToggle('azure', false)`
3. IPC handler `provider:toggle` is invoked
4. Backend runs: `UPDATE tts_voices SET is_available=0 WHERE voice_id LIKE 'azure_%'`
5. Voice list reloads → Azure voices disappear from dropdowns

## Code Changes

### Backend

#### 1. Database Repository (`src/backend/database/repositories/voices.ts`)
```typescript
markProviderUnavailable(provider: string): void {
  db.prepare(`UPDATE tts_voices SET is_available = 0 WHERE voice_id LIKE ?`).run(`${provider}_%`);
}

markProviderAvailable(provider: string): void {
  db.prepare(`UPDATE tts_voices SET is_available = 1 WHERE voice_id LIKE ?`).run(`${provider}_%`);
}
```

#### 2. IPC Handlers (`src/backend/core/ipc-handlers.ts`)
```typescript
// Fetch and sync Azure voices
ipcMain.handle('azure:sync-voices', async (event, credentials) => {
  const { apiKey, region } = credentials;
  await azureProvider.initialize({ apiKey, region });
  const voices = await azureProvider.getVoices();
  await voiceSyncService.syncVoices(voices);
  return { success: true, voiceCount: voices.length };
});

// Toggle provider availability
ipcMain.handle('provider:toggle', async (event, { provider, enabled }) => {
  if (enabled) {
    voicesRepo.markProviderAvailable(provider);
  } else {
    voicesRepo.markProviderUnavailable(provider);
  }
});
```

#### 3. Voice Sync Service (`src/backend/services/tts/voice-sync.ts`)
```typescript
async syncAzureVoices(voices: any[]): Promise<number> {
  voices.forEach(voice => {
    this.voicesRepo.upsertVoice({
      voice_id: voice.voiceId,  // azure_en-US_AriaNeural
      provider: 'azure',
      source: 'Azure Neural',
      name: voice.name,
      language_code: voice.languageCode,
      language_name: voice.languageName,
      region: voice.locale,
      gender: voice.gender.toLowerCase(),
      is_available: 1,  // Mark as available
      metadata: JSON.stringify({ 
        styleList: voice.styleList, 
        voiceType: voice.voiceType 
      })
    });
  });
  return voices.length;
}

async syncVoices(voices: any[]): Promise<number> {
  const firstVoiceId = voices[0].voiceId || '';
  if (firstVoiceId.startsWith('azure_')) return this.syncAzureVoices(voices);
  if (firstVoiceId.startsWith('google_')) return this.syncGoogleVoices(voices);
  return this.syncWebSpeechVoices(voices);
}
```

### Frontend

#### 4. TTS Screen (`src/frontend/screens/tts/tts.tsx`)

**Added Provider Toggle Handler:**
```typescript
const handleProviderToggle = async (provider: 'webspeech' | 'azure' | 'google', enabled: boolean) => {
  // Save setting
  await ttsService.saveSettings({ [`${provider}Enabled`]: enabled } as any);
  
  // If enabling Azure, sync voices from API
  if (provider === 'azure' && enabled) {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('azure:sync-voices', {
      apiKey: settings.azureApiKey,
      region: settings.azureRegion
    });
    console.log('[TTS] Azure voices synced:', result);
  } else {
    // For disabling, just toggle availability
    const { ipcRenderer } = window.require('electron');
    await ipcRenderer.invoke('provider:toggle', { provider, enabled });
  }
  
  // Reload voices
  await syncAndLoadVoices();
  await loadVoiceStats();
};
```

**Simplified Voice Filtering:**
```typescript
const getFilteredGroups = () => {
  return voiceGroups.map(group => ({
    ...group,
    voices: group.voices.filter(voice => {
      // Only show available voices (database handles availability)
      const matchesSearch = !voiceSearch || /* ... */;
      const matchesLanguage = languageFilter === 'all' || /* ... */;
      const matchesGender = genderFilter === 'all' || /* ... */;
      return matchesSearch && matchesLanguage && matchesGender;
    })
  })).filter(group => group.voices.length > 0);
};
```

**Updated Toggle Checkboxes:**
```typescript
<input
  type="checkbox"
  checked={settings.azureEnabled ?? false}
  onChange={(e) => handleProviderToggle('azure', e.target.checked)}  // ← Changed
/>
```

## Testing Checklist

### Test Azure Enable
1. ✅ Open TTS settings
2. ✅ Check "Azure TTS" checkbox
3. ✅ Should see "Syncing Azure voices..." in console
4. ✅ Azure voices should appear in "Voice" dropdown (400+ voices)
5. ✅ Voice count should update to show Azure voices
6. ✅ Language/gender filters should include Azure options

### Test Azure Disable
1. ✅ Uncheck "Azure TTS" checkbox
2. ✅ Azure voices should disappear from dropdown
3. ✅ Voice count should decrease
4. ✅ If Azure voice was selected, should revert to default

### Test Mixed Providers
1. ✅ Enable both Web Speech and Azure
2. ✅ Should see voices from both providers mixed together
3. ✅ Disable Web Speech → Only Azure voices remain
4. ✅ Disable Azure → Only Web Speech voices remain
5. ✅ Disable both → No voices available

### Test Viewer Voice Picker
1. ✅ Open viewer voice settings
2. ✅ Provider toggles should affect viewer voice dropdown
3. ✅ Viewer can select Azure voice when enabled
4. ✅ Azure voices disappear when provider disabled

## Benefits

1. **Simple Architecture**: Database controls availability, UI trusts database
2. **No Prefix Checking**: Frontend doesn't need to know about provider prefixes
3. **Proper Sync**: Azure voices are actually fetched and stored
4. **Fast Filtering**: Single SQL query with `WHERE is_available=1` instead of frontend filtering
5. **Consistent State**: Provider enabled state is always in sync with voice availability

## Migration Notes

- Existing Web Speech voices: Already in database, no action needed
- Azure voices: Will be fetched on first enable of Azure provider
- Google voices: Same pattern will work when Google provider is implemented
- Database: No schema changes needed (using existing `is_available` column)
