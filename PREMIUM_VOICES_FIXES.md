# Premium Voice Restrictions - Fixes & Improvements

## Summary of Changes

This document outlines the fixes and improvements made to the premium voice restrictions feature to make it fully functional.

## Issues Fixed

### 1. ✅ Over-Engineered UI
**Problem**: TTSRulesTab had a redundant "Lock Premium Voices" checkbox that created unnecessary nesting.

**Solution**: Simplified the UI in `TTSRulesTab.tsx`:
- Removed the "Lock Premium Voices" parent checkbox
- Now shows only "Require Active Subscription" checkbox
- "Allow Gift Subscriptions" nested under it when enabled
- Cleaner UI that directly maps to the actual logic

**Before**:
```
☐ Lock Premium Voices
  ☐ Require Active Subscription
    ☐ Allow Gift Subscriptions
```

**After**:
```
☐ Require Active Subscription
  ☐ Allow Gift Subscriptions
```

### 2. ✅ Premium Voice Access Logic Not Enforced
**Problem**: ViewersTab had a voice selection dropdown that directly updated the rule without validating premium voice access.

**Solution**: Enhanced `handleUpdateRule()` in `tts.tsx`:
- Added `isPremiumVoice()` helper to detect Azure/Google voices
- Added validation logic before setting a premium voice
- Checks subscription settings and calls backend to verify access
- Shows error message if user doesn't meet requirements
- Only updates the rule if validation passes

**Code Changes**:
```typescript
// New helper function
const isPremiumVoice = (voiceId: number | null): boolean => {
  if (voiceId === null) return false;
  for (const group of voiceGroups) {
    const voice = group.voices.find(v => v.id === voiceId);
    if (voice) {
      const voiceIdStr = voice.voice_id || '';
      return voiceIdStr.startsWith('azure_') || voiceIdStr.startsWith('google_');
    }
  }
  return false;
};

// Enhanced handler
const handleUpdateRule = async (updates: Partial<ttsService.ViewerTTSRuleInput>) => {
  if (!selectedViewer || !viewerRule || !settings) return;

  try {
    // If updating to a premium voice and premium voices are restricted, validate access
    if (updates.customVoiceId !== undefined && isPremiumVoice(updates.customVoiceId)) {
      if (settings.premiumVoicesRequireSubscription ?? false) {
        // Lookup viewer ID and check subscription status
        const { ipcRenderer } = window.require('electron');
        const authResult = await ipcRenderer.invoke('auth:get-auth-data');
        const broadcasterId = authResult?.broadcaster_id;
        const userId = authResult?.user_id;

        if (broadcasterId && userId) {
          const searchResult = await ipcRenderer.invoke('db:search-viewers', selectedViewer, 1);
          if (!searchResult.success || searchResult.viewers.length === 0) {
            setError('Could not find viewer to verify subscription');
            return;
          }

          const viewerId = searchResult.viewers[0].id;

          const checkResult = await ipcRenderer.invoke('db:check-premium-voice-access', 
            broadcasterId, 
            userId,
            viewerId, 
            {
              premiumVoicesLocked: true,
              premiumVoicesRequireSubscription: settings.premiumVoicesRequireSubscription,
              premiumVoicesAllowGifts: settings.premiumVoicesAllowGifts
            }
          );

          if (!checkResult.success || !checkResult.canUse) {
            setError(`Cannot set premium voice: ${checkResult.reason || 'User does not meet requirements'}`);
            return;
          }
        }
      }
    }

    const updated = await ttsService.updateViewerRule(selectedViewer, updates);
    if (updated) {
      setViewerRule(updated);
      setError(null); // Clear any previous errors
    }
  } catch (err: any) {
    console.error('[Viewers] Error updating rule:', err);
    setError(err.message);
  }
};
```

## How It Works Now

### Setting a Voice for a Viewer

1. **User clicks voice dropdown** in ViewersTab
2. **onUpdateRule() called** with `{ customVoiceId: voiceId }`
3. **Check if premium voice**:
   - If voice_id starts with `azure_` or `google_`, it's premium
   - Otherwise, allow immediately
4. **If premium, validate subscription**:
   - Get broadcaster ID and user ID from auth
   - Search for viewer by username
   - Call backend `check-premium-voice-access` with:
     - broadcasterId
     - userId (for OAuth token lookup)
     - viewerId (for subscription check)
     - ttsPremiumSettings
5. **Backend checks subscription**:
   - If `premiumVoicesRequireSubscription` is false → allow
   - If true, sync latest subscriptions from Twitch API
   - Check if viewer has active subscription
   - If gift subscription, check `premiumVoicesAllowGifts` setting
6. **Return result**:
   - If allowed: save voice to database
   - If denied: show error message, don't update

### Error Handling

Users see clear error messages when:
- Viewer not found: "Could not find viewer to verify subscription"
- Subscription check fails: "Could not verify subscription status"
- Not subscribed: "Cannot set premium voice: Not subscribed"
- Gift sub not allowed: "Cannot set premium voice: Gift subscriptions not allowed for premium voices"

## Database Integration

### Subscription Syncing
- Backend automatically syncs subscriptions from Twitch API
- Uses OAuth token stored in `tokens` table for authentication
- Updates `viewer_subscriptions` table with latest data
- Determines gift vs paid subscriptions via Twitch API

### Settings Persistence
- Premium voice settings stored in `tts_settings` table:
  - `premiumVoicesRequireSubscription`: boolean
  - `premiumVoicesAllowGifts`: boolean
- Blocked words stored in same table:
  - `blockedWords`: JSON string array

## Testing Checklist

- [ ] Enable "Require Active Subscription" in TTSRulesTab
- [ ] Try to set a premium voice (Azure/Google) for a non-subscriber
  - Should see error: "Cannot set premium voice: Not subscribed"
- [ ] Try to set a premium voice for a subscriber
  - Should succeed
- [ ] Disable "Allow Gift Subscriptions"
- [ ] Try to set premium voice for a user with only gift subscription
  - Should see error: "Cannot set premium voice: Gift subscriptions not allowed for premium voices"
- [ ] Enable "Allow Gift Subscriptions"
- [ ] Try again for gift subscriber
  - Should succeed
- [ ] Verify non-premium voices (Web Speech) can be set for anyone
  - Should succeed regardless of subscription status
- [ ] Disable "Require Active Subscription"
  - Any voice should be settable for anyone
- [ ] Test with multiple viewers
- [ ] Restart app and verify settings persist

## Files Modified

1. **src/frontend/screens/tts/tabs/TTSRulesTab.tsx**
   - Simplified premium voice UI (removed Lock checkbox)
   - Cleaner conditional rendering
   - Better example box showing behavior

2. **src/frontend/screens/tts/tts.tsx**
   - Added `isPremiumVoice()` helper function
   - Enhanced `handleUpdateRule()` with validation
   - Added viewer ID lookup before backend check
   - Proper error handling and user feedback

## Build Status

✅ All files compile without errors
✅ Webpack build successful
✅ No TypeScript errors
✅ No warnings

## Next Steps

If there are any remaining issues:

1. **Provider Disabled Error**: If voices show as "unavailable (provider disabled)", check:
   - `getVoiceInfoById()` in ViewersTab (marks Google as unavailable by default)
   - This is expected since Google provider is not enabled in the system

2. **Subscription Sync Issues**: If subscriptions don't update:
   - Check browser console for IPC errors
   - Verify OAuth token is stored correctly
   - Check Twitch API rate limiting

3. **Testing Premium Voices**: 
   - Create test subscriptions in Twitch dashboard
   - Sync subscriptions via app startup or manual trigger
   - Verify subscription data appears in viewers screen

## Related Documentation

- See `SUBSCRIPTION_FEATURE.md` for subscription tracking details
- See `BLOCKED_WORDS_PREMIUM_VOICES.md` for implementation overview
- See `SUBSCRIPTION_USAGE.md` for user guide
