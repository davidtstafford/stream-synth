# Moderation Status Polling Feature

**Status:** ✅ **IMPLEMENTED** (October 30, 2025)  
**Migration Status:** 🔄 **PARTIAL EVENTSUB AVAILABLE** (Phase 6)

**Implementation:** See [PHASE-3-IMPLEMENTATION-SUMMARY.md](./PHASE-3-IMPLEMENTATION-SUMMARY.md)

---

## ⚠️ Phase 6 Migration Notice

This feature will be **partially optimized** in **Phase 6: Polling → EventSub Conversion**.

### Current State (Phase 3)
- ✅ Polls Twitch API every 1 minute (bans/timeouts)
- ✅ Detects bans, timeouts, unbans, timeout expirations
- ✅ Stores events in database
- ✅ Works reliably

### Future State (Phase 6)
- ⚠️ **Webhook-Only EventSub** - `channel.ban` and `channel.unban` require webhooks
- 🎯 **Cannot use in Electron app** (no webhook server)
- 🎯 **Reduced polling**: 1 minute → 5 minutes (5x reduction)
- 🎯 **API savings**: ~1440/day → ~288/day (80% reduction)
- 💡 **Alternative**: Already have `channel.chat.clear_user_messages` for deleted messages

**Note:** Moderation events are webhook-only, so we'll keep polling but reduce frequency.

See: [PHASE-6-POLLING-TO-SUBSCRIPTIONS.md](./PHASE-6-POLLING-TO-SUBSCRIPTIONS.md)

---

## Overview

This feature implements automatic detection of user moderation status changes via Twitch Helix API polling. The system tracks when users are:
- **Banned** - Permanently prohibited from the channel
- **Timed Out** - Temporarily prohibited from chatting (duration-based)
- **Timeout Lifted** - Timeout period ended or manually removed
- **Unbanned** - Ban removed by moderators

When status changes are detected, the system creates events and optional viewer records, integrating with the Event Actions system for custom alerts.

## Why This Feature?

- **Moderation Tracking**: Know who's banned/timed out and when
- **Historical Data**: Track moderation action history over time
- **Alert Integration**: Trigger alerts for moderation events via Event Actions
- **Current State**: Always know current ban/timeout status
- **Compliance**: Document moderation decisions for transparency

## Technical Architecture

### 1. Database Schema

**New Table: `moderation_history`**

```sql
CREATE TABLE moderation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,              -- Channel where action occurred
  viewer_id TEXT NOT NULL,                -- FK to viewers table
  user_id TEXT NOT NULL,                  -- Twitch user ID
  user_login TEXT NOT NULL,               -- Twitch username
  user_name TEXT,                         -- Twitch display name
  
  -- Action details
  action TEXT NOT NULL,                   -- 'ban', 'timeout', 'unban', 'timeout_lifted'
  reason TEXT,                            -- Ban/timeout reason
  duration_seconds INTEGER,               -- NULL for bans, duration for timeouts
  
  -- Moderator info
  moderator_id TEXT,                      -- Who took the action
  moderator_login TEXT,
  
  -- Timestamps
  action_at TEXT NOT NULL,                -- When action was taken (ISO 8601)
  detected_at TEXT DEFAULT CURRENT_TIMESTAMP, -- When we detected it
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
  CHECK (action IN ('ban', 'timeout', 'unban', 'timeout_lifted'))
);

-- Indexes for performance
CREATE INDEX idx_moderation_history_channel 
  ON moderation_history(channel_id);
CREATE INDEX idx_moderation_history_viewer 
  ON moderation_history(viewer_id);
CREATE INDEX idx_moderation_history_user_id 
  ON moderation_history(user_id);
CREATE INDEX idx_moderation_history_action 
  ON moderation_history(action);
CREATE INDEX idx_moderation_history_detected 
  ON moderation_history(detected_at);

-- Composite index for current state
CREATE INDEX idx_moderation_current_state 
  ON moderation_history(channel_id, user_id, detected_at DESC);
```

**View: `current_moderation_status`** (for efficient current state queries)

```sql
CREATE VIEW current_moderation_status AS
SELECT 
  mh.channel_id,
  mh.viewer_id,
  mh.user_id,
  mh.user_login,
  mh.user_name,
  mh.action,
  mh.reason,
  mh.duration_seconds,
  mh.moderator_id,
  mh.moderator_login,
  mh.action_at,
  mh.detected_at,
  v.display_name,
  v.tts_voice_id,
  v.tts_enabled,
  CASE 
    WHEN mh.action = 'ban' THEN 'banned'
    WHEN mh.action = 'unban' THEN 'active'
    WHEN mh.action = 'timeout' THEN 'timed_out'
    WHEN mh.action = 'timeout_lifted' THEN 'active'
    ELSE 'unknown'
  END AS current_status,
  CASE 
    WHEN mh.action = 'timeout' THEN 
      datetime(mh.action_at, '+' || mh.duration_seconds || ' seconds')
    ELSE NULL
  END AS timeout_expires_at
FROM (
  -- Get most recent action per user per channel
  SELECT 
    channel_id,
    viewer_id,
    user_id,
    user_login,
    user_name,
    action,
    reason,
    duration_seconds,
    moderator_id,
    moderator_login,
    action_at,
    detected_at,
    ROW_NUMBER() OVER (
      PARTITION BY channel_id, user_id 
      ORDER BY detected_at DESC
    ) as rn
  FROM moderation_history
) mh
INNER JOIN viewers v ON mh.viewer_id = v.id
WHERE mh.rn = 1
ORDER BY mh.detected_at DESC;
```

**Migration Addition** (in `src/backend/database/migrations.ts`):

```typescript
// Add moderation_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_login TEXT NOT NULL,
    user_name TEXT,
    
    action TEXT NOT NULL,
    reason TEXT,
    duration_seconds INTEGER,
    
    moderator_id TEXT,
    moderator_login TEXT,
    
    action_at TEXT NOT NULL,
    detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
    CHECK (action IN ('ban', 'timeout', 'unban', 'timeout_lifted'))
  )
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_history_channel 
  ON moderation_history(channel_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_history_viewer 
  ON moderation_history(viewer_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_history_user_id 
  ON moderation_history(user_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_history_action 
  ON moderation_history(action)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_history_detected 
  ON moderation_history(detected_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_moderation_current_state 
  ON moderation_history(channel_id, user_id, detected_at DESC)
`);

// Create view
db.exec(`
  CREATE VIEW IF NOT EXISTS current_moderation_status AS
  SELECT 
    mh.channel_id,
    mh.viewer_id,
    mh.user_id,
    mh.user_login,
    mh.user_name,
    mh.action,
    mh.reason,
    mh.duration_seconds,
    mh.moderator_id,
    mh.moderator_login,
    mh.action_at,
    mh.detected_at,
    v.display_name,
    v.tts_voice_id,
    v.tts_enabled,
    CASE 
      WHEN mh.action = 'ban' THEN 'banned'
      WHEN mh.action = 'unban' THEN 'active'
      WHEN mh.action = 'timeout' THEN 'timed_out'
      WHEN mh.action = 'timeout_lifted' THEN 'active'
      ELSE 'unknown'
    END AS current_status,
    CASE 
      WHEN mh.action = 'timeout' THEN 
        datetime(mh.action_at, '+' || mh.duration_seconds || ' seconds')
      ELSE NULL
    END AS timeout_expires_at
  FROM (
    SELECT 
      channel_id,
      viewer_id,
      user_id,
      user_login,
      user_name,
      action,
      reason,
      duration_seconds,
      moderator_id,
      moderator_login,
      action_at,
      detected_at,
      ROW_NUMBER() OVER (
        PARTITION BY channel_id, user_id 
        ORDER BY detected_at DESC
      ) as rn
    FROM moderation_history
  ) mh
  INNER JOIN viewers v ON mh.viewer_id = v.id
  WHERE mh.rn = 1
  ORDER BY mh.detected_at DESC
`);

// Add polling config for moderation status
db.exec(`
  INSERT INTO twitch_polling_config (
    api_type, interval_value, min_interval, max_interval, interval_units, step, description
  ) VALUES 
    ('moderation_status', 300, 60, 1800, 'seconds', 30, 'Track ban/timeout status changes')
  ON CONFLICT(api_type) DO UPDATE SET 
    description = excluded.description,
    min_interval = excluded.min_interval,
    max_interval = excluded.max_interval,
    interval_units = excluded.interval_units,
    step = excluded.step,
    updated_at = CURRENT_TIMESTAMP
`);
```

### 2. Backend Implementation

#### 2.1 Moderation History Repository

**File**: `src/backend/database/repositories/moderation-history.ts` (NEW)

```typescript
import { Database } from 'better-sqlite3';
import { getDatabase } from '../connection';

export type ModerationAction = 'ban' | 'timeout' | 'unban' | 'timeout_lifted';
export type ModerationStatus = 'banned' | 'timed_out' | 'active' | 'unknown';

export interface ModerationHistoryEntry {
  id?: number;
  channel_id: string;
  viewer_id: string;
  user_id: string;
  user_login: string;
  user_name?: string;
  action: ModerationAction;
  reason?: string;
  duration_seconds?: number;     // For timeouts
  moderator_id?: string;
  moderator_login?: string;
  action_at: string;             // ISO 8601
  detected_at?: string;
}

export interface CurrentModerationStatus {
  channel_id: string;
  viewer_id: string;
  user_id: string;
  user_login: string;
  user_name?: string;
  action: ModerationAction;
  reason?: string;
  duration_seconds?: number;
  moderator_id?: string;
  moderator_login?: string;
  action_at: string;
  detected_at: string;
  display_name?: string;
  current_status: ModerationStatus;
  timeout_expires_at?: string;
}

export interface ModerationFilters {
  channelId?: string;
  userId?: string;
  action?: ModerationAction;
  status?: ModerationStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class ModerationHistoryRepository {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Record a moderation action
   */
  async record(entry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'>): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO moderation_history (
          channel_id, viewer_id, user_id, user_login, user_name,
          action, reason, duration_seconds,
          moderator_id, moderator_login, action_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        entry.channel_id,
        entry.viewer_id,
        entry.user_id,
        entry.user_login,
        entry.user_name || null,
        entry.action,
        entry.reason || null,
        entry.duration_seconds || null,
        entry.moderator_id || null,
        entry.moderator_login || null,
        entry.action_at
      );

      return { success: true, id: result.lastInsertRowid as number };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current moderation status for a user
   */
  async getCurrentStatus(channelId: string, userId: string): Promise<CurrentModerationStatus | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM current_moderation_status
      WHERE channel_id = ? AND user_id = ?
      LIMIT 1
    `);

    return stmt.get(channelId, userId) as CurrentModerationStatus | null;
  }

  /**
   * Get all users with active bans/timeouts
   */
  async getActiveModerations(channelId: string, limit?: number, offset?: number): Promise<{ success: boolean; moderations?: CurrentModerationStatus[]; error?: string }> {
    try {
      let query = `
        SELECT * FROM current_moderation_status
        WHERE channel_id = ? AND current_status IN ('banned', 'timed_out')
        ORDER BY detected_at DESC
      `;
      const params: any[] = [channelId];

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }

      const stmt = this.db.prepare(query);
      const moderations = stmt.all(...params) as CurrentModerationStatus[];

      return { success: true, moderations };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get moderation history with filters
   */
  async getHistory(filters: ModerationFilters): Promise<{ success: boolean; entries?: ModerationHistoryEntry[]; error?: string }> {
    try {
      let query = 'SELECT * FROM moderation_history WHERE 1=1';
      const params: any[] = [];

      if (filters.channelId) {
        query += ' AND channel_id = ?';
        params.push(filters.channelId);
      }

      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.startDate) {
        query += ' AND detected_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND detected_at <= ?';
        params.push(filters.endDate);
      }

      query += ' ORDER BY detected_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const entries = stmt.all(...params) as ModerationHistoryEntry[];

      return { success: true, entries };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get moderation statistics
   */
  async getStats(channelId: string): Promise<{ 
    success: boolean; 
    stats?: {
      currently_banned: number;
      currently_timed_out: number;
      total_bans: number;
      total_timeouts: number;
      total_unbans: number;
      total_timeouts_lifted: number;
      bans_today: number;
      timeouts_today: number;
    };
    error?: string;
  }> {
    try {
      // Currently banned
      const bannedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM current_moderation_status
        WHERE channel_id = ? AND current_status = 'banned'
      `);
      const bannedResult = bannedStmt.get(channelId) as { count: number };

      // Currently timed out
      const timedOutStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM current_moderation_status
        WHERE channel_id = ? AND current_status = 'timed_out'
      `);
      const timedOutResult = timedOutStmt.get(channelId) as { count: number };

      // Total bans
      const totalBansStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'ban'
      `);
      const totalBansResult = totalBansStmt.get(channelId) as { count: number };

      // Total timeouts
      const totalTimeoutsStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'timeout'
      `);
      const totalTimeoutsResult = totalTimeoutsStmt.get(channelId) as { count: number };

      // Total unbans
      const totalUnbansStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'unban'
      `);
      const totalUnbansResult = totalUnbansStmt.get(channelId) as { count: number };

      // Total timeouts lifted
      const liftedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'timeout_lifted'
      `);
      const liftedResult = liftedStmt.get(channelId) as { count: number };

      // Bans today
      const bansToday = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'ban'
          AND DATE(detected_at) = DATE('now')
      `);
      const bansTodayResult = bansToday.get(channelId) as { count: number };

      // Timeouts today
      const timeoutsToday = this.db.prepare(`
        SELECT COUNT(*) as count FROM moderation_history
        WHERE channel_id = ? AND action = 'timeout'
          AND DATE(detected_at) = DATE('now')
      `);
      const timeoutsTodayResult = timeoutsToday.get(channelId) as { count: number };

      return {
        success: true,
        stats: {
          currently_banned: bannedResult.count,
          currently_timed_out: timedOutResult.count,
          total_bans: totalBansResult.count,
          total_timeouts: totalTimeoutsResult.count,
          total_unbans: totalUnbansResult.count,
          total_timeouts_lifted: liftedResult.count,
          bans_today: bansTodayResult.count,
          timeouts_today: timeoutsTodayResult.count
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
```

#### 2.2 Moderation Status Polling Service

**File**: `src/backend/services/twitch-moderation.ts` (NEW)

```typescript
import { BrowserWindow } from 'electron';
import { ModerationHistoryRepository } from '../database/repositories/moderation-history';
import { ViewersRepository } from '../database/repositories/viewers';
import { EventsRepository } from '../database/repositories/events';

interface TwitchModerationEntry {
  user_id: string;
  user_login: string;
  user_name: string;
  expires_at?: string;  // For timeouts
}

export class TwitchModerationService {
  private modRepo: ModerationHistoryRepository;
  private viewerRepo: ViewersRepository;
  private eventRepo: EventsRepository;
  private mainWindow: BrowserWindow | null;
  private knownStatuses: Map<string, Map<string, 'banned' | 'timed_out' | 'active'>>; // channelId -> userId -> status

  constructor(mainWindow: BrowserWindow | null) {
    this.modRepo = new ModerationHistoryRepository();
    this.viewerRepo = new ViewersRepository();
    this.eventRepo = new EventsRepository();
    this.mainWindow = mainWindow;
    this.knownStatuses = new Map();
  }

  /**
   * Initialize known moderation statuses from database
   */
  async initializeKnownStatuses(channelId: string): Promise<void> {
    console.log(`[Moderation] Initializing known statuses for channel ${channelId}`);

    const result = await this.modRepo.getActiveModerations(channelId);

    if (result.success && result.moderations) {
      const statusMap = new Map<string, 'banned' | 'timed_out' | 'active'>();
      for (const mod of result.moderations) {
        statusMap.set(mod.user_id, mod.current_status as 'banned' | 'timed_out' | 'active');
      }
      this.knownStatuses.set(channelId, statusMap);
      console.log(`[Moderation] Loaded ${statusMap.size} known moderation statuses`);
    } else {
      this.knownStatuses.set(channelId, new Map());
    }
  }

  /**
   * Poll for banned users
   */
  async pollBannedUsers(channelId: string, broadcasterId: string, accessToken: string, clientId: string): Promise<void> {
    try {
      console.log(`[Moderation] Polling banned users for channel ${channelId}`);

      if (!this.knownStatuses.has(channelId)) {
        await this.initializeKnownStatuses(channelId);
      }

      const bannedUsers = await this.fetchBannedUsers(broadcasterId, accessToken, clientId);
      const bannedSet = new Set(bannedUsers.map(u => u.user_id));
      const statusMap = this.knownStatuses.get(channelId)!;

      // Check for new bans
      for (const bannedUser of bannedUsers) {
        const previousStatus = statusMap.get(bannedUser.user_id);
        
        if (previousStatus !== 'banned') {
          await this.processBanAction(channelId, bannedUser, previousStatus);
          statusMap.set(bannedUser.user_id, 'banned');
        }
      }

      // Check for unbans (users who were banned but no longer are)
      for (const [userId, status] of statusMap.entries()) {
        if (status === 'banned' && !bannedSet.has(userId)) {
          const viewer = await this.viewerRepo.getById(userId);
          if (viewer?.success && viewer.viewer) {
            await this.processUnbanAction(channelId, viewer.viewer, userId);
            statusMap.delete(userId);
          }
        }
      }

    } catch (error) {
      console.error('[Moderation] Error polling banned users:', error);
    }
  }

  /**
   * Poll for timed out users
   */
  async pollTimedOutUsers(channelId: string, broadcasterId: string, accessToken: string, clientId: string): Promise<void> {
    try {
      console.log(`[Moderation] Polling timed out users for channel ${channelId}`);

      if (!this.knownStatuses.has(channelId)) {
        await this.initializeKnownStatuses(channelId);
      }

      const timedOutUsers = await this.fetchTimedOutUsers(broadcasterId, accessToken, clientId);
      const timedOutSet = new Set(timedOutUsers.map(u => u.user_id));
      const statusMap = this.knownStatuses.get(channelId)!;

      // Check for new timeouts
      for (const timedOutUser of timedOutUsers) {
        const previousStatus = statusMap.get(timedOutUser.user_id);
        
        if (previousStatus !== 'timed_out') {
          await this.processTimeoutAction(channelId, timedOutUser, previousStatus);
          statusMap.set(timedOutUser.user_id, 'timed_out');
        }
      }

      // Check for timeout lifts (users who were timed out but no longer are)
      for (const [userId, status] of statusMap.entries()) {
        if (status === 'timed_out' && !timedOutSet.has(userId)) {
          const viewer = await this.viewerRepo.getById(userId);
          if (viewer?.success && viewer.viewer) {
            await this.processTimeoutLiftAction(channelId, viewer.viewer, userId);
            statusMap.delete(userId);
          }
        }
      }

    } catch (error) {
      console.error('[Moderation] Error polling timed out users:', error);
    }
  }

  /**
   * Fetch banned users from Twitch API
   */
  private async fetchBannedUsers(broadcasterId: string, accessToken: string, clientId: string): Promise<TwitchModerationEntry[]> {
    let allBanned: TwitchModerationEntry[] = [];
    let cursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        broadcaster_id: broadcasterId,
        first: '100'
      });

      if (cursor) {
        queryParams.append('after', cursor);
      }

      const response = await fetch(
        `https://api.twitch.tv/helix/moderation/banned?${queryParams}`,
        {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
      }

      const data: any = await response.json();
      allBanned = allBanned.concat(data.data || []);
      cursor = data.pagination?.cursor;

    } while (cursor && allBanned.length < 5000);

    return allBanned;
  }

  /**
   * Fetch timed out users from Twitch API
   */
  private async fetchTimedOutUsers(broadcasterId: string, accessToken: string, clientId: string): Promise<TwitchModerationEntry[]> {
    let allTimedOut: TwitchModerationEntry[] = [];
    let cursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        broadcaster_id: broadcasterId,
        first: '100'
      });

      if (cursor) {
        queryParams.append('after', cursor);
      }

      const response = await fetch(
        `https://api.twitch.tv/helix/moderation/blocked_terms?${queryParams}`,
        {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
      }

      const data: any = await response.json();
      
      // Filter for active timeouts (expires_at in future)
      const now = new Date();
      const activeTimeouts = (data.data || []).filter((entry: any) => {
        if (!entry.expires_at) return false;
        return new Date(entry.expires_at) > now;
      });

      allTimedOut = allTimedOut.concat(activeTimeouts);
      cursor = data.pagination?.cursor;

    } while (cursor && allTimedOut.length < 5000);

    return allTimedOut;
  }

  /**
   * Process a new ban
   */
  private async processBanAction(channelId: string, user: TwitchModerationEntry, previousStatus?: string): Promise<void> {
    try {
      console.log(`[Moderation] Ban detected: ${user.user_login} (${user.user_id})`);

      // 1. Ensure viewer exists
      let viewerResult = await this.viewerRepo.getById(user.user_id);
      if (!viewerResult.success || !viewerResult.viewer) {
        const createResult = await this.viewerRepo.create({
          id: user.user_id,
          username: user.user_login,
          display_name: user.user_name
        });

        if (!createResult.success) {
          console.error('[Moderation] Failed to create viewer:', createResult.error);
          return;
        }
      }

      // 2. Record in moderation_history
      const historyResult = await this.modRepo.record({
        channel_id: channelId,
        viewer_id: user.user_id,
        user_id: user.user_id,
        user_login: user.user_login,
        user_name: user.user_name,
        action: 'ban',
        action_at: new Date().toISOString()
      });

      if (!historyResult.success) {
        console.error('[Moderation] Failed to record ban:', historyResult.error);
        return;
      }

      // 3. Create event
      const eventData = {
        user_id: user.user_id,
        user_login: user.user_login,
        user_name: user.user_name,
        previous_status: previousStatus
      };

      await this.eventRepo.create({
        event_type: 'channel.user.banned',
        event_data: JSON.stringify(eventData),
        viewer_id: user.user_id,
        channel_id: channelId
      });

      // 4. Emit IPC event
      if (this.mainWindow) {
        this.mainWindow.webContents.send('event:stored', {
          event_type: 'channel.user.banned',
          event_data: eventData,
          viewer_id: user.user_id,
          viewer_username: user.user_login,
          viewer_display_name: user.user_name,
          channel_id: channelId,
          created_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[Moderation] Error processing ban:', error);
    }
  }

  /**
   * Process an unban
   */
  private async processUnbanAction(channelId: string, viewer: any, userId: string): Promise<void> {
    try {
      console.log(`[Moderation] Unban detected: ${viewer.username} (${userId})`);

      const historyResult = await this.modRepo.record({
        channel_id: channelId,
        viewer_id: userId,
        user_id: userId,
        user_login: viewer.username,
        user_name: viewer.display_name,
        action: 'unban',
        action_at: new Date().toISOString()
      });

      if (!historyResult.success) {
        console.error('[Moderation] Failed to record unban:', historyResult.error);
        return;
      }

      // Create event
      const eventData = {
        user_id: userId,
        user_login: viewer.username,
        user_name: viewer.display_name
      };

      await this.eventRepo.create({
        event_type: 'channel.user.unbanned',
        event_data: JSON.stringify(eventData),
        viewer_id: userId,
        channel_id: channelId
      });

      if (this.mainWindow) {
        this.mainWindow.webContents.send('event:stored', {
          event_type: 'channel.user.unbanned',
          event_data: eventData,
          viewer_id: userId,
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name,
          channel_id: channelId,
          created_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[Moderation] Error processing unban:', error);
    }
  }

  /**
   * Process a new timeout
   */
  private async processTimeoutAction(channelId: string, user: TwitchModerationEntry, previousStatus?: string): Promise<void> {
    try {
      console.log(`[Moderation] Timeout detected: ${user.user_login} (${user.user_id})`);

      // 1. Ensure viewer exists
      let viewerResult = await this.viewerRepo.getById(user.user_id);
      if (!viewerResult.success || !viewerResult.viewer) {
        const createResult = await this.viewerRepo.create({
          id: user.user_id,
          username: user.user_login,
          display_name: user.user_name
        });

        if (!createResult.success) {
          console.error('[Moderation] Failed to create viewer:', createResult.error);
          return;
        }
      }

      // Calculate duration
      const now = new Date();
      const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
      const durationSeconds = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : 0;

      // 2. Record in moderation_history
      const historyResult = await this.modRepo.record({
        channel_id: channelId,
        viewer_id: user.user_id,
        user_id: user.user_id,
        user_login: user.user_login,
        user_name: user.user_name,
        action: 'timeout',
        duration_seconds: durationSeconds,
        action_at: new Date().toISOString()
      });

      if (!historyResult.success) {
        console.error('[Moderation] Failed to record timeout:', historyResult.error);
        return;
      }

      // 3. Create event
      const eventData = {
        user_id: user.user_id,
        user_login: user.user_login,
        user_name: user.user_name,
        duration_seconds: durationSeconds,
        expires_at: user.expires_at,
        previous_status: previousStatus
      };

      await this.eventRepo.create({
        event_type: 'channel.user.timed_out',
        event_data: JSON.stringify(eventData),
        viewer_id: user.user_id,
        channel_id: channelId
      });

      if (this.mainWindow) {
        this.mainWindow.webContents.send('event:stored', {
          event_type: 'channel.user.timed_out',
          event_data: eventData,
          viewer_id: user.user_id,
          viewer_username: user.user_login,
          viewer_display_name: user.user_name,
          channel_id: channelId,
          created_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[Moderation] Error processing timeout:', error);
    }
  }

  /**
   * Process a timeout lift
   */
  private async processTimeoutLiftAction(channelId: string, viewer: any, userId: string): Promise<void> {
    try {
      console.log(`[Moderation] Timeout lift detected: ${viewer.username} (${userId})`);

      const historyResult = await this.modRepo.record({
        channel_id: channelId,
        viewer_id: userId,
        user_id: userId,
        user_login: viewer.username,
        user_name: viewer.display_name,
        action: 'timeout_lifted',
        action_at: new Date().toISOString()
      });

      if (!historyResult.success) {
        console.error('[Moderation] Failed to record timeout lift:', historyResult.error);
        return;
      }

      // Create event
      const eventData = {
        user_id: userId,
        user_login: viewer.username,
        user_name: viewer.display_name
      };

      await this.eventRepo.create({
        event_type: 'channel.user.timeout_lifted',
        event_data: JSON.stringify(eventData),
        viewer_id: userId,
        channel_id: channelId
      });

      if (this.mainWindow) {
        this.mainWindow.webContents.send('event:stored', {
          event_type: 'channel.user.timeout_lifted',
          event_data: eventData,
          viewer_id: userId,
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name,
          channel_id: channelId,
          created_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[Moderation] Error processing timeout lift:', error);
    }
  }

  /**
   * Get statistics
   */
  async getStats(channelId: string) {
    return await this.modRepo.getStats(channelId);
  }
}
```

### 3. Event Formatter Integration

**Add to Event Formatter** (`src/shared/utils/event-formatter.ts`):

```typescript
case 'channel.user.banned':
  const bannedUser = data.user_name || data.user_login || displayName;
  return {
    html: `<strong style="color: #f44336">🚫 ${bannedUser}</strong> was banned`,
    plainText: `${bannedUser} was banned`,
    emoji: '🚫',
    variables: { ...variables, banned_user: bannedUser }
  };

case 'channel.user.timed_out':
  const timedOutUser = data.user_name || data.user_login || displayName;
  const durationMin = Math.floor((data.duration_seconds || 0) / 60);
  return {
    html: `<strong style="color: #FF9800">⏰ ${timedOutUser}</strong> timed out for ${durationMin} minute${durationMin !== 1 ? 's' : ''}`,
    plainText: `${timedOutUser} timed out for ${durationMin} minutes`,
    emoji: '⏰',
    variables: { ...variables, timed_out_user: timedOutUser, duration_minutes: durationMin }
  };

case 'channel.user.unbanned':
  const unbannedUser = data.user_name || data.user_login || displayName;
  return {
    html: `<strong style="color: #4CAF50">✅ ${unbannedUser}</strong> was unbanned`,
    plainText: `${unbannedUser} was unbanned`,
    emoji: '✅',
    variables: { ...variables, unbanned_user: unbannedUser }
  };

case 'channel.user.timeout_lifted':
  const liftedUser = data.user_name || data.user_login || displayName;
  return {
    html: `<strong style="color: #2196F3">🔓 ${liftedUser}</strong> timeout was lifted`,
    plainText: `${liftedUser} timeout was lifted`,
    emoji: '🔓',
    variables: { ...variables, lifted_user: liftedUser }
  };
```

### 4. Integration with Polling Manager

**File**: `src/backend/services/dynamic-polling-manager.ts` (MODIFY)

Add to constructor and polling type:

```typescript
import { TwitchModerationService } from './twitch-moderation';

export type PollType = 'role_sync' | 'followers' | 'moderation_status';

private moderationService: TwitchModerationService;

constructor(mainWindow: BrowserWindow | null) {
  // ...existing code...
  this.moderationService = new TwitchModerationService(mainWindow);
}

private async handlePollExecution(channelId: string, type: PollType): Promise<void> {
  // ...existing code...

  switch (type) {
    // ...existing cases...

    case 'moderation_status':
      await this.pollModerationStatus(channelId);
      break;
  }
}

private async pollModerationStatus(channelId: string): Promise<void> {
  try {
    const channel = await channelRepo.getById(channelId);
    if (!channel) return;

    const token = await tokenRepo.getByUserId(channel.user_id);
    if (!token) return;

    // Poll both bans and timeouts
    await Promise.all([
      this.moderationService.pollBannedUsers(
        channelId,
        channel.broadcaster_id,
        token.access_token,
        token.client_id
      ),
      this.moderationService.pollTimedOutUsers(
        channelId,
        channel.broadcaster_id,
        token.access_token,
        token.client_id
      )
    ]);

    console.log(`[Polling] Moderation status poll completed for channel ${channelId}`);
  } catch (error) {
    console.error(`[Polling] Error polling moderation status for channel ${channelId}:`, error);
  }
}
```

### 5. IPC Handlers

**File**: `src/backend/core/ipc-handlers/moderation.ts` (NEW)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ModerationHistoryRepository, ModerationFilters } from '../../database/repositories/moderation-history';

export function registerModerationHandlers() {
  const repo = new ModerationHistoryRepository();

  ipcMain.handle('moderation:getCurrentStatus', async (_event: IpcMainInvokeEvent, channelId: string, userId: string) => {
    return await repo.getCurrentStatus(channelId, userId);
  });

  ipcMain.handle('moderation:getActiveModerations', async (_event: IpcMainInvokeEvent, channelId: string, limit?: number, offset?: number) => {
    return await repo.getActiveModerations(channelId, limit, offset);
  });

  ipcMain.handle('moderation:getHistory', async (_event: IpcMainInvokeEvent, filters: ModerationFilters) => {
    return await repo.getHistory(filters);
  });

  ipcMain.handle('moderation:getStats', async (_event: IpcMainInvokeEvent, channelId: string) => {
    return await repo.getStats(channelId);
  });

  console.log('[IPC] Moderation handlers registered');
}
```

**Register in**: `src/backend/core/ipc-handlers/index.ts`

```typescript
import { registerModerationHandlers } from './moderation';

export function registerAllHandlers() {
  // ...existing handlers...
  registerModerationHandlers();
}
```

### 6. Frontend Screen

**File**: `src/frontend/screens/moderation/moderation.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface ModerationStatus {
  channel_id: string;
  user_id: string;
  user_login: string;
  user_name?: string;
  current_status: 'banned' | 'timed_out' | 'active' | 'unknown';
  reason?: string;
  action_at: string;
  detected_at: string;
  display_name?: string;
  timeout_expires_at?: string;
}

interface ModerationStats {
  currently_banned: number;
  currently_timed_out: number;
  total_bans: number;
  total_timeouts: number;
  total_unbans: number;
  total_timeouts_lifted: number;
  bans_today: number;
  timeouts_today: number;
}

export const ModerationScreen: React.FC<{ channelId?: string }> = ({ channelId }) => {
  const [moderations, setModerations] = useState<ModerationStatus[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (channelId) {
      loadModerations();
      loadStats();
    }
  }, [channelId, offset, tab]);

  useEffect(() => {
    const handleModerationEvent = () => {
      loadModerations();
      loadStats();
    };

    ipcRenderer.on('event:stored', (_event: any, eventData: any) => {
      if (['channel.user.banned', 'channel.user.timed_out', 'channel.user.unbanned', 'channel.user.timeout_lifted'].includes(eventData.event_type) 
          && eventData.channel_id === channelId) {
        handleModerationEvent();
      }
    });

    return () => {
      ipcRenderer.removeAllListeners('event:stored');
    };
  }, [channelId]);

  const loadModerations = async () => {
    setLoading(true);
    const result = await ipcRenderer.invoke('moderation:getActiveModerations', channelId, limit, offset);
    
    if (result.success) {
      setModerations(result.moderations || []);
      setTotalCount(result.moderations?.length || 0);
    }
    
    setLoading(false);
  };

  const loadStats = async () => {
    const result = await ipcRenderer.invoke('moderation:getStats', channelId);
    
    if (result.success) {
      setStats(result.stats);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'banned':
        return '#f44336';
      case 'timed_out':
        return '#FF9800';
      case 'active':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'banned':
        return '🚫';
      case 'timed_out':
        return '⏰';
      case 'active':
        return '✅';
      default:
        return '❓';
    }
  };

  return (
    <div className="content">
      <h2>Moderation</h2>

      {/* Statistics */}
      {stats && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0 }}>Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
                {stats.currently_banned}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Currently Banned</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                {stats.currently_timed_out}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Currently Timed Out</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                {stats.total_bans}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Total Bans</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9C27B0' }}>
                {stats.total_timeouts}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Total Timeouts</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                {stats.bans_today}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Bans Today</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00BCD4' }}>
                {stats.timeouts_today}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Timeouts Today</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => { setTab('active'); setOffset(0); }}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'active' ? '#9147ff' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Active Moderations
        </button>
        <button
          onClick={() => { setTab('history'); setOffset(0); }}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'history' ? '#9147ff' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          History
        </button>
      </div>

      {/* Content */}
      {loading && <div>Loading...</div>}

      {!loading && moderations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No {tab === 'active' ? 'active moderations' : 'history'} found.
        </div>
      )}

      {!loading && moderations.length > 0 && (
        <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Username</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Action Date</th>
                {tab === 'active' && (
                  <>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Duration</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Expires</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {moderations.map((mod, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px', color: getStatusColor(mod.current_status) }}>
                    {getStatusIcon(mod.current_status)} {mod.current_status}
                  </td>
                  <td style={{ padding: '10px' }}>{mod.user_login}</td>
                  <td style={{ padding: '10px' }}>{formatDate(mod.action_at)}</td>
                  {tab === 'active' && (
                    <>
                      <td style={{ padding: '10px' }}>
                        {mod.current_status === 'timed_out' ? '⏰' : '-'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {mod.timeout_expires_at ? formatDate(mod.timeout_expires_at) : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && moderations.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: offset === 0 ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          <span style={{ color: '#888' }}>
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(totalCount / limit)}
          </span>
          
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalCount}
            style={{
              padding: '8px 16px',
              backgroundColor: offset + limit >= totalCount ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset + limit >= totalCount ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

## Implementation Checklist

### Backend
- [ ] Add `moderation_history` table migration to `migrations.ts`
- [ ] Add `current_moderation_status` view migration
- [ ] Add polling config entry for `moderation_status`
- [ ] Create `ModerationHistoryRepository` class
- [ ] Create `TwitchModerationService` class
- [ ] Integrate with `DynamicPollingManager`
- [ ] Create IPC handlers in `moderation.ts`
- [ ] Register handlers in `index.ts`
- [ ] Add moderation events to event formatter

### Frontend
- [ ] Create `ModerationScreen` component
- [ ] Add moderation navigation to `Menu.tsx`
- [ ] Listen for moderation events in Events screen
- [ ] Add statistics dashboard
- [ ] Test real-time updates

### Event Actions Integration
- [ ] Add 4 moderation events to formatter:
  - `channel.user.banned`
  - `channel.user.timed_out`
  - `channel.user.unbanned`
  - `channel.user.timeout_lifted`
- [ ] Create alert templates for each

### Testing
- [ ] Test ban detection
- [ ] Test timeout detection
- [ ] Test unban detection
- [ ] Test timeout lift detection
- [ ] Test real-time events
- [ ] Test viewer creation
- [ ] Test statistics accuracy

## Event Types Available for Alerts

1. **`channel.user.banned`** - User was banned
2. **`channel.user.timed_out`** - User was timed out
3. **`channel.user.unbanned`** - User was unbanned
4. **`channel.user.timeout_lifted`** - Timeout was lifted

All integrate seamlessly with Event Actions feature for custom alerts!

## Polling Configuration

The polling interval is configurable in `twitch_polling_config`:

```sql
('moderation_status', 300, 60, 1800, 'seconds', 30, 'Track ban/timeout status changes')
```

- **Default**: 300 seconds (5 minutes)
- **Range**: 60-1800 seconds (1-30 minutes)
- **Step**: 30 seconds

## Data Flow

```
Every 5 minutes:
  ↓
1. Poll /helix/moderation/banned
2. Poll /helix/moderation/blocks (for timeouts)
  ↓
3. Compare with known statuses (in-memory Map)
  ↓
4. For status changes:
   ├─ Create/update viewer
   ├─ Record in moderation_history
   ├─ Create event
   └─ Emit IPC to frontend
  ↓
5. Frontend updates:
   ├─ Events screen shows moderation event
   ├─ Moderation screen updated
   └─ Event Actions triggers alert 🔔
```

## Performance Notes

- **API Calls**: 2 requests per poll (bans + timeouts)
- **Memory**: ~100 bytes per tracked user
- **Database**: Efficient indexes for fast queries
- **Frequency**: Configurable 1-30 minute intervals

---

**Status**: Planned (Not Yet Implemented)  
**Priority**: High  
**Dependencies**:
- `events` table (exists)
- `viewers` table (exists)
- `twitch_polling_config` table (exists)

**Estimated Time**: 10-14 hours (1.5-2 days)
