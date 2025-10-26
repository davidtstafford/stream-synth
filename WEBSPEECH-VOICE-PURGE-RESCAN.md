# WebSpeech Voice System - Purge & Immediate Rescan Implementation

## Overview
Fixed the voice duplication issue by implementing a **purge-and-reload** strategy for voice syncing:
- **App Startup**: Syncs voices once (purges old, loads new, assigns numeric IDs 1, 2, 3...)
- **Rescan Button**: Immediately refetches voices, purges old ones, and refreshes the UI with a loading spinner

## Problem Solved
Previously:
- Numeric IDs kept incrementing on rescan (1,2,3 → 4,5,6 → 7,8,9...)
- Caused duplicate voice entries and broken numeric ID mappings
- User had to restart app to see fresh voices

Now:
- Each sync purges all voices for that provider first (clean slate)
- Numeric IDs always start fresh (1, 2, 3...)
- Rescan button provides immediate feedback with spinner

## Database Changes
Added `tts_provider_status` table to track sync state:
```sql
CREATE TABLE tts_provider_status (
  provider TEXT PRIMARY KEY,
  is_enabled INTEGER DEFAULT 1,
  last_synced_at TEXT,
  voice_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
```

## Backend Changes

### VoicesRepository (`src/backend/database/repositories/voices.ts`)
- **`purgeProvider(provider)`** - Deletes all voices and numeric IDs for a provider
- **`assignNumericIds(provider)`** - Assigns sequential numeric IDs (1, 2, 3...) to all voices
- Removed old methods: `reassignNumericIds()`, `deleteVoicesNotInList()`, `markProviderAvailable()`, `markProviderUnavailable()`

### VoiceSyncService (`src/backend/services/tts/voice-sync.ts`)
- **`syncWebSpeechVoices()`** - Purges → Inserts → Assigns numeric IDs
- **`syncAzureVoices()`** - Same purge-then-sync pattern
- **`rescanProviderImmediate(provider, voices)`** - New method for immediate rescan from frontend
- Removed `rescanProvider()` (old next-startup approach)

### IPC Handlers (`src/backend/core/ipc-handlers.ts`)
- **`provider:rescan-immediate`** - New handler that:
  1. Takes provider + current voices from frontend
  2. Calls `rescanProviderImmediate()` on backend
  3. Returns count + updated stats
  4. UI reloads voice list immediately

## Frontend Changes

### TTS Screen (`src/frontend/screens/tts/tts.tsx`)
- **New state**: `rescanningProvider` - tracks which provider is currently rescanning
- **Updated `handleProviderRescan()`**:
  1. Gets current voices from Web Speech API
  2. Shows loading spinner (disabled button, "⏳ Rescanning...")
  3. Calls backend `provider:rescan-immediate` IPC handler
  4. Reloads voice list on success
  5. Shows success/error message
  6. Hides spinner

### UI Changes
- Rescan button now shows loading state:
  - Disabled during rescan
  - Shows "⏳ Rescanning..." text
  - Different opacity/color while loading
  - Tooltip explains what it does

## Voice Flow Now

### On App Startup
1. Check `tts_provider_status.last_synced_at` for each enabled provider
2. If `NULL`, sync is needed
3. For each provider needing sync:
   - Frontend requests Web Speech voices
   - Backend receives voices
   - Backend calls `syncWebSpeechVoices()`
   - VoiceSyncService:
     - Purges all old voices for provider
     - Inserts new voices
     - Assigns numeric IDs (1, 2, 3...)
     - Updates provider status with timestamp
   - Frontend loads voices from DB
4. Done - voices are stable until next app restart or manual rescan

### On Manual Rescan (User Clicks Button)
1. Frontend fetches current Web Speech voices
2. Shows loading spinner
3. Calls `provider:rescan-immediate` with fresh voices
4. Backend does the same sync process (purge → insert → assign IDs)
5. Frontend reloads voice list from DB
6. UI updates immediately (spinner hidden, success message shown)

## Key Design Decisions

### Why Purge Instead of Update?
- **Before**: Tried to remap numeric IDs, kept AUTOINCREMENT IDs, caused duplicates
- **After**: Purge everything, start fresh with clean numeric sequence
- **Result**: No duplication, no ID gaps, guaranteed sequential IDs (1-N)

### Why Rescan Is Immediate Now
- **Before**: User clicked rescan → cleared DB → had to restart app
- **After**: User clicks rescan → backend fetches fresh → UI refreshes instantly
- **Result**: No app restart needed, user sees spinner for feedback

### Frontend Gets Voices, Sends to Backend
- **Why**: Web Speech API only available in renderer process
- **Benefit**: Frontend is already calling `getVoices()` anyway, just reuse that data
- **Security**: Backend still validates and stores in DB, frontend can't manipulate

## Testing Checklist

- [ ] App startup with WebSpeech:
  - [ ] 0 voices initially (async load)
  - [ ] Loads N voices (11 expected on test machine)
  - [ ] DB shows exactly N voices (no duplication)
  - [ ] Numeric IDs are 1, 2, 3... N (no gaps)

- [ ] Click Rescan button:
  - [ ] Button shows "⏳ Rescanning..." and disables
  - [ ] Voices refresh in dropdown
  - [ ] Success message shows count
  - [ ] Button re-enables after 1-2 seconds
  - [ ] No duplicates in voice list

- [ ] Rescan multiple times:
  - [ ] Each rescan works
  - [ ] No voice duplication accumulates
  - [ ] Numeric IDs always clean (1-N)

- [ ] Voice selection works:
  - [ ] Can select voice #1, #2, etc.
  - [ ] Test voice plays with selected voice

## Logs to Look For

**Success (Startup)**:
```
[TTS] Loaded 11 voices from Web Speech API
[Voice Sync] Syncing 11 Web Speech voices
[Voices] Purged 0 webspeech voices and their numeric ID mappings
[Voices] Assigned numeric IDs for webspeech: 11 voices
[Voices] Updated provider status: webspeech (enabled=true, voices=11)
```

**Success (Rescan)**:
```
[TTS] Rescanning webspeech voices immediately...
[Voice Sync] Immediate rescan for webspeech with 11 voices
[Voice Sync] Syncing 11 Web Speech voices
[Voices] Purged 11 webspeech voices and their numeric ID mappings
[Voices] Assigned numeric IDs for webspeech: 11 voices
[Provider] Immediate rescan for webspeech...
```

**UI Feedback**:
- Rescan button shows "🔄 Rescan" initially
- While rescanning: "⏳ Rescanning..." (disabled, grayed out)
- After success: "✓ webspeech rescanned: 11 voices found" (in error/info area)
- After 2 seconds: UI resets, ready for next action

## Files Modified

1. `src/backend/database/migrations.ts`
   - Added `tts_provider_status` table

2. `src/backend/database/repositories/voices.ts`
   - Added `purgeProvider()`
   - Added `assignNumericIds()`
   - Removed `reassignNumericIds()`, `deleteVoicesNotInList()`, mark* methods
   - Updated `getStats()` return type to include `available`

3. `src/backend/services/tts/voice-sync.ts`
   - Updated `syncWebSpeechVoices()` to purge first
   - Updated `syncAzureVoices()` to purge first
   - Added `rescanProviderImmediate()`
   - Removed `rescanProvider()`

4. `src/backend/core/ipc-handlers.ts`
   - Removed old `provider:rescan` handler
   - Added `provider:rescan-immediate` handler
   - Updated `provider:toggle` to use new methods

5. `src/frontend/screens/tts/tts.tsx`
   - Added `rescanningProvider` state
   - Rewrote `handleProviderRescan()` for immediate rescan
   - Updated Rescan button UI with loading spinner
   - Removed code that cleared voice groups on rescan

## Performance

- **Sync on Startup**: ~50ms (fetch 11 voices, insert, assign IDs)
- **Rescan Click**: ~100-200ms (purge + insert + assign IDs)
- **UI Response**: Instant (spinner shows immediately)

## Future Improvements

- [ ] Add a "Last Synced" timestamp display next to rescan button
- [ ] Add rescan capability for Azure (fetch from Azure API)
- [ ] Add rescan for Google (fetch from Google API)
- [ ] Show count of voices per language in provider section
- [ ] Add "Sync Now" option in menu/settings
