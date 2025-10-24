# Azure Voice Sync - Actual Fix

## The Real Bugs

After implementing the infrastructure, there were **3 critical bugs** preventing Azure voices from appearing:

### Bug 1: Property Name Mismatch
**Problem**: Azure provider returns `TTSVoice` objects with `id` property, but voice sync was looking for `voiceId`
**Location**: `src/backend/services/tts/voice-sync.ts`
**Fix**: Changed all references from `voice.voiceId` to `voice.id`

```typescript
// BEFORE (wrong)
const firstVoiceId = voices[0].voiceId || '';

// AFTER (correct)
const firstVoiceId = voices[0].id || '';
```

### Bug 2: Web Speech Sync Marking ALL Voices Unavailable
**Problem**: Every time the UI loaded, it synced Web Speech voices and called `markUnavailable()` which marked ALL voices not in the Web Speech list as unavailable - including Azure voices that were just added!

**Location**: 
- `src/backend/database/repositories/voices.ts`
- `src/backend/services/tts/voice-sync.ts`

**Fix**: Created provider-specific `markUnavailableExcept()` method that only marks voices from the same provider as unavailable:

```typescript
// NEW METHOD - Only marks voices from specific provider
markUnavailableExcept(provider: string, currentVoiceIds: string[]): void {
  const db = getDatabase();
  const placeholders = currentVoiceIds.map(() => '?').join(',');
  db.prepare(`
    UPDATE tts_voices 
    SET is_available = 0 
    WHERE voice_id LIKE ? AND voice_id NOT IN (${placeholders})
  `).run(`${provider}_%`, ...currentVoiceIds);
}
```

### Bug 3: Frontend Re-Syncing Web Speech on Every Load
**Problem**: The `syncAndLoadVoices()` function was:
1. Getting Web Speech voices from browser
2. Syncing them to database (marking Azure as unavailable)
3. Then loading from database

This happened EVERY time the UI loaded or refreshed!

**Location**: `src/frontend/screens/tts/tts.tsx`

**Fix**: Changed `syncAndLoadVoices()` to ONLY load from database, never sync:

```typescript
// BEFORE - Was syncing then loading (BAD!)
const syncAndLoadVoices = async (currentSettings?: ttsService.TTSSettings) => {
  const rawVoices = await ttsService.getVoices();
  await ttsService.syncVoices(settingsToUse.provider, plainVoices); // ← Marking Azure unavailable!
  const grouped = await ttsService.getGroupedVoices();
  setVoiceGroups(groupArray);
};

// AFTER - Just load from database (GOOD!)
const syncAndLoadVoices = async (currentSettings?: ttsService.TTSSettings) => {
  const grouped = await ttsService.getGroupedVoices();
  setVoiceGroups(groupArray);
};
```

## The Correct Flow Now

### App Startup
1. Web Speech voices synced once at startup
2. Only Web Speech voices marked as unavailable if not in current system list
3. Azure voices remain untouched

### When User Enables Azure
1. `handleProviderToggle('azure', true)` called
2. IPC handler `azure:sync-voices` invoked
3. Backend fetches 603 voices from Azure API
4. `syncAzureVoices()` inserts/updates voices with `is_available=1`
5. No `markUnavailable()` call - Azure voices stay available
6. Frontend calls `syncAndLoadVoices()` which loads from DB
7. UI shows both Web Speech + Azure voices

### When User Disables Azure
1. `handleProviderToggle('azure', false)` called
2. IPC handler `provider:toggle` invoked
3. Backend runs: `UPDATE tts_voices SET is_available=0 WHERE voice_id LIKE 'azure_%'`
4. Frontend calls `syncAndLoadVoices()` which loads from DB
5. UI shows only Web Speech voices

### When User Refreshes UI / Changes Filters
1. Frontend calls `syncAndLoadVoices()`
2. Only loads from database - NO syncing!
3. UI updates with currently available voices

## Files Changed

### 1. `src/backend/database/repositories/voices.ts`
- Added `markUnavailableExcept(provider, voiceIds)` - provider-specific unavailable marking
- Kept old `markUnavailable()` for backwards compatibility (marked as deprecated)

### 2. `src/backend/services/tts/voice-sync.ts`
- Fixed `syncVoices()` to check `voice.id` instead of `voice.voiceId`
- Fixed `syncAzureVoices()` to use correct property names from `TTSVoice` interface
- Changed `syncWebSpeechVoices()` to call `markUnavailableExcept('webspeech', voiceIds)`

### 3. `src/frontend/screens/tts/tts.tsx`
- Removed all voice syncing logic from `syncAndLoadVoices()`
- Function now only loads from database (no side effects)
- Voice syncing happens ONLY via provider toggle handlers

## Testing

After these fixes:

1. ✅ Enable Azure → 603 voices added to database → appear in dropdown
2. ✅ Disable Azure → Azure voices marked unavailable → disappear from dropdown
3. ✅ Enable both → All voices from both providers appear
4. ✅ Refresh UI → Voices persist correctly (no re-syncing)
5. ✅ Web Speech stays working independently

## The Root Cause

The original architecture had voice syncing mixed with voice loading, causing:
- **Sync pollution**: Web Speech sync marking other providers unavailable
- **Repeated syncing**: Every UI load re-synced Web Speech
- **Lost state**: Azure voices added then immediately marked unavailable

The fix **separates concerns**:
- **Syncing**: Only happens at startup (Web Speech) or when provider enabled (Azure/Google)
- **Loading**: Just reads from database, no side effects
- **Provider isolation**: Each provider's sync only affects its own voices
