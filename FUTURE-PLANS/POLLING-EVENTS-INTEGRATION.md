# Polling Events Integration Feature

**Status:** 📋 **FUTURE FEATURE - DOCUMENTATION**  
**Priority:** High  
**Estimated Effort:** 8-12 hours  
**Dependencies:** Existing polling framework, Events table, Viewers repository  
**Risk:** Low  

---

## Overview

Enhance the polling framework to automatically write events to the `events` table whenever a state change is detected. This allows users to see a complete history of all polled events (followers, moderations, role changes, clips) in the Events screen.

**Current State**: Pollers detect changes but don't record them as events  
**Desired State**: Every state change writes an event with useful details to the `events` table

### Key Benefits

- ✅ Complete event audit trail for all polled activities
- ✅ Users can review what the pollers detected
- ✅ Events screen becomes the single source of truth for all channel activity
- ✅ No duplicate event recording (existing WebSocket events + polled events both go to Events table)
- ✅ Extensible pattern for future pollers

---

## Architecture Overview

### Event Flow

```
Poller (e.g., Followers)
    ↓
Detect State Change (new follower, unfollow, etc.)
    ↓
Build Event Payload (with details)
    ↓
Write to events table
    ↓
Events Screen displays
```

### Core Components

1. **PollingEventFormatter** - Utility for building event payloads from polling state changes
2. **DynamicPollingManager** - Enhanced to write events on state changes
3. **Events Repository** - Already supports event creation
4. **Frontend Events Screen** - Already displays events

---

## Implementation Details

### 1. Create Polling Event Formatter (`src/backend/services/polling-event-formatter.ts`)

Centralized utility for creating event payloads from polling state changes:

```typescript
// File: src/backend/services/polling-event-formatter.ts

import { EventData } from '../database/repositories/events';

/**
 * Builds event payloads for state changes detected by pollers
 * Consolidates event creation logic to avoid duplication
 */
export class PollingEventFormatter {
  /**
   * Follower state changes
   */
  static formatFollowerEvent(
    action: 'follow' | 'unfollow',
    username: string,
    viewerId: string,
    followedAt?: Date
  ): EventData {
    return {
      event_type: action === 'follow' ? 'channel.follow' : 'channel.unfollow',
      viewer_id: viewerId,
      details: {
        username,
        action,
        followed_at: followedAt?.toISOString() || new Date().toISOString()
      }
    };
  }

  /**
   * Moderation state changes
   */
  static formatModerationEvent(
    action: 'ban' | 'unban' | 'timeout' | 'timeout_lifted',
    username: string,
    viewerId: string,
    moderatorUsername?: string,
    moderatorId?: string,
    duration?: number, // For timeouts, in seconds
    reason?: string
  ): EventData {
    const eventTypeMap: Record<string, string> = {
      'ban': 'channel.user.banned',
      'unban': 'channel.user.unbanned',
      'timeout': 'channel.user.timed_out',
      'timeout_lifted': 'channel.user.timeout_lifted'
    };

    const details: Record<string, any> = {
      username,
      action,
      moderator_username: moderatorUsername,
      moderator_id: moderatorId
    };

    if (duration) {
      details.duration_seconds = duration;
      details.expires_at = new Date(Date.now() + duration * 1000).toISOString();
    }

    if (reason) {
      details.reason = reason;
    }

    return {
      event_type: eventTypeMap[action],
      viewer_id: viewerId,
      details
    };
  }

  /**
   * Role state changes (VIP, Moderator)
   */
  static formatRoleEvent(
    action: 'granted' | 'revoked',
    roleType: 'vip' | 'moderator',
    username: string,
    viewerId: string
  ): EventData {
    const eventTypeMap: Record<string, Record<string, string>> = {
      'vip': {
        'granted': 'channel.vip.granted',
        'revoked': 'channel.vip.revoked'
      },
      'moderator': {
        'granted': 'channel.moderator.granted',
        'revoked': 'channel.moderator.revoked'
      }
    };

    return {
      event_type: eventTypeMap[roleType][action],
      viewer_id: viewerId,
      details: {
        username,
        action,
        role_type: roleType
      }
    };
  }

  /**
   * Subscription state changes (from polling)
   */
  static formatSubscriptionEvent(
    action: 'subscribed' | 'resubscribed' | 'unsubscribed',
    username: string,
    viewerId: string,
    tier?: string,
    cumulativeMonths?: number,
    isGift?: boolean
  ): EventData {
    const eventTypeMap: Record<string, string> = {
      'subscribed': 'channel.subscribe',
      'resubscribed': 'channel.resub',
      'unsubscribed': 'channel.unsubscribe'
    };

    const details: Record<string, any> = {
      username,
      action,
      tier
    };

    if (cumulativeMonths) {
      details.cumulative_months = cumulativeMonths;
    }

    if (isGift !== undefined) {
      details.is_gift = isGift;
    }

    return {
      event_type: eventTypeMap[action],
      viewer_id: viewerId,
      details
    };
  }

  /**
   * Clip created (from polling)
   */
  static formatClipCreatedEvent(
    clipTitle: string,
    clipUrl: string,
    creatorUsername: string,
    creatorId: string,
    viewCount?: number
  ): EventData {
    return {
      event_type: 'channel.clip.created',
      viewer_id: creatorId,
      details: {
        clip_title: clipTitle,
        clip_url: clipUrl,
        creator_username: creatorUsername,
        view_count: viewCount || 0
      }
    };
  }

  /**
   * Generic polling event
   */
  static formatGenericPollingEvent(
    eventType: string,
    viewerId: string | null,
    details: Record<string, any>
  ): EventData {
    return {
      event_type: eventType,
      viewer_id: viewerId,
      details
    };
  }
}
```

### 2. Enhance DynamicPollingManager

Update the polling manager to write events when state changes are detected:

```typescript
// File: src/backend/services/dynamic-polling-manager.ts
// Pseudo-code for relevant sections

import { PollingEventFormatter } from './polling-event-formatter';
import { EventsRepository } from '../database/repositories/events';

export class DynamicPollingManager {
  private eventsRepo = new EventsRepository();

  /**
   * Handle follower polling results
   */
  private async handleFollowerPollResults(
    newFollowers: string[],
    previousFollowers: string[],
    channelId: string
  ) {
    // Detect new followers
    const newFollowerList = newFollowers.filter(f => !previousFollowers.includes(f));
    
    for (const username of newFollowerList) {
      const viewerId = await this.getOrCreateViewerId(username);
      const eventPayload = PollingEventFormatter.formatFollowerEvent(
        'follow',
        username,
        viewerId
      );
      
      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });
      
      console.log(`[Polling] Recorded follow event for ${username}`);
    }

    // Detect unfollows
    const unfollowList = previousFollowers.filter(f => !newFollowers.includes(f));
    
    for (const username of unfollowList) {
      const viewerId = await this.getOrCreateViewerId(username);
      const eventPayload = PollingEventFormatter.formatFollowerEvent(
        'unfollow',
        username,
        viewerId
      );
      
      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });
      
      console.log(`[Polling] Recorded unfollow event for ${username}`);
    }
  }

  /**
   * Handle moderation polling results
   */
  private async handleModerationPollResults(
    currentBans: ModerationUser[],
    currentTimeouts: ModerationUser[],
    previousBans: ModerationUser[],
    previousTimeouts: ModerationUser[],
    channelId: string
  ) {
    // New bans
    const newBans = currentBans.filter(
      cb => !previousBans.some(pb => pb.userId === cb.userId)
    );

    for (const ban of newBans) {
      const viewerId = await this.getOrCreateViewerId(ban.username);
      const eventPayload = PollingEventFormatter.formatModerationEvent(
        'ban',
        ban.username,
        viewerId,
        ban.moderatorUsername,
        ban.moderatorId
      );

      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });

      console.log(`[Polling] Recorded ban event for ${ban.username}`);
    }

    // Unbans (previously banned, now not)
    const unbans = previousBans.filter(
      pb => !currentBans.some(cb => cb.userId === pb.userId)
    );

    for (const unban of unbans) {
      const viewerId = await this.getOrCreateViewerId(unban.username);
      const eventPayload = PollingEventFormatter.formatModerationEvent(
        'unban',
        unban.username,
        viewerId
      );

      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });

      console.log(`[Polling] Recorded unban event for ${unban.username}`);
    }

    // Similar logic for timeouts and timeout_lifted...
  }

  /**
   * Handle role sync polling results
   */
  private async handleRoleSyncResults(
    newVips: string[],
    previousVips: string[],
    newMods: string[],
    previousMods: string[],
    channelId: string
  ) {
    // New VIPs
    const grantedVips = newVips.filter(v => !previousVips.includes(v));
    for (const username of grantedVips) {
      const viewerId = await this.getOrCreateViewerId(username);
      const eventPayload = PollingEventFormatter.formatRoleEvent(
        'granted',
        'vip',
        username,
        viewerId
      );

      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });

      console.log(`[Polling] Recorded VIP granted event for ${username}`);
    }

    // Revoked VIPs (previously VIP, now not)
    const revokedVips = previousVips.filter(v => !newVips.includes(v));
    for (const username of revokedVips) {
      const viewerId = await this.getOrCreateViewerId(username);
      const eventPayload = PollingEventFormatter.formatRoleEvent(
        'revoked',
        'vip',
        username,
        viewerId
      );

      await this.eventsRepo.insertEvent({
        ...eventPayload,
        channel_id: channelId
      });

      console.log(`[Polling] Recorded VIP revoked event for ${username}`);
    }

    // Similar logic for moderators...
  }

  /**
   * Helper to get or create viewer ID
   */
  private async getOrCreateViewerId(username: string): Promise<string> {
    // Use existing ViewersRepository to find or create
    const viewer = await this.viewersRepo.getOrCreate({
      username,
      display_name: username
    });
    return viewer.id;
  }
}
```

### 3. Update Events Repository

Ensure the repository has methods to insert polling events:

```typescript
// File: src/backend/database/repositories/events.ts
// Add/verify these methods exist

export interface EventData {
  event_type: string;
  viewer_id: string | null;
  details: Record<string, any>;
}

export interface EventInput extends EventData {
  channel_id: string;
}

export class EventsRepository extends BaseRepository {
  /**
   * Insert a polling event
   */
  insertEvent(event: EventInput): { success: boolean; id?: number; error?: string } {
    try {
      const db = this.getDatabase();
      const result = db.prepare(`
        INSERT INTO events (event_type, event_data, viewer_id, channel_id)
        VALUES (?, ?, ?, ?)
      `).run(
        event.event_type,
        JSON.stringify(event.details),
        event.viewer_id,
        event.channel_id
      );

      return {
        success: true,
        id: result.lastInsertRowid as number
      };
    } catch (error: any) {
      console.error('[EventsRepository] Error inserting event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch insert polling events
   */
  insertBatchEvents(events: EventInput[]): { success: boolean; count?: number; error?: string } {
    try {
      const db = this.getDatabase();
      const stmt = db.prepare(`
        INSERT INTO events (event_type, event_data, viewer_id, channel_id)
        VALUES (?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const event of events) {
          stmt.run(
            event.event_type,
            JSON.stringify(event.details),
            event.viewer_id,
            event.channel_id
          );
        }
      });

      transaction();

      return {
        success: true,
        count: events.length
      };
    } catch (error: any) {
      console.error('[EventsRepository] Error in batch insert:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

---

## Event Types for Polling

### Follower Polling Events

| Event Type | Trigger | Details |
|------------|---------|---------|
| `channel.follow` | New follower detected | `{ username, action: 'follow', followed_at }` |
| `channel.unfollow` | User unfollowed detected | `{ username, action: 'unfollow' }` |

### Moderation Polling Events

| Event Type | Trigger | Details |
|------------|---------|---------|
| `channel.user.banned` | New ban detected | `{ username, moderator_username, reason? }` |
| `channel.user.unbanned` | Ban lifted detected | `{ username }` |
| `channel.user.timed_out` | New timeout detected | `{ username, duration_seconds, expires_at, moderator_username }` |
| `channel.user.timeout_lifted` | Timeout expired/lifted | `{ username }` |

### Role Sync Polling Events

| Event Type | Trigger | Details |
|------------|---------|---------|
| `channel.vip.granted` | User promoted to VIP | `{ username, action: 'granted', role_type: 'vip' }` |
| `channel.vip.revoked` | User demoted from VIP | `{ username, action: 'revoked', role_type: 'vip' }` |
| `channel.moderator.granted` | User promoted to mod | `{ username, action: 'granted', role_type: 'moderator' }` |
| `channel.moderator.revoked` | User demoted from mod | `{ username, action: 'revoked', role_type: 'moderator' }` |

### Subscription Polling Events

| Event Type | Trigger | Details |
|------------|---------|---------|
| `channel.subscribe` | New subscriber detected | `{ username, tier, is_gift? }` |
| `channel.resub` | Existing subscriber renewed | `{ username, tier, cumulative_months }` |
| `channel.unsubscribe` | Subscription lapsed | `{ username }` |

### Clip Polling Events

| Event Type | Trigger | Details |
|------------|---------|---------|
| `channel.clip.created` | New clip detected | `{ clip_title, clip_url, creator_username, view_count }` |

---

## Database Schema

### Events Table (Existing)

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,        -- JSON details
  viewer_id TEXT,
  channel_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
)
```

**Notes:**
- `event_data` stores details as JSON (string)
- `viewer_id` can be NULL for system-level events
- `created_at` automatically records when event occurred

### Polling Config Updates

No schema changes needed. Existing `twitch_polling_config` table already stores polling intervals.

---

## Implementation Steps

### Step 1: Create Polling Event Formatter
- File: `src/backend/services/polling-event-formatter.ts`
- Static methods for each event type
- Returns `EventData` interface
- No dependencies on database or services

### Step 2: Update Events Repository
- Verify/add `insertEvent()` method
- Add `insertBatchEvents()` method
- Use transaction for batch operations

### Step 3: Update DynamicPollingManager
- Import `PollingEventFormatter`
- Add event writing logic in each poll handler
- Use `getOrCreateViewerId()` helper
- Log event creation for debugging

### Step 4: Update TwitchRoleSync Service
- Use formatter for role change events
- Call `eventsRepo.insertEvent()` when role changes detected
- Track state transitions properly

### Step 5: Update TwitchSubscriptions Service
- Use formatter for subscription events
- Detect new/renewed/lapsed subscriptions
- Write events to table

### Step 6: Update TwitchModerators Service
- Use formatter for moderation events
- Track ban/unban/timeout state changes
- Record moderator information

### Step 7: Update TwitchVIP Service
- Use formatter for VIP role changes
- Track VIP grants and revokes

### Step 8: Testing
- Poll manually in dev environment
- Verify events appear in Events screen
- Check event details are accurate
- Test with no state changes (no duplicate events)

---

## Validation Rules

### No Duplicate Events
- Only write events when state actually changes
- Don't record if new poll has same state as previous poll
- Use proper state comparison (sets for lists, etc.)

### Event Details Completeness
- Every event must have:
  - `event_type` - Must match one from the table above
  - `viewer_id` - User involved in the event (can be NULL)
  - `details` - JSON object with relevant information
  - `channel_id` - Which channel detected this

### Timestamps
- Use polling detection time, not current time
- For async events (e.g., ban detected later), record when detected

---

## Configuration

No new configuration needed. Uses existing:
- `twitch_polling_config` table for polling intervals
- Existing polling service implementations
- Existing IPC handlers for polling updates

---

## Integration with Event Actions Feature

Once implemented, polling events automatically work with Event Actions feature:

```
Polled Event (e.g., channel.follow)
    ↓
Written to events table
    ↓
Event Actions manager detects event
    ↓
Triggers configured alerts (text/sound/image/video)
    ↓
Browser source receives notification
```

No additional work needed - Event Actions feature will automatically process polling events.

---

## Frontend Integration

### Events Screen Display

The existing Events screen in `src/frontend/screens/events/events.tsx` will automatically display polling events:

```typescript
// Already works - no changes needed
const events = await ipcRenderer.invoke('events:get-recent', {
  channel_id: channelId,
  limit: 100
});

// events will now include both:
// 1. WebSocket events (real-time)
// 2. Polling events (from pollers)
```

### Event Type Formatting

Ensure `src/frontend/config/event-types.ts` includes all polling event types:

```typescript
export const EVENT_TYPE_CONFIG: Record<string, EventTypeInfo> = {
  'channel.follow': {
    icon: '👥',
    label: 'Follow',
    color: '#0066cc'
  },
  'channel.unfollow': {
    icon: '👤',
    label: 'Unfollow',
    color: '#999999'
  },
  'channel.user.banned': {
    icon: '🚫',
    label: 'Ban',
    color: '#cc0000'
  },
  // ... etc for all polling events
};
```

---

## Error Handling

### Logging

All event insertions should be logged:

```typescript
console.log(`[Polling] Recorded ${eventType} event for ${username}`);
console.error('[Polling] Failed to record event:', error);
```

### Failure Scenarios

1. **Event insertion fails** - Log error, continue polling (don't break)
2. **Viewer creation fails** - Use null for viewer_id, still create event
3. **Channel ID missing** - Skip event entirely, log critical error

### Recovery

- Polling continues even if event insertion fails
- Failed events are not retried (acceptable for poll history)
- Manual intervention: User can manually trigger re-sync if needed

---

## Performance Considerations

### Batch Operations
- For events with many changes (e.g., 50 new followers), use `insertBatchEvents()`
- Wraps multiple inserts in database transaction for efficiency

### Database Indexes
Existing indexes are sufficient:
- `idx_events_type` - For filtering by event type
- `idx_events_channel` - For filtering by channel
- `idx_events_created` - For time-based queries

### Query Performance
- Events screen queries with `LIMIT` clause
- Most queries filter by `channel_id` and `created_at`
- No performance degradation expected

---

## Testing Checklist

- [ ] Follower polling writes follow/unfollow events
- [ ] Moderation polling writes ban/unban/timeout events
- [ ] Role sync writes VIP/mod grant/revoke events
- [ ] No events written when state unchanged
- [ ] Event details are accurate and complete
- [ ] Events appear in Events screen within 5 seconds
- [ ] Batch operations work correctly
- [ ] Database transaction rollback works
- [ ] Polling continues on event insertion failure
- [ ] Null viewer_id handled correctly for system events

---

## Example Usage Flow

### Scenario: New Follower Detected

1. **Followers polling runs** (every 120 seconds)
2. **Compares API response** with previous list
3. **Detects new user: "JaneDoe"**
4. **Creates event payload**:
   ```typescript
   {
     event_type: 'channel.follow',
     viewer_id: 'user-123',
     details: {
       username: 'JaneDoe',
       action: 'follow',
       followed_at: '2025-01-15T14:32:00Z'
     },
     channel_id: 'channel-456'
   }
   ```
5. **Writes to events table**
6. **Event Actions processes it** - if alert configured
7. **User sees in Events screen** - within 5 seconds
8. **Browser source receives alert** - if browser source connected

---

## Future Enhancements

1. **Event Filtering** - Allow users to hide certain polling events
2. **Event Replay** - Manually trigger actions from past events
3. **Event Aggregation** - Group similar events (e.g., "5 new followers")
4. **Event Statistics** - Dashboard showing poll event trends
5. **Event Export** - Export polling events to CSV

---

## Summary

| Aspect | Details |
|--------|---------|
| **Files Created** | 1 - `polling-event-formatter.ts` |
| **Files Modified** | 5 - DynamicPollingManager, Events repo, 3 services |
| **Event Types** | 12+ new event types documented |
| **Database Changes** | None - uses existing events table |
| **Breaking Changes** | None - backward compatible |
| **Estimated Time** | 8-12 hours |
| **Dependencies** | Existing polling framework, EventsRepository |
| **Testing Complexity** | Medium - need to verify state comparison logic |

---

**Status:** 📋 Documentation Complete  
**Next Step:** Implementation  
**Critical Path:** Create PollingEventFormatter → Update DynamicPollingManager → Test

---

**Last Updated:** January 2025  
**Author:** AI Code Analysis  
**Reviewed By:** Pending Implementation
