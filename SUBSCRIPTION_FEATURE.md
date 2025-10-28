# Subscription Feature Implementation Summary

## Overview
This implementation adds a comprehensive subscription tracking system for Twitch subscribers, integrating with the Twitch Helix API to fetch and store subscription data, and displaying it in the viewers screen with a focused UI.

## Database Changes

### 1. New Table: `viewer_subscriptions`
Created a new table to store subscription information for each viewer:
- `id` (PRIMARY KEY): Unique subscription ID
- `viewer_id` (FOREIGN KEY): References the viewer
- `tier`: Subscription tier (1000, 2000, 3000)
- `is_gift`: Boolean flag indicating if it's a gift subscription
- `start_date`: When the subscription started
- `end_date`: When the subscription ends (nullable)
- `created_at` & `updated_at`: Timestamps

**Index**: `idx_subscriptions_viewer` on `viewer_id` for fast lookups

### 2. New View: `viewer_subscription_status`
Created a view that joins viewers with their subscription data:
```sql
CREATE VIEW viewer_subscription_status AS
SELECT 
  v.id,
  v.display_name,
  v.tts_voice_id,
  v.tts_enabled,
  v.created_at,
  v.updated_at,
  vs.tier,
  vs.is_gift,
  vs.start_date,
  vs.end_date,
  CASE 
    WHEN vs.id IS NOT NULL THEN 
      CASE 
        WHEN vs.is_gift = 1 THEN vs.tier || ' (Gift)'
        ELSE vs.tier || ' Subscriber'
      END
    ELSE 'Not Subscribed'
  END AS subscription_status
FROM viewers v
LEFT JOIN viewer_subscriptions vs ON v.id = vs.viewer_id
```

This view:
- Removes username and ID (not needed in viewer list)
- Includes display name and subscription status
- Concatenates tier and gift status into a readable status string
- Supports efficient queries for viewer listings

## Backend Changes

### 1. New Repository: `SubscriptionsRepository` 
Location: `src/backend/database/repositories/subscriptions.ts`

Key methods:
- `upsert()`: Insert or update subscription data
- `getByViewerId()`: Retrieve subscription for a viewer
- `getById()`: Get subscription by ID
- `deleteByViewerId()`: Remove subscription
- `getAllViewersWithStatus()`: Query the view for all viewers with subscription status (with pagination)
- `searchViewersWithStatus()`: Search viewers by display name with subscription status
- `getActiveSubscribers()`: Get only subscribers (where tier is not null)

### 2. New Service: `TwitchSubscriptionsService`
Location: `src/backend/services/twitch-subscriptions.ts`

Key methods:
- `syncSubscriptionsFromTwitch()`: Main method called on app startup
  - Fetches current session (broadcaster ID and user ID)
  - Retrieves OAuth token
  - Calls Twitch API to fetch all subscriptions
  - Creates/updates viewers as needed
  - Upserts subscriptions into database
  - Returns count of synced subscriptions

- `fetchSubscriptionsFromAPI()`: Internal pagination helper
  - Handles pagination (up to 100 items per page)
  - Concatenates results from all pages
  - Includes safety limits

- `checkSubscriptionStatus()`: Check if a viewer is subscribed
  - Used when features require subscription verification (e.g., premium TTS provider)

### 3. Updated Startup Tasks
Location: `src/backend/core/ipc-handlers/startup.ts`

Added subscription sync on app load:
```typescript
// Sync Twitch subscriptions
console.log('[Startup] Syncing Twitch subscriptions...');
try {
  const currentSession = sessionsRepo.getCurrentSession();
  if (currentSession) {
    const result = await twitchSubsService.syncSubscriptionsFromTwitch(
      currentSession.channel_id,
      currentSession.user_id
    );
    // Log results...
  }
}
```

### 4. New IPC Handlers
Location: `src/backend/core/ipc-handlers/database.ts`

Added handlers for subscription operations:
- `db:upsert-subscription`: Insert or update a subscription
- `db:get-subscription`: Get subscription for a viewer
- `db:get-all-viewers-with-status`: Fetch all viewers with subscription status (uses view)
- `db:search-viewers-with-status`: Search viewers with subscription status
- `db:delete-subscription`: Remove a subscription
- `db:sync-subscriptions`: Manually trigger Twitch API sync
- `db:check-subscription-status`: Check if a viewer is subscribed

## Frontend Changes

### 1. Updated Database Service
Location: `src/frontend/services/database.ts`

Added new interfaces:
- `ViewerSubscription`: Subscription data structure
- `ViewerWithSubscription`: Combined viewer + subscription info

Added new functions:
- `upsertSubscription()`: Create/update subscription
- `getSubscription()`: Fetch subscription for viewer
- `getAllViewersWithStatus()`: Get all viewers with subscription status
- `searchViewersWithStatus()`: Search viewers with subscription status
- `deleteSubscription()`: Remove subscription
- `syncSubscriptionsFromTwitch()`: Manually trigger sync
- `checkSubscriptionStatus()`: Check subscription status for a viewer

### 2. Updated Viewers Screen
Location: `src/frontend/screens/viewers/viewers.tsx`

Changes:
- **Data source**: Changed from `getAllViewers()` to `getAllViewersWithStatus()` (uses the new view)
- **Search**: Changed from `searchViewers()` to `searchViewersWithStatus()` (uses the new view)
- **Removed columns**: 
  - Username (not needed, display name is sufficient)
  - ID (internal implementation detail)
- **Added column**: Subscription Status
  - Shows concatenated status string (e.g., "1000 Subscriber", "3000 (Gift)", "Not Subscribed")
  - Uses golden color (#ffd700) for subscribers, grey for non-subscribers
- **Cleaner UI**: Reduced column count makes the table easier to read
- **Component type**: Changed state from `Viewer[]` to `ViewerWithSubscription[]`

## Usage Flow

### App Startup
1. App loads and initializes
2. `runStartupTasks()` is called
3. Current session is retrieved from database
4. `TwitchSubscriptionsService.syncSubscriptionsFromTwitch()` is invoked
5. Subscriptions are fetched from Twitch API via pagination
6. Viewers are created/updated if needed
7. Subscriptions are upserted into database
8. Viewers screen loads with updated data

### Feature Integration
When checking if a user needs a premium provider for TTS:
```typescript
const { success, isSubscribed } = await db.checkSubscriptionStatus(viewerId);
if (isSubscribed) {
  // Allow premium provider
}
```

### Manual Sync (Optional)
Users can manually trigger a sync if needed:
```typescript
const result = await db.syncSubscriptionsFromTwitch(broadcasterId, userId);
console.log('Synced', result.count, 'subscriptions');
```

## Key Benefits

1. **Automatic Sync**: Subscriptions are automatically fetched and stored on app load
2. **Efficient Querying**: Database view enables fast queries combining viewer and subscription data
3. **Cleaner UI**: Removed unnecessary columns (username, ID) and added meaningful data (subscription status)
4. **Scalable**: Pagination support handles channels with many subscribers
5. **Flexible**: Reusable service for checking subscription status in other features
6. **Type Safe**: Full TypeScript support with proper interfaces

## Files Created/Modified

### Created:
- `src/backend/database/repositories/subscriptions.ts`
- `src/backend/services/twitch-subscriptions.ts`

### Modified:
- `src/backend/database/migrations.ts` (added table and view)
- `src/backend/core/ipc-handlers/database.ts` (added handlers)
- `src/backend/core/ipc-handlers/startup.ts` (added sync task)
- `src/frontend/services/database.ts` (added functions and interfaces)
- `src/frontend/screens/viewers/viewers.tsx` (updated UI)

## Error Handling

All operations include try-catch blocks with proper logging:
- API failures are logged with context
- Database errors are caught and returned to frontend
- Missing OAuth tokens are handled gracefully
- Pagination has safety limits to prevent infinite loops
