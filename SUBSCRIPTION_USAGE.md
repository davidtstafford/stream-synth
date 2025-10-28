# Viewer Subscription Feature - Usage Guide

## What's New?

The app now automatically fetches and stores Twitch subscriber information on startup, displaying it in a streamlined viewers list.

## Key Changes

### Viewers Screen
- **Removed**: Username and ID columns (internal data not needed for UX)
- **Added**: Subscription Status column showing:
  - `1000 Subscriber` - Tier 1 subscriber
  - `2000 Subscriber` - Tier 2 subscriber  
  - `3000 Subscriber` - Tier 3 subscriber
  - `1000 (Gift)` - Gift subscription with tier
  - `Not Subscribed` - No active subscription
  
- Subscriber status is highlighted in gold color
- Non-subscribers shown in grey

### Database
- New `viewer_subscriptions` table stores:
  - Subscriber ID, Viewer ID, Tier, Gift flag, Start/End dates
  - Automatically managed via Twitch API sync

- New `viewer_subscription_status` view provides:
  - Combined viewer + subscription data
  - Efficient queries without complex joins

## Automatic Sync

### On App Launch
When the app starts:
1. Current session is loaded
2. Twitch subscriptions API is called
3. All current subscribers are fetched (handles pagination)
4. Viewers are created/updated as needed
5. Subscriptions are stored in database
6. Viewers screen loads with latest subscription data

**Note**: This requires an active OAuth token from a broadcaster account

### Manual Sync (Optional)
If needed, subscriptions can be manually refreshed:
```typescript
const result = await db.syncSubscriptionsFromTwitch(broadcasterId, userId);
```

## For Developers

### Check if Viewer is Subscribed
To use subscription status in features (e.g., premium TTS provider):

```typescript
import * as db from '../../services/database';

const result = await db.checkSubscriptionStatus(viewerId);
if (result.success && result.isSubscribed) {
  // User is subscribed, allow feature
  // result.status contains the tier info: "3000 (Gift)", "2000 Subscriber", etc
}
```

### Query Viewers with Subscription Status
Get all viewers with their subscription info:

```typescript
// Get all viewers with subscription status
const result = await db.getAllViewersWithStatus(limit, offset);

// Search viewers by display name
const result = await db.searchViewersWithStatus(searchQuery, limit);

// Get only active subscribers
const subs = subscriptionsRepo.getActiveSubscribers();
```

### Access Subscription Data
Each `ViewerWithSubscription` object includes:
```typescript
{
  id: string;                    // Viewer ID
  display_name: string | null;   // Display name to show
  tts_voice_id: string | null;   // TTS voice preference
  tts_enabled: number;           // TTS enabled flag
  created_at: string;            // When viewer was first seen
  updated_at: string;            // Last update time
  tier: string | null;           // "1000", "2000", "3000", or null
  is_gift: number | null;        // 1 if gift, 0 if regular, null if not subscribed
  start_date: string | null;     // Subscription start date
  end_date: string | null;       // Subscription end date (usually null)
  subscription_status: string;   // Readable status like "3000 (Gift)"
}
```

## Technical Details

### Twitch API Integration
- Uses `/helix/subscriptions` endpoint
- Handles pagination automatically (max 100 per request)
- Requires broadcaster OAuth token with `channel:read:subscriptions` scope

### Database Transactions
- Subscription data is upserted (inserted or updated)
- Foreign key constraint ensures viewer exists
- Automatic timestamps on create/update

### Error Handling
- Missing OAuth token: Returns error, skips sync
- API errors: Logged with context, partial results processed
- Database errors: Caught and returned to frontend
- Pagination safety: Limited to 100 pages max

## Example: Premium Feature Access

```typescript
// In a TTS provider component
const handleSetPremiumVoice = async (viewerId: string) => {
  // Check if user is subscribed
  const subStatus = await db.checkSubscriptionStatus(viewerId);
  
  if (!subStatus.success || !subStatus.isSubscribed) {
    alert('This feature requires an active subscription');
    return;
  }
  
  // User is subscribed, proceed with premium voice selection
  console.log(`${subStatus.status} - Allow premium voice`);
  // ... rest of logic
};
```

## Troubleshooting

### Subscriptions Not Showing
1. Check app console for sync errors (Ctrl+Shift+I in dev mode)
2. Ensure OAuth token is valid and has `channel:read:subscriptions` scope
3. Verify broadcaster is logged in correctly
4. Try manual refresh if needed

### Old Viewers Without Subscription Data
- Only new syncs will have subscription data
- Existing viewers without subscriptions show "Not Subscribed"
- This is correct behavior - they weren't tracked before

### Performance with Large Subscriber Lists
- API pagination is automatic (100 at a time)
- Database indexes ensure fast queries
- View-based queries are optimized
- Startup sync runs asynchronously and won't block UI
