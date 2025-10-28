# Blocked Words & Premium Voice Restrictions - Implementation Guide

## Overview

This implementation adds two major features to the TTS system:

1. **Blocked Words Filter**: Allows blocking specific words/phrases from being read by TTS
2. **Premium Voice Restrictions**: Lock premium voices (Azure, Google) to subscribed users only

Both features integrate seamlessly with the existing subscription tracking system.

## Features

### 1. Blocked Words Filter

#### How It Works
- Words added to the blocklist are silently removed from messages before TTS processing
- Filtering is case-insensitive and matches whole words only (e.g., "bad" won't match "badass")
- Multiple words can be added and are stored in the database as a JSON array
- Extra whitespace is cleaned up after removal

#### UI Components
Located in `TTSRulesTab.tsx`:
- **Input field**: Add new blocked words
- **Word tags**: Visual display with remove buttons
- **Counter**: Shows total blocked words
- **Real-time updates**: Changes saved immediately to database

#### Usage Example
```
Message: "This is a bad word that should not be read"
Blocked Words: ["bad"]
Result: "This is a word that should not be read"
```

#### Database Storage
- **Table**: `tts_settings`
- **Key**: `blocked_words`
- **Value**: JSON string array (e.g., `["badword1","badword2"]`)
- **Parsed into**: `TTSSettings.blockedWords: string[]`

#### Code Flow
1. Message received: `handleChatMessage(username, message, userId)`
2. Filtering stage: `filterMessage()` is called
3. Blocked words removed: `removeBlockedWords(filtered)`
4. Rest of message processing continues
5. Only non-blocked content is spoken

### 2. Premium Voice Restrictions

#### How It Works
- Premium voices (Azure: `azure_*`, Google: `google_*`) can be locked to subscribers only
- When a viewer tries to use a premium voice, the system:
  1. Syncs their subscription status from Twitch API
  2. Checks subscription tiers and gift status
  3. Allows or denies access based on settings
- WebSpeech voices are always available (free tier)

#### Configuration Options

**Enable Premium Voice Locking**
- `premiumVoicesLocked: boolean`
- When enabled, premium voices are subject to subscription checks
- When disabled, premium voices are available to everyone

**Require Active Subscription**
- `premiumVoicesRequireSubscription: boolean`
- When enabled, only subscribers can use premium voices
- Requires `premiumVoicesLocked` to be true

**Allow Gift Subscriptions**
- `premiumVoicesAllowGifts: boolean`
- When enabled, gift subscriptions grant premium voice access
- When disabled, only regular subscriptions allow access
- Requires `premiumVoicesRequireSubscription` to be true

#### UI Components
Located in `TTSRulesTab.tsx`:
- **Lock toggle**: Enable/disable premium voice restrictions
- **Subscription requirement checkbox**: Require active subscriptions
- **Gift subscription option**: Allow gift subs for premium access
- **Behavior description**: Clear explanation of current settings

#### Example Configurations

**Config A: Premium locked to subscribers**
```
premiumVoicesLocked: true
premiumVoicesRequireSubscription: true
premiumVoicesAllowGifts: false
```
- Subscribers with regular subs: ✅ Can use premium voices
- Subscribers with gift subs: ❌ Cannot use premium voices
- Non-subscribers: ❌ Cannot use premium voices

**Config B: Premium locked, gifts allowed**
```
premiumVoicesLocked: true
premiumVoicesRequireSubscription: true
premiumVoicesAllowGifts: true
```
- Subscribers with regular subs: ✅ Can use premium voices
- Subscribers with gift subs: ✅ Can use premium voices
- Non-subscribers: ❌ Cannot use premium voices

**Config C: Premium unlocked**
```
premiumVoicesLocked: false
```
- Everyone: ✅ Can use premium voices

#### Database Storage

**Settings Table**
- `premium_voices_locked`: "0" or "1" (boolean)
- `premium_voices_require_subscription`: "0" or "1" (boolean)
- `premium_voices_allow_gifts`: "0" or "1" (boolean)

**Subscription Data** (already exists)
- Table: `viewer_subscriptions`
- Fields: `viewer_id`, `tier`, `is_gift`, `start_date`, `end_date`
- View: `viewer_subscription_status` - combines viewer + subscription info

#### API Integration

**Sync on Premium Access Check**
When a viewer tries to use a premium voice:
1. Call `canUsePremiumVoice(broadcasterId, userId, viewerId, ttsPremiumSettings)`
2. This function:
   - First syncs subscriptions from Twitch API (gets latest data)
   - Checks if viewer is subscribed
   - Validates gift status if needed
   - Returns `{ canUse: true/false, reason?: string }`

**IPC Handler**: `db:check-premium-voice-access`
- Backend: Calls `TwitchSubscriptionsService.canUsePremiumVoice()`
- Frontend: `db.checkPremiumVoiceAccess(broadcasterId, userId, viewerId, settings)`

#### Code Integration Points

**Frontend - Voice Selection (TTS Viewers Screen)**
```typescript
// When user tries to set a premium voice for a viewer
const result = await db.checkPremiumVoiceAccess(
  broadcasterId,
  userId,
  viewerId,
  {
    premiumVoicesLocked: settings.premiumVoicesLocked,
    premiumVoicesRequireSubscription: settings.premiumVoicesRequireSubscription,
    premiumVoicesAllowGifts: settings.premiumVoicesAllowGifts
  }
);

if (!result.canUse) {
  alert(`Cannot use premium voice: ${result.reason}`);
  return;
}

// Proceed with setting voice
await setViewerVoice(viewerId, voiceId);
```

**Backend - TTS Manager**
```typescript
// When processing chat for a viewer with custom voice
if (viewerRule?.customVoiceId) {
  const voice = this.voicesRepo.getVoiceByNumericId(viewerRule.customVoiceId);
  
  // Check if premium voice needs validation
  if (this.isPremiumVoice(voice.voice_id) && this.settings?.premiumVoicesLocked) {
    // Validation would be done before setting the voice
    // (in the viewer rules screen, not during chat processing)
  }
  
  voiceId = voice.voice_id;
}
```

## Implementation Details

### Files Modified

1. **Frontend - UI**
   - `src/frontend/screens/tts/tabs/TTSRulesTab.tsx`
     - Added "Blocked Words" section with input and word tags
     - Added "Premium Voice Restrictions" section with checkboxes
     - Added `BlockedWordsEditor` component

2. **Frontend - Services**
   - `src/frontend/services/tts.ts`
     - Added to `TTSSettings` interface:
       - `blockedWords?: string[]`
       - `premiumVoicesLocked?: boolean`
       - `premiumVoicesRequireSubscription?: boolean`
       - `premiumVoicesAllowGifts?: boolean`
   - `src/frontend/services/database.ts`
     - Added `checkPremiumVoiceAccess()` function

3. **Backend - Database**
   - `src/backend/database/migrations.ts`
     - Added default values for blocked_words and premium voice settings
     - Settings stored in `tts_settings` table

4. **Backend - Services**
   - `src/backend/services/tts/base.ts`
     - Updated `TTSSettings` interface with new fields
   - `src/backend/services/tts/manager.ts`
     - Added `removeBlockedWords()` method
     - Added `isPremiumVoice()` method
     - Updated `filterMessage()` to call `removeBlockedWords()`
     - Updated `loadSettings()` to read blocked words and premium settings
     - Updated `saveSettings()` to persist blocked words and premium settings

5. **Backend - Twitch Integration**
   - `src/backend/services/twitch-subscriptions.ts`
     - Added `canUsePremiumVoice()` method that:
       - Syncs subscriptions from Twitch API
       - Checks subscription status
       - Validates gift status
       - Returns access result with reason

6. **Backend - IPC Handlers**
   - `src/backend/core/ipc-handlers/database.ts`
     - Added `db:check-premium-voice-access` handler

### Data Flow Diagrams

**Blocked Words Processing**
```
Message Input
    ↓
isBot? → Skip
    ↓
filterCommands? → Skip
    ↓
filterUrls? → Remove URLs
    ↓
removeBlockedWords() ← NEW STEP
    ↓
checkLength → Skip/Truncate
    ↓
applySpamFilters()
    ↓
checkDuplicates → Skip
    ↓
Queue for TTS
```

**Premium Voice Access Check**
```
Viewer tries to set premium voice
    ↓
isPremiumVoice()? → NO → Allow
    ↓
premiumVoicesLocked? → NO → Allow
    ↓
syncSubscriptionsFromTwitch()
    ↓
checkSubscriptionStatus()
    ↓
isSubscribed? → NO → Deny
    ↓
is_gift == 1 && !allowGifts? → Deny
    ↓
Allow ✓
```

## Testing Checklist

### Blocked Words
- [ ] Add single word, verify it's removed from messages
- [ ] Add multiple words, verify all are removed
- [ ] Case-insensitive matching (e.g., "bad" removes "BAD")
- [ ] Whole word matching (e.g., "bad" doesn't remove "badge")
- [ ] Empty message after removal is skipped
- [ ] Whitespace cleanup works correctly
- [ ] Editing list (add/remove words) persists on app restart

### Premium Voice Restrictions
- [ ] With locks disabled: all voices available to everyone
- [ ] With locks enabled but subscription not required: all voices available
- [ ] With subscription required: subscribers can use premium, others cannot
- [ ] Gift subscriptions respected based on setting
- [ ] API sync happens before access check
- [ ] Error messages explain reason for denial
- [ ] Settings persist on app restart

## Future Enhancements

1. **Blocked Word Patterns**
   - Support regex patterns for more flexible blocking
   - Example: block `/[0-9]{3}-[0-9]{4}/` for phone numbers

2. **Tiered Restrictions**
   - Different voice access for Tier 1, 2, 3 subscribers
   - Moderator/VIP voice access

3. **Time-Based Restrictions**
   - Premium voices available only during certain hours
   - Subscriber duration requirements (e.g., 30 days minimum)

4. **Word-Specific Subscriptions**
   - Different word blocks for different subscription tiers
   - Subscribers can say blocked words

5. **Analytics**
   - Track blocked words most commonly used
   - Track premium voice usage by tier
