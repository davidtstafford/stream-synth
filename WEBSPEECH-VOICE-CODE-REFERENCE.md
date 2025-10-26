# WebSpeech Voice System - Code Changes Reference

## 1. Database Migration (migrations.ts)

### Added: tts_provider_status table
```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS tts_provider_status (
    provider TEXT PRIMARY KEY,
    is_enabled INTEGER DEFAULT 1,
    last_synced_at TEXT,
    voice_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
```

**Purpose**: Track which providers have been synced and when
- `last_synced_at = NULL` → Provider needs syncing
- `last_synced_at = timestamp` → Already synced this session
- Prevents duplicate syncs and enables one-time sync per startup

---

## 2. Voices Repository (voices.ts)

### New Method: purgeProvider()
```typescript
purgeProvider(provider: string): void {
  const db = getDatabase();
  
  // Get all voice_ids for this provider first
  const voiceIds = db.prepare(
    'SELECT voice_id FROM tts_voices WHERE provider = ?'
  ).all(provider) as { voice_id: string }[];
  
  // Delete numeric ID mappings
  for (const { voice_id } of voiceIds) {
    db.prepare('DELETE FROM tts_voice_ids WHERE voice_id = ?').run(voice_id);
  }
  
  // Delete voices
  const result = db.prepare(
    'DELETE FROM tts_voices WHERE provider = ?'
  ).run(provider);
  
  console.log(`[Voices] Purged ${result.changes} ${provider} voices...`);
}
```

**Why**: Clean slate before inserting new voices. Prevents ID collisions and duplication.

### New Method: assignNumericIds()
```typescript
assignNumericIds(provider: string): void {
  const db = getDatabase();
  
  // Get all voices for this provider in order
  const voices = db.prepare(`
    SELECT voice_id FROM tts_voices 
    WHERE provider = ? 
    ORDER BY display_order, language_code, name
  `).all(provider) as { voice_id: string }[];

  let nextId = 1;
  
  for (const voice of voices) {
    // Insert new numeric ID (no existing ones since we purged)
    db.prepare(
      'INSERT INTO tts_voice_ids (numeric_id, voice_id) VALUES (?, ?)'
    ).run(nextId, voice.voice_id);
    nextId++;
  }
  
  console.log(`[Voices] Assigned numeric IDs for ${provider}: ${voices.length} voices`);
}
```

**Why**: Ensure sequential IDs (1, 2, 3... N) with no gaps. Called after purging + inserting.

### Updated Method: getStats()
```typescript
// Before
getStats(): { total: number; available: number; byProvider: Record<string, number> }

// After: Same signature but no 'available' vs 'total' distinction
// All stored voices are considered available
return {
  total: total.count,
  available: total.count,  // Now same as total
  byProvider: providerCounts
};
```

**Why**: Simplified since we no longer mark voices as unavailable. They're either stored or purged.

### Removed Methods
- `reassignNumericIds()` - Replaced by `assignNumericIds()` with purge
- `deleteVoicesNotInList()` - Replaced by `purgeProvider()` for cleaner logic
- `markProviderAvailable()` - No longer needed (voices always available if stored)
- `markProviderUnavailable()` - No longer needed

---

## 3. Voice Sync Service (voice-sync.ts)

### Updated Method: syncWebSpeechVoices()
```typescript
async syncWebSpeechVoices(voices: any[]): Promise<number> {
  console.log(`[Voice Sync] Syncing ${voices.length} Web Speech voices`);
  
  if (!voices || voices.length === 0) {
    this.voicesRepo.updateProviderStatus('webspeech', true, 0);
    return 0;
  }
  
  // 1. PURGE: Clear all old WebSpeech voices
  this.voicesRepo.purgeProvider('webspeech');
  
  const voiceIds: string[] = [];
  
  // 2. INSERT: Add new voices
  voices.forEach((voice, index) => {
    const parsed = VoiceParser.parseWebSpeechVoice(voice, index);
    this.voicesRepo.upsertVoice(parsed);
    voiceIds.push(parsed.voice_id);
  });

  // 3. ASSIGN IDs: Ensure sequential numeric IDs
  this.voicesRepo.assignNumericIds('webspeech');

  // 4. UPDATE STATUS: Mark as synced
  this.voicesRepo.updateProviderStatus('webspeech', true, voiceIds.length);

  console.log(`[Voice Sync] Synced ${voiceIds.length} Web Speech voices`);
  return voiceIds.length;
}
```

**Key Changes**:
1. Calls `purgeProvider()` first
2. Then inserts voices
3. Calls `assignNumericIds()` to create fresh 1-N sequence
4. Updates provider status timestamp

**Same Pattern** for `syncAzureVoices()` - just different metadata

### New Method: rescanProviderImmediate()
```typescript
async rescanProviderImmediate(provider: string, currentVoices: any[]): Promise<number> {
  console.log(`[Voice Sync] Immediate rescan for ${provider}...`);
  
  if (!currentVoices || currentVoices.length === 0) {
    console.log(`[Voice Sync] No ${provider} voices to sync`);
    return 0;
  }
  
  // Route to appropriate sync method (each does: purge → insert → assign IDs)
  if (provider === 'webspeech') {
    return this.syncWebSpeechVoices(currentVoices);
  } else if (provider === 'azure') {
    return this.syncAzureVoices(currentVoices);
  } else if (provider === 'google') {
    return this.syncGoogleVoices(currentVoices);
  }
  
  return 0;
}
```

**Why**: Entry point for immediate rescan from frontend. Gets called via IPC with fresh voices.

### Removed Method: rescanProvider()
```typescript
// OLD: Would clear sync status and let next startup handle it
// NEW: Immediate rescan via rescanProviderImmediate()
```

**Why**: Users want instant refresh, not "wait for restart" behavior.

---

## 4. IPC Handlers (ipc-handlers.ts)

### New Handler: provider:rescan-immediate
```typescript
ipcMain.handle('provider:rescan-immediate', async (event, provider: string, voices: any[]) => {
  try {
    console.log(`[Provider] Immediate rescan for ${provider}...`);
    await initializeTTS();
    
    if (!voiceSyncService) {
      return { success: false, error: 'Voice sync service not initialized' };
    }
    
    // Call service to purge + insert + assign IDs
    const count = await voiceSyncService.rescanProviderImmediate(provider, voices);
    const stats = voiceSyncService.getStats();
    
    return { 
      success: true, 
      count,
      message: `${provider} voices rescanned: ${count} voices found`,
      stats 
    };
  } catch (error: any) {
    console.error(`[Provider] Error rescanning ${provider}:`, error);
    return { success: false, error: error.message };
  }
});
```

**Called From**: Frontend rescan button
**Returns**: 
- `success`: boolean (true if sync completed)
- `count`: number of voices synced
- `message`: Human-readable feedback
- `stats`: Updated voice statistics

### Updated Handler: provider:toggle
```typescript
ipcMain.handle('provider:toggle', async (event, payload: { provider: string; enabled: boolean }) => {
  try {
    const { provider, enabled } = payload;
    await initializeTTS();
    
    // Update provider status in database
    const status = voicesRepo.getProviderStatus(provider);
    const voiceCount = status?.voice_count || 0;
    voicesRepo.updateProviderStatus(provider, enabled, voiceCount);
    
    if (enabled && !status?.last_synced_at) {
      console.log(`[Provider] ${provider} is enabled but not synced yet`);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[Provider] Error toggling provider:', error);
    return { success: false, error: error.message };
  }
});
```

**Changes**: Now uses `updateProviderStatus()` instead of removed `markProvider*()` methods

---

## 5. TTS Screen Component (tts.tsx)

### New State Variable
```typescript
const [rescanningProvider, setRescanningProvider] = useState<string | null>(null);
```

**Purpose**: Track which provider is currently rescanning (shows loading spinner)

### Updated Method: handleProviderRescan()
```typescript
const handleProviderRescan = async (provider: 'webspeech' | 'azure' | 'google') => {
  try {
    setRescanningProvider(provider);  // Show loading spinner
    setError(null);
    
    console.log(`[TTS] Rescanning ${provider} voices immediately...`);
    
    // Get current voices from Web Speech API
    let currentVoices: any[] = [];
    
    if (provider === 'webspeech') {
      if (!window.speechSynthesis) {
        throw new Error('Web Speech API not available');
      }
      currentVoices = window.speechSynthesis.getVoices();
      console.log(`[TTS] Found ${currentVoices.length} Web Speech voices for rescan`);
    } else if (provider === 'azure') {
      // Future: Would fetch from Azure API
      setError('Azure rescan not yet implemented. Please restart the app.');
      setRescanningProvider(null);
      return;
    }
    
    if (currentVoices.length === 0) {
      throw new Error(`No ${provider} voices available to rescan`);
    }
    
    // Call backend to rescan immediately
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('provider:rescan-immediate', provider, currentVoices);
    
    if (result.success) {
      console.log(`[TTS] Rescan complete: ${result.count} voices found`);
      
      // Reload voice list from database
      await syncAndLoadVoices();
      await loadVoiceStats();
      
      setError(`✓ ${provider} rescanned: ${result.count} voices found`);
    } else {
      throw new Error(result.error || 'Rescan failed');
    }
  } catch (err: any) {
    setError(`Error rescanning ${provider}: ${err.message}`);
    console.error(`[TTS] Error rescanning ${provider}:`, err);
  } finally {
    setRescanningProvider(null);  // Hide loading spinner
  }
};
```

**Flow**:
1. Set loading state → shows spinner
2. Get current voices from Web Speech API
3. Call backend `provider:rescan-immediate` IPC
4. Backend purges + inserts + assigns IDs
5. Frontend reloads voice list from DB
6. Clear loading state → hides spinner
7. Show success/error message

### Updated UI: Rescan Button
```tsx
<button
  onClick={() => handleProviderRescan('webspeech')}
  disabled={rescanningProvider === 'webspeech'}
  style={{
    // ... styling ...
    backgroundColor: rescanningProvider === 'webspeech' ? '#555' : '#4a4a4a',
    cursor: rescanningProvider === 'webspeech' ? 'not-allowed' : 'pointer',
    opacity: rescanningProvider === 'webspeech' ? 0.7 : 1
  }}
  title={rescanningProvider === 'webspeech' 
    ? 'Rescanning...' 
    : 'Click to rescan voices immediately'}
>
  {rescanningProvider === 'webspeech' ? '⏳ Rescanning...' : '🔄 Rescan'}
</button>
```

**Visual Feedback**:
- Default: "🔄 Rescan" button, enabled
- Rescanning: "⏳ Rescanning..." button, disabled, grayed out
- After: "🔄 Rescan" again, success message shown

---

## 6. Data Flow Summary

### App Startup
```
Frontend                          Backend                        Database
   │                                 │                              │
   ├─ getVoices()                    │                              │
   ├─ [Web Speech API returns 11]    │                              │
   │                                 │                              │
   ├─ provider:sync-voices           │                              │
   │   (provider, voices)            │                              │
   │                    ┌────────────┤                              │
   │                    │ VoiceSyncService.syncWebSpeechVoices()    │
   │                    ├──────────────────────────┬────────────────┤
   │                    │                          │                │
   │                    │  purgeProvider('webspeech')               │
   │                    │                          ├─ DELETE * FROM tts_voices
   │                    │                          ├─ DELETE * FROM tts_voice_ids
   │                    │                          │
   │                    │  upsertVoice() × 11     │
   │                    │                          ├─ INSERT 11 rows
   │                    │                          │
   │                    │  assignNumericIds()      │
   │                    │                          ├─ INSERT 1,2,3...11 into tts_voice_ids
   │                    │                          │
   │                    │  updateProviderStatus() │
   │                    │                          ├─ UPDATE last_synced_at = now()
   │                    │                          │
   │                    │ Return { count: 11 }   │
   │ ← [Success]        │                          │
   │                                 │                              │
   ├─ getGroupedVoices()            │                              │
   │              ┌──────────────────┤                              │
   │              │ SELECT * FROM tts_voices                        │
   │              │ JOIN tts_voice_ids                              │
   │              │                          ← [11 rows with IDs 1-11]
   ← [11 voices grouped]
   │
   ├─ Render voice dropdown (shows all 11)
```

### Manual Rescan (User Clicks Button)
```
Frontend                          Backend                        Database
   │
   ├─ [Show spinner]
   │
   ├─ Get Web Speech voices (11)
   │
   ├─ provider:rescan-immediate
   │   (provider, voices)          
   │                    ┌────────────┤                              
   │                    │ rescanProviderImmediate()                 
   │                    ├──────────────────────────┬────────────────┤
   │                    │                          │                │
   │                    │  syncWebSpeechVoices()   │                │
   │                    │  - purgeProvider()       ├─ DELETE all webspeech
   │                    │  - upsertVoice() × 11   ├─ INSERT 11 new
   │                    │  - assignNumericIds()    ├─ INSERT 1-11 sequential
   │                    │  - updateStatus()        ├─ UPDATE timestamp
   │                    │                          │                │
   │                    │ Return { count: 11 }    │                │
   │ ← [success: true]                            │                │
   │
   ├─ [Hide spinner]
   │
   ├─ syncAndLoadVoices()
   │              ┌──────────────────┤                              │
   │              │ getGroupedVoices()          │                  │
   │              │              ← [11 with IDs 1-11]
   │              │
   ├─ Render dropdown (shows 11, no duplicates)
   │
   ├─ Show "✓ webspeech rescanned: 11 voices found"
```

---

## Key Design Decisions

### 1. Purge vs. Remap
**Decision**: Purge all old voices, then insert fresh

| Approach | Pros | Cons |
|----------|------|------|
| **Purge** (chosen) | Simple, predictable, no ID collisions | "Destructive" but rebuilds immediately |
| Remap | Tries to preserve old IDs | Complex logic, bug-prone, caused original duplication |

### 2. Frontend Gets Voices
**Decision**: Frontend fetches from Web Speech API, sends to backend

| Approach | Pros | Cons |
|----------|------|------|
| **Frontend** (chosen) | Web Speech API only in renderer, already fetching anyway | Slightly more data transfer |
| Backend | Could be more "pure" | Web Speech API not available in main process |

### 3. Numeric IDs Always Sequential
**Decision**: `assignNumericIds()` creates 1, 2, 3... N regardless of order changes

**Why**: 
- Simpler than trying to preserve old IDs
- No gaps = easy to validate
- Always predictable for users (`~setvoice 1` always means first voice)
- Voice persistence handled by natural key `voice_id`, not numeric ID

### 4. One Sync Per Startup + Manual Rescan
**Decision**: Sync only on startup (if needed) OR when user clicks rescan

**Why**:
- Prevents auto-sync spam
- Gives user control
- Stable voice list during session
- Can still rescan if needed (e.g., plugged in new speaker with Web Speech voices)

---

## Success Metrics

✅ **No Duplication**: Purge eliminates duplicates
✅ **Clean IDs**: Sequential 1-N with no gaps
✅ **Immediate Feedback**: User sees spinner while rescanning
✅ **Persistent Choices**: Natural key preserves voice selection across rescans
✅ **Simple Logic**: Easier to maintain than ID remapping
✅ **Backward Compatible**: Old DB works fine, first sync rebuilds cleanly

---

## Testing Validation

### Expected After Rescan
```sql
-- Should be exactly 11
SELECT COUNT(*) FROM tts_voices WHERE provider = 'webspeech';

-- Should be 1,2,3...11 (no gaps)
SELECT numeric_id FROM tts_voice_ids 
  WHERE voice_id IN (SELECT voice_id FROM tts_voices WHERE provider = 'webspeech')
  ORDER BY numeric_id;

-- Should be 0 (no duplicates)
SELECT COUNT(*) FROM (
  SELECT voice_id, COUNT(*) 
  FROM tts_voices 
  GROUP BY voice_id 
  HAVING COUNT(*) > 1
);
```

All three queries should return expected results after multiple rescans.
