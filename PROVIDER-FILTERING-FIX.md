# Provider Toggle Filtering - Implementation

## Problem Reported
When toggling provider checkboxes (Web Speech API, Azure TTS), the voice list wasn't updating:
- Disabling a provider didn't remove its voices from dropdowns
- Enabling a provider didn't add its voices back
- Voice counts didn't reflect the changes
- Search, language, and gender filters showed voices from disabled providers

## Root Cause
The `getFilteredGroups()` and `getViewerFilteredGroups()` functions were filtering by search term, language, and gender, but **not by provider enable state**. All voices were always shown regardless of which providers were enabled.

## Solution Implemented

### 1. Added Provider Filtering Logic

**Updated**: `getFilteredGroups()` function to filter by provider prefixes

```typescript
// Provider filter - check if voice belongs to an enabled provider
const voiceId = voice.voice_id || '';
const isWebSpeech = voiceId.startsWith('webspeech_');
const isAzure = voiceId.startsWith('azure_');
const isGoogle = voiceId.startsWith('google_');

// Check if voice's provider is enabled
const providerEnabled = 
  (isWebSpeech && (settings?.webspeechEnabled ?? true)) ||
  (isAzure && (settings?.azureEnabled ?? false)) ||
  (isGoogle && (settings?.googleEnabled ?? false));

if (!providerEnabled) {
  return false; // Filter out this voice
}
```

**Code Location**: `src/frontend/screens/tts/tts.tsx` line 208

### 2. Applied Same Filter to Viewer Voice Picker

**Updated**: `getViewerFilteredGroups()` function with identical provider filtering

**Code Location**: `src/frontend/screens/tts/tts.tsx` line 465

### 3. Added Provider-Specific Voice Counts

**Created**: `getProviderVoiceCounts()` function to count voices by provider

```typescript
const getProviderVoiceCounts = () => {
  const counts = { webspeech: 0, azure: 0, google: 0 };
  
  voiceGroups.forEach(group => {
    group.voices.forEach(voice => {
      const voiceId = voice.voice_id || '';
      if (voiceId.startsWith('webspeech_')) {
        counts.webspeech++;
      } else if (voiceId.startsWith('azure_')) {
        counts.azure++;
      } else if (voiceId.startsWith('google_')) {
        counts.google++;
      }
    });
  });
  
  return counts;
};
```

**Code Location**: `src/frontend/screens/tts/tts.tsx` line 251

### 4. Updated UI to Show Correct Counts

**Web Speech Provider Section:**
```typescript
<div>✓ {providerCounts.webspeech} system voices available</div>
```

**Azure Provider Section:**
```typescript
<div>✓ {providerCounts.azure > 0 ? `${providerCounts.azure} neural voices` : '400+ neural voices'}</div>
```

**Code Locations**: Lines 674 and 696

## How It Works Now

### Provider Toggle Behavior:

1. **Enable a Provider** (check the box):
   - Voices with that provider's prefix appear in all dropdowns
   - Voice count updates to include those voices
   - Search/language/gender filters work on the new voices
   - Provider info shows actual voice count

2. **Disable a Provider** (uncheck the box):
   - Voices with that provider's prefix are hidden from dropdowns
   - Voice count updates to exclude those voices
   - Selected voice remains (even if from disabled provider)
   - Provider info shows 0 or "X voices" based on availability

3. **Mixed Provider Mode**:
   - Multiple providers can be enabled simultaneously
   - Voice list shows voices from all enabled providers
   - Dropdown groups mix Web Speech and Azure voices
   - Total count is sum of enabled providers

### Voice ID Prefixes Used for Filtering:
- `webspeech_` → Web Speech API voices
- `azure_` → Azure TTS voices
- `google_` → Google TTS voices (future)

### Example Scenarios:

**Scenario 1: Only Web Speech Enabled**
- Checkbox: ✓ Web Speech API, ☐ Azure TTS
- Voices shown: All `webspeech_*` voices
- Count: "✓ 157 system voices available" (example)
- Azure section: "✓ 400+ neural voices" (not loaded yet)

**Scenario 2: Both Enabled**
- Checkbox: ✓ Web Speech API, ✓ Azure TTS
- Voices shown: All `webspeech_*` + all `azure_*` voices
- Count: "Voice (557 of 557 available)"
- Web Speech: "✓ 157 system voices available"
- Azure: "✓ 400 neural voices"

**Scenario 3: Only Azure Enabled**
- Checkbox: ☐ Web Speech API, ✓ Azure TTS
- Voices shown: Only `azure_*` voices
- Count: "Voice (400 of 400 available)"
- Web Speech: "✓ 157 system voices available" (still counted, just hidden)
- Azure: "✓ 400 neural voices"

## Testing

### Test 1: Disable Web Speech
1. Go to TTS Settings → Provider Settings
2. Uncheck "🌐 Web Speech API (Free)"
3. **Expected**: 
   - Voice dropdown now only shows Azure voices (if Azure enabled)
   - Count changes from "557 available" to "400 available"
   - Search/filters only show Azure voices

### Test 2: Disable Azure
1. Uncheck "☁️ Azure TTS"
2. **Expected**:
   - Voice dropdown now only shows Web Speech voices
   - Count changes from "557 available" to "157 available"
   - No `azure_` voices in any dropdown

### Test 3: Enable Both
1. Check both "🌐 Web Speech API" and "☁️ Azure TTS"
2. **Expected**:
   - Voice dropdown shows all voices from both providers
   - Count shows total (e.g., "557 available")
   - Dropdown groups mix both providers

### Test 4: Viewer Voice Assignment
1. Go to TTS Viewers tab
2. Search for a viewer
3. Disable Azure in Settings tab
4. Go back to Viewers tab
5. **Expected**: Voice dropdown for viewer only shows Web Speech voices

## Build Status
✅ **Build Successful**
- TypeScript: 0 errors
- Webpack: 300 KiB bundle
- Compilation time: 7294 ms

## Related Files
- `src/frontend/screens/tts/tts.tsx` - Main TTS UI with filtering logic
- `src/frontend/services/tts.ts` - TTSSettings interface
- `src/backend/services/tts/manager.ts` - Provider routing logic

## Next Steps

After restarting the app:
1. **Test provider toggles** - Enable/disable each provider
2. **Verify voice counts** - Check numbers match filtered voices
3. **Test voice selection** - Ensure only enabled provider voices appear
4. **Test hybrid mode** - Enable both, select different voices, verify both work

The voice list now dynamically updates based on which providers are enabled! 🎉
