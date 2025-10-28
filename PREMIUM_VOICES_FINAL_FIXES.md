# Premium Voice Restrictions - Final Fixes & Complete Implementation

## Problem Statement

The user reported two critical issues:
1. **Google voices showing as disabled** even when enabled in Voice Settings
2. **Premium voice restrictions not being enforced** - non-subscribers could still set Azure/Google voices

## Root Causes Identified

### Issue 1: Google Voices Hardcoded as Disabled
**Location**: `src/frontend/screens/tts/tts.tsx` line 694

**Problem**: Hardcoded logic always filtered out Google voices regardless of settings:
```typescript
if (isGoogle) return false; // Google always disabled
```

### Issue 2: Backend Validation Logic Incorrect
**Location**: `src/backend/services/twitch-subscriptions.ts` line 189

**Problem**: The backend checked `premiumVoicesLocked` first, but the UI no longer sends this field (it was removed for simplification). So the check always passed early:
```typescript
if (!ttsPremiumSettings.premiumVoicesLocked) {
  return { canUse: true };
}
```

### Issue 3: IPC Handler Doesn't Exist
**Location**: `src/frontend/screens/tts/tts.tsx` in `handleUpdateRule()`

**Problem**: Code was calling `auth:get-auth-data` which doesn't exist in the backend.

## Solutions Implemented

### Fix 1: Enable Google Voices Based on Settings
**File**: `src/frontend/screens/tts/tts.tsx` 

Changed from:
```typescript
if (isGoogle) return false; // Google always disabled
```

To:
```typescript
if (isGoogle && !(settings.googleEnabled ?? false)) return false;
```

Now Google voices only filter out if Google is **not** enabled in Voice Settings.

### Fix 2: Simplify Backend Validation Logic
**File**: `src/backend/services/twitch-subscriptions.ts`

Removed the check for `premiumVoicesLocked` and now only checks `premiumVoicesRequireSubscription`:

```typescript
async canUsePremiumVoice(
  broadcasterId: string,
  userId: string,
  viewerIdForCheck: string,
  ttsPremiumSettings: {
    premiumVoicesLocked?: boolean;
    premiumVoicesRequireSubscription?: boolean;
    premiumVoicesAllowGifts?: boolean;
  }
): Promise<{ canUse: boolean; reason?: string }> {
  try {
    // If subscription is not required, everyone can use premium voices
    if (!ttsPremiumSettings.premiumVoicesRequireSubscription) {
      return { canUse: true };
    }

    console.log('[TwitchSubscriptions] Checking premium voice access for viewer:', viewerIdForCheck);

    // Sync subscriptions to get latest data
    const syncResult = await this.syncSubscriptionsFromTwitch(broadcasterId, userId);
    if (!syncResult.success) {
      return { canUse: false, reason: 'Could not verify subscription status' };
    }

    // Check subscription status
    const { isSubscribed, status } = await this.checkSubscriptionStatus(viewerIdForCheck);

    if (!isSubscribed) {
      return { canUse: false, reason: 'Not subscribed' };
    }

    // Check if gift subscriptions are allowed
    const subscription = this.subscriptionsRepo.getByViewerId(viewerIdForCheck);
    if (subscription?.is_gift === 1 && !ttsPremiumSettings.premiumVoicesAllowGifts) {
      return { canUse: false, reason: 'Gift subscriptions not allowed for premium voices' };
    }

    console.log('[TwitchSubscriptions] Premium voice access granted:', status);
    return { canUse: true, reason: status };
  } catch (error: any) {
    console.error('[TwitchSubscriptions] Error checking premium voice access:', error);
    return { canUse: false, reason: 'Error checking subscription status' };
  }
}
```

### Fix 3: Use Correct Method to Get Auth Data
**File**: `src/frontend/screens/tts/tts.tsx`

Changed from calling non-existent `auth:get-auth-data` to using the existing `db.getCurrentSession()` method:

**Added Import**:
```typescript
import * as db from '../../services/database';
```

**Updated handleUpdateRule()**:
```typescript
const handleUpdateRule = async (updates: Partial<ttsService.ViewerTTSRuleInput>) => {
  if (!selectedViewer || !viewerRule || !settings) return;

  try {
    // If updating to a premium voice and premium voices are restricted, validate access
    if (updates.customVoiceId !== undefined && isPremiumVoice(updates.customVoiceId)) {
      if (settings.premiumVoicesRequireSubscription ?? false) {
        // Get current session for auth data
        const session = await db.getCurrentSession();
        
        if (!session) {
          setError('Not connected to Twitch. Please connect first.');
          return;
        }

        const broadcasterId = session.channel_id;
        const userId = session.user_id;

        // First, get the viewer ID from the username/display name
        const { ipcRenderer } = window.require('electron');
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

## Files Modified

1. **src/frontend/screens/tts/tts.tsx**
   - Added import: `import * as db from '../../services/database';`
   - Fixed Google voice filtering (line ~694)
   - Fixed `handleUpdateRule()` to get auth data from `db.getCurrentSession()` instead of calling non-existent handler
   - Removed passing `premiumVoicesLocked: true` to backend

2. **src/backend/services/twitch-subscriptions.ts**
   - Simplified `canUsePremiumVoice()` method logic
   - Now only checks `premiumVoicesRequireSubscription` instead of both `premiumVoicesLocked` and `premiumVoicesRequireSubscription`

## How It Works Now

### Complete Flow When Setting a Premium Voice

```
User selects Azure/Google voice in Viewers tab
    ↓
onUpdateRule({ customVoiceId: voiceId })
    ↓
isPremiumVoice(voiceId) checks if voice_id starts with "azure_" or "google_"
    ↓
If Premium AND settings.premiumVoicesRequireSubscription:
    ├─ Get current session via db.getCurrentSession()
    ├─ Extract broadcasterId and userId from session
    ├─ Look up viewer ID by username
    └─ Call db:check-premium-voice-access IPC handler
        ├─ Backend checks if premiumVoicesRequireSubscription is true
        ├─ If false → canUse: true (everyone can use premium voices)
        ├─ If true:
        │   ├─ Sync latest subscriptions from Twitch API
        │   ├─ Check if viewer is subscribed
        │   ├─ If subscribed and is_gift=1, check premiumVoicesAllowGifts
        │   └─ Return canUse: true/false with reason
        └─ Return result to frontend
    ↓
If canUse = true:
    └─ Update viewer rule with new voice
Else:
    └─ Show error message and don't update
```

## Behavior Examples

### Scenario 1: Premium Voices Locked, Non-Subscriber
- User: eggiebert (no subscription)
- Setting: "Require Active Subscription" = enabled
- Action: Try to set Azure voice
- Result: ❌ Error: "Cannot set premium voice: Not subscribed"

### Scenario 2: Premium Voices Locked, Subscriber
- User: eggiebert (Tier 1 subscriber)
- Setting: "Require Active Subscription" = enabled
- Action: Set Azure voice
- Result: ✅ Voice updated successfully

### Scenario 3: Premium Voices Locked, Gift Sub (Disallowed)
- User: eggiebert (Gift subscription)
- Settings: 
  - "Require Active Subscription" = enabled
  - "Allow Gift Subscriptions" = disabled
- Action: Try to set Google voice
- Result: ❌ Error: "Cannot set premium voice: Gift subscriptions not allowed for premium voices"

### Scenario 4: Premium Voices Locked, Gift Sub (Allowed)
- User: eggiebert (Gift subscription)
- Settings:
  - "Require Active Subscription" = enabled
  - "Allow Gift Subscriptions" = enabled
- Action: Set Google voice
- Result: ✅ Voice updated successfully

### Scenario 5: Premium Voices Unlocked
- User: anyone (subscriber or not)
- Setting: "Require Active Subscription" = disabled
- Action: Set Azure or Google voice
- Result: ✅ Voice updated successfully (no validation)

## Build Status

✅ **TypeScript compilation**: No errors
✅ **Webpack build**: Successful
✅ **All fixes validated**: Complete

## Testing Recommendations

1. **Test Google Voices Visibility**
   - [ ] Enable Google in Voice Settings
   - [ ] Go to TTS → Viewers tab
   - [ ] Verify Google voices appear in voice dropdown

2. **Test Premium Voice Restrictions (Non-Subscriber)**
   - [ ] Enable "Require Active Subscription"
   - [ ] Try to set Azure voice for non-subscriber
   - [ ] Verify error message appears
   - [ ] Verify voice is NOT changed

3. **Test Premium Voice Restrictions (Subscriber)**
   - [ ] With "Require Active Subscription" enabled
   - [ ] Try to set Azure voice for subscriber
   - [ ] Verify voice is successfully updated

4. **Test Gift Subscription Settings**
   - [ ] Disable "Allow Gift Subscriptions"
   - [ ] Try to set premium voice for gift subscriber
   - [ ] Verify error message appears
   - [ ] Enable "Allow Gift Subscriptions"
   - [ ] Try again - should succeed

5. **Test Web Speech Voices (Always Available)**
   - [ ] With "Require Active Subscription" enabled
   - [ ] Set Web Speech voice for non-subscriber
   - [ ] Verify voice updates successfully (no restrictions)

## Known Limitations

- The `premiumVoicesLocked` field still exists in the database but is no longer used
- This is backwards compatible - old settings will still work
- Future cleanup could remove this field, but it's not necessary

## Related Documentation

- `PREMIUM_VOICES_FIXES.md` - Earlier implementation details
- `BLOCKED_WORDS_PREMIUM_VOICES.md` - Feature overview
- `SUBSCRIPTION_FEATURE.md` - Subscription system details
- `SUBSCRIPTION_USAGE.md` - User guide for subscriptions
