# Follower Polling Feature

## Overview

This feature completes the follower polling system by implementing automatic detection of new followers via the Twitch Helix API. When a new follower is detected, the system will:

1. **Create Event**: Store a `channel.follow` event in the `events` table
2. **Create/Update Viewer**: Ensure viewer exists in `viewers` table
3. **Track Follow State**: Record follow/unfollow history in new `follower_history` table
4. **Trigger Alerts**: Make follower events available to Event Actions system (future integration)

## Why This Feature?

- **Follow Tracking**: Know who follows and when
- **Historical Data**: Track follow/unfollow patterns over time
- **Alert Integration**: Trigger alerts when new followers detected (via Event Actions feature)
- **Viewer Database**: Auto-create viewer records for followers
- **Current State**: Always know if someone is currently following

## Technical Architecture

### 1. Database Schema

**New Table: `follower_history`**

```sql
CREATE TABLE follower_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,              -- Channel being followed
  viewer_id TEXT NOT NULL,                -- FK to viewers table
  follower_user_id TEXT NOT NULL,         -- Twitch user ID
  follower_user_login TEXT NOT NULL,      -- Twitch username
  follower_user_name TEXT,                -- Twitch display name
  
  -- State tracking
  action TEXT NOT NULL,                   -- 'follow' or 'unfollow'
  followed_at TEXT,                       -- Timestamp from Twitch API (ISO 8601)
  
  -- Detection metadata
  detected_at TEXT DEFAULT CURRENT_TIMESTAMP, -- When we detected this change
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
  CHECK (action IN ('follow', 'unfollow'))
);

-- Indexes for performance
CREATE INDEX idx_follower_history_channel ON follower_history(channel_id);
CREATE INDEX idx_follower_history_viewer ON follower_history(viewer_id);
CREATE INDEX idx_follower_history_user_id ON follower_history(follower_user_id);
CREATE INDEX idx_follower_history_action ON follower_history(action);
CREATE INDEX idx_follower_history_detected ON follower_history(detected_at);
CREATE INDEX idx_follower_history_followed ON follower_history(followed_at);

-- Composite index for current state queries
CREATE INDEX idx_follower_current_state ON follower_history(
  channel_id, 
  follower_user_id, 
  detected_at DESC
);
```

**View: `current_followers`** (for easy current state queries)

```sql
CREATE VIEW current_followers AS
SELECT 
  fh.channel_id,
  fh.viewer_id,
  fh.follower_user_id,
  fh.follower_user_login,
  fh.follower_user_name,
  fh.followed_at,
  fh.detected_at,
  v.display_name,
  v.tts_voice_id,
  v.tts_enabled
FROM (
  -- Get most recent action per user per channel
  SELECT 
    channel_id,
    viewer_id,
    follower_user_id,
    follower_user_login,
    follower_user_name,
    followed_at,
    detected_at,
    action,
    ROW_NUMBER() OVER (
      PARTITION BY channel_id, follower_user_id 
      ORDER BY detected_at DESC
    ) as rn
  FROM follower_history
) fh
INNER JOIN viewers v ON fh.viewer_id = v.id
WHERE fh.rn = 1 
  AND fh.action = 'follow'  -- Only currently following
ORDER BY fh.followed_at DESC;
```

**Migration Addition** (in `src/backend/database/migrations.ts`):

```typescript
// Add to migrations.ts after existing tables

// Create follower_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS follower_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    follower_user_id TEXT NOT NULL,
    follower_user_login TEXT NOT NULL,
    follower_user_name TEXT,
    
    action TEXT NOT NULL,
    followed_at TEXT,
    detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
    CHECK (action IN ('follow', 'unfollow'))
  )
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_channel 
  ON follower_history(channel_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_viewer 
  ON follower_history(viewer_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_user_id 
  ON follower_history(follower_user_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_action 
  ON follower_history(action)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_detected 
  ON follower_history(detected_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_history_followed 
  ON follower_history(followed_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_follower_current_state 
  ON follower_history(channel_id, follower_user_id, detected_at DESC)
`);

// Create view for current followers
db.exec(`
  CREATE VIEW IF NOT EXISTS current_followers AS
  SELECT 
    fh.channel_id,
    fh.viewer_id,
    fh.follower_user_id,
    fh.follower_user_login,
    fh.follower_user_name,
    fh.followed_at,
    fh.detected_at,
    v.display_name,
    v.tts_voice_id,
    v.tts_enabled
  FROM (
    SELECT 
      channel_id,
      viewer_id,
      follower_user_id,
      follower_user_login,
      follower_user_name,
      followed_at,
      detected_at,
      action,
      ROW_NUMBER() OVER (
        PARTITION BY channel_id, follower_user_id 
        ORDER BY detected_at DESC
      ) as rn
    FROM follower_history
  ) fh
  INNER JOIN viewers v ON fh.viewer_id = v.id
  WHERE fh.rn = 1 
    AND fh.action = 'follow'
  ORDER BY fh.followed_at DESC
`);
```

### 2. Twitch API Integration

**Endpoint**: `GET https://api.twitch.tv/helix/channels/followers`

**Query Parameters**:
- `broadcaster_id` - The channel to get followers from (required)
- `first` - Number of followers to return (max 100, default 20)
- `after` - Cursor for pagination

**Response Data** (per follower):
```json
{
  "user_id": "11148817",
  "user_name": "UserDisplayName",
  "user_login": "userlogin",
  "followed_at": "2022-05-24T22:22:08Z"
}
```

**Response Metadata**:
```json
{
  "total": 123,
  "data": [...],
  "pagination": {
    "cursor": "eyJiIjpudWxsLCJhIjoiMTY1MjU..."
  }
}
```

### 3. Backend Implementation

#### 3.1 Follower History Repository

**File**: `src/backend/database/repositories/follower-history.ts` (NEW)

```typescript
import { Database } from 'better-sqlite3';
import { getDatabase } from '../connection';

export interface FollowerHistoryEntry {
  id?: number;
  channel_id: string;
  viewer_id: string;
  follower_user_id: string;
  follower_user_login: string;
  follower_user_name?: string;
  action: 'follow' | 'unfollow';
  followed_at?: string;      // Timestamp from Twitch API
  detected_at?: string;       // When we detected it
}

export interface CurrentFollower {
  channel_id: string;
  viewer_id: string;
  follower_user_id: string;
  follower_user_login: string;
  follower_user_name?: string;
  followed_at: string;
  detected_at: string;
  display_name?: string;
  tts_voice_id?: string;
  tts_enabled?: number;
}

export interface FollowerFilters {
  channelId?: string;
  viewerId?: string;
  userId?: string;
  action?: 'follow' | 'unfollow';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class FollowerHistoryRepository {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Record a follow action
   */
  async recordFollow(entry: Omit<FollowerHistoryEntry, 'id' | 'detected_at' | 'action'>): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO follower_history (
          channel_id, viewer_id, follower_user_id, follower_user_login,
          follower_user_name, action, followed_at
        ) VALUES (?, ?, ?, ?, ?, 'follow', ?)
      `);
      
      const result = stmt.run(
        entry.channel_id,
        entry.viewer_id,
        entry.follower_user_id,
        entry.follower_user_login,
        entry.follower_user_name || null,
        entry.followed_at || null
      );

      return { success: true, id: result.lastInsertRowid as number };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Record an unfollow action
   */
  async recordUnfollow(channelId: string, viewerId: string, userId: string, userLogin: string): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO follower_history (
          channel_id, viewer_id, follower_user_id, follower_user_login,
          action
        ) VALUES (?, ?, ?, ?, 'unfollow')
      `);
      
      const result = stmt.run(channelId, viewerId, userId, userLogin);

      return { success: true, id: result.lastInsertRowid as number };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current follow state for a user
   */
  async getCurrentState(channelId: string, userId: string): Promise<'following' | 'not_following' | null> {
    const stmt = this.db.prepare(`
      SELECT action
      FROM follower_history
      WHERE channel_id = ? AND follower_user_id = ?
      ORDER BY detected_at DESC
      LIMIT 1
    `);
    
    const result = stmt.get(channelId, userId) as { action: string } | undefined;
    
    if (!result) return null;
    return result.action === 'follow' ? 'following' : 'not_following';
  }

  /**
   * Get all current followers for a channel
   */
  async getCurrentFollowers(channelId: string, limit?: number, offset?: number): Promise<{ success: boolean; followers?: CurrentFollower[]; error?: string }> {
    try {
      let query = 'SELECT * FROM current_followers WHERE channel_id = ?';
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
      const followers = stmt.all(...params) as CurrentFollower[];

      return { success: true, followers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get follower count for a channel
   */
  async getFollowerCount(channelId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM current_followers 
        WHERE channel_id = ?
      `);
      
      const result = stmt.get(channelId) as { count: number };

      return { success: true, count: result.count };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get follower history with filters
   */
  async getHistory(filters: FollowerFilters): Promise<{ success: boolean; entries?: FollowerHistoryEntry[]; error?: string }> {
    try {
      let query = 'SELECT * FROM follower_history WHERE 1=1';
      const params: any[] = [];

      if (filters.channelId) {
        query += ' AND channel_id = ?';
        params.push(filters.channelId);
      }

      if (filters.viewerId) {
        query += ' AND viewer_id = ?';
        params.push(filters.viewerId);
      }

      if (filters.userId) {
        query += ' AND follower_user_id = ?';
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
      const entries = stmt.all(...params) as FollowerHistoryEntry[];

      return { success: true, entries };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get follower statistics for a channel
   */
  async getStats(channelId: string): Promise<{ 
    success: boolean; 
    stats?: {
      total_current_followers: number;
      total_follows: number;
      total_unfollows: number;
      new_today: number;
      new_this_week: number;
    };
    error?: string;
  }> {
    try {
      // Current followers
      const currentStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM current_followers WHERE channel_id = ?
      `);
      const currentResult = currentStmt.get(channelId) as { count: number };

      // Total follows
      const followsStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM follower_history 
        WHERE channel_id = ? AND action = 'follow'
      `);
      const followsResult = followsStmt.get(channelId) as { count: number };

      // Total unfollows
      const unfollowsStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM follower_history 
        WHERE channel_id = ? AND action = 'unfollow'
      `);
      const unfollowsResult = unfollowsStmt.get(channelId) as { count: number };

      // New today
      const todayStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM follower_history 
        WHERE channel_id = ? AND action = 'follow'
          AND DATE(detected_at) = DATE('now')
      `);
      const todayResult = todayStmt.get(channelId) as { count: number };

      // New this week
      const weekStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM follower_history 
        WHERE channel_id = ? AND action = 'follow'
          AND DATE(detected_at) >= DATE('now', '-7 days')
      `);
      const weekResult = weekStmt.get(channelId) as { count: number };

      return {
        success: true,
        stats: {
          total_current_followers: currentResult.count,
          total_follows: followsResult.count,
          total_unfollows: unfollowsResult.count,
          new_today: todayResult.count,
          new_this_week: weekResult.count
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
```

#### 3.2 Follower Polling Service

**File**: `src/backend/services/twitch-followers.ts` (NEW)

```typescript
import { BrowserWindow } from 'electron';
import { FollowerHistoryRepository } from '../database/repositories/follower-history';
import { ViewersRepository } from '../database/repositories/viewers';
import { EventsRepository } from '../database/repositories/events';

interface TwitchFollower {
  user_id: string;
  user_login: string;
  user_name: string;
  followed_at: string;
}

interface TwitchFollowersResponse {
  total: number;
  data: TwitchFollower[];
  pagination?: {
    cursor?: string;
  };
}

export class TwitchFollowersService {
  private followerRepo: FollowerHistoryRepository;
  private viewerRepo: ViewersRepository;
  private eventRepo: EventsRepository;
  private mainWindow: BrowserWindow | null;
  private knownFollowers: Map<string, Set<string>>; // channelId -> Set<userId>

  constructor(mainWindow: BrowserWindow | null) {
    this.followerRepo = new FollowerHistoryRepository();
    this.viewerRepo = new ViewersRepository();
    this.eventRepo = new EventsRepository();
    this.mainWindow = mainWindow;
    this.knownFollowers = new Map();
  }

  /**
   * Initialize known followers from database
   */
  async initializeKnownFollowers(channelId: string): Promise<void> {
    console.log(`[Followers] Initializing known followers for channel ${channelId}`);
    
    const result = await this.followerRepo.getCurrentFollowers(channelId);
    
    if (result.success && result.followers) {
      const followerSet = new Set(result.followers.map(f => f.follower_user_id));
      this.knownFollowers.set(channelId, followerSet);
      console.log(`[Followers] Loaded ${followerSet.size} known followers from database`);
    } else {
      this.knownFollowers.set(channelId, new Set());
    }
  }

  /**
   * Poll Twitch API for followers
   */
  async pollFollowers(channelId: string, broadcasterId: string, accessToken: string, clientId: string): Promise<void> {
    try {
      console.log(`[Followers] Polling followers for channel ${channelId}`);

      // Initialize if first run
      if (!this.knownFollowers.has(channelId)) {
        await this.initializeKnownFollowers(channelId);
      }

      const knownSet = this.knownFollowers.get(channelId)!;
      const newFollowers: TwitchFollower[] = [];
      let cursor: string | undefined;
      let totalFetched = 0;

      // Fetch all followers (with pagination)
      do {
        const queryParams = new URLSearchParams({
          broadcaster_id: broadcasterId,
          first: '100'
        });

        if (cursor) {
          queryParams.append('after', cursor);
        }

        const response = await fetch(
          `https://api.twitch.tv/helix/channels/followers?${queryParams}`,
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

        const data: TwitchFollowersResponse = await response.json();
        totalFetched += data.data.length;

        // Check for new followers
        for (const follower of data.data) {
          if (!knownSet.has(follower.user_id)) {
            newFollowers.push(follower);
            knownSet.add(follower.user_id);
          }
        }

        cursor = data.pagination?.cursor;

        // Safety: Don't fetch more than 1000 followers in one poll
        if (totalFetched >= 1000) {
          console.log('[Followers] Reached 1000 follower limit, stopping pagination');
          break;
        }

      } while (cursor);

      console.log(`[Followers] Fetched ${totalFetched} total followers, ${newFollowers.length} new`);

      // Process new followers
      for (const follower of newFollowers) {
        await this.processNewFollower(channelId, follower);
      }

      // Detect unfollows (users in DB but not in API response)
      // Note: This requires fetching ALL followers, which we limit to 1000 for performance
      // For channels with >1000 followers, unfollow detection may be incomplete
      if (totalFetched < 1000) {
        await this.detectUnfollows(channelId, knownSet);
      }

    } catch (error) {
      console.error('[Followers] Error polling followers:', error);
    }
  }

  /**
   * Process a new follower
   */
  private async processNewFollower(channelId: string, follower: TwitchFollower): Promise<void> {
    try {
      console.log(`[Followers] New follower detected: ${follower.user_login} (${follower.user_id})`);

      // 1. Ensure viewer exists
      let viewerResult = await this.viewerRepo.getById(follower.user_id);
      
      if (!viewerResult.success || !viewerResult.viewer) {
        // Create viewer
        console.log(`[Followers] Creating new viewer: ${follower.user_login}`);
        const createResult = await this.viewerRepo.create({
          id: follower.user_id,
          username: follower.user_login,
          display_name: follower.user_name
        });

        if (!createResult.success) {
          console.error('[Followers] Failed to create viewer:', createResult.error);
          return;
        }
      } else {
        // Update display name if changed
        if (viewerResult.viewer.display_name !== follower.user_name) {
          await this.viewerRepo.update(follower.user_id, {
            display_name: follower.user_name
          });
        }
      }

      // 2. Record follow in follower_history
      const historyResult = await this.followerRepo.recordFollow({
        channel_id: channelId,
        viewer_id: follower.user_id,
        follower_user_id: follower.user_id,
        follower_user_login: follower.user_login,
        follower_user_name: follower.user_name,
        followed_at: follower.followed_at
      });

      if (!historyResult.success) {
        console.error('[Followers] Failed to record follow:', historyResult.error);
        return;
      }

      // 3. Create event in events table
      const eventData = {
        user_id: follower.user_id,
        user_login: follower.user_login,
        user_name: follower.user_name,
        followed_at: follower.followed_at
      };

      const eventResult = await this.eventRepo.create({
        event_type: 'channel.follow',
        event_data: JSON.stringify(eventData),
        viewer_id: follower.user_id,
        channel_id: channelId
      });

      if (!eventResult.success) {
        console.error('[Followers] Failed to create event:', eventResult.error);
        return;
      }

      // 4. Emit IPC event for real-time UI updates
      if (this.mainWindow) {
        this.mainWindow.webContents.send('event:stored', {
          id: eventResult.id,
          event_type: 'channel.follow',
          event_data: eventData,
          viewer_id: follower.user_id,
          viewer_username: follower.user_login,
          viewer_display_name: follower.user_name,
          channel_id: channelId,
          created_at: new Date().toISOString()
        });
      }

      console.log(`[Followers] Successfully processed new follower: ${follower.user_login}`);

    } catch (error) {
      console.error('[Followers] Error processing new follower:', error);
    }
  }

  /**
   * Detect users who unfollowed
   */
  private async detectUnfollows(channelId: string, currentFollowers: Set<string>): Promise<void> {
    try {
      // Get previously known followers from DB
      const dbResult = await this.followerRepo.getCurrentFollowers(channelId);
      
      if (!dbResult.success || !dbResult.followers) return;

      for (const dbFollower of dbResult.followers) {
        if (!currentFollowers.has(dbFollower.follower_user_id)) {
          console.log(`[Followers] Unfollow detected: ${dbFollower.follower_user_login}`);

          // Record unfollow
          await this.followerRepo.recordUnfollow(
            channelId,
            dbFollower.viewer_id,
            dbFollower.follower_user_id,
            dbFollower.follower_user_login
          );

          // Optionally: Create unfollow event (if you want to track unfollows as events)
          // For now, we just log it
        }
      }
    } catch (error) {
      console.error('[Followers] Error detecting unfollows:', error);
    }
  }

  /**
   * Get follower statistics
   */
  async getStats(channelId: string) {
    return await this.followerRepo.getStats(channelId);
  }
}
```

#### 3.3 Integration with Dynamic Polling Manager

**File**: `src/backend/services/dynamic-polling-manager.ts` (MODIFY)

```typescript
import { TwitchFollowersService } from './twitch-followers';

export class DynamicPollingManager {
  private followersService: TwitchFollowersService;

  constructor(mainWindow: BrowserWindow | null) {
    // ...existing code...
    this.followersService = new TwitchFollowersService(mainWindow);
  }

  private async handlePollExecution(channelId: string, type: PollType): Promise<void> {
    // ...existing code...

    switch (type) {
      // ...existing cases...

      case 'followers':
        await this.pollFollowers(channelId);
        break;
    }
  }

  private async pollFollowers(channelId: string): Promise<void> {
    try {
      const channel = await channelRepo.getById(channelId);
      if (!channel) return;

      const token = await tokenRepo.getByUserId(channel.user_id);
      if (!token) return;

      await this.followersService.pollFollowers(
        channelId,
        channel.broadcaster_id,
        token.access_token,
        token.client_id
      );

      console.log(`[Polling] Followers poll completed for channel ${channelId}`);
    } catch (error) {
      console.error(`[Polling] Error polling followers for channel ${channelId}:`, error);
    }
  }
}
```

#### 3.4 IPC Handlers

**File**: `src/backend/core/ipc-handlers/followers.ts` (NEW)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { FollowerHistoryRepository, FollowerFilters } from '../../database/repositories/follower-history';

export function registerFollowerHandlers() {
  const repo = new FollowerHistoryRepository();

  ipcMain.handle('followers:getCurrentFollowers', async (_event: IpcMainInvokeEvent, channelId: string, limit?: number, offset?: number) => {
    return await repo.getCurrentFollowers(channelId, limit, offset);
  });

  ipcMain.handle('followers:getFollowerCount', async (_event: IpcMainInvokeEvent, channelId: string) => {
    return await repo.getFollowerCount(channelId);
  });

  ipcMain.handle('followers:getHistory', async (_event: IpcMainInvokeEvent, filters: FollowerFilters) => {
    return await repo.getHistory(filters);
  });

  ipcMain.handle('followers:getStats', async (_event: IpcMainInvokeEvent, channelId: string) => {
    return await repo.getStats(channelId);
  });

  ipcMain.handle('followers:getCurrentState', async (_event: IpcMainInvokeEvent, channelId: string, userId: string) => {
    return await repo.getCurrentState(channelId, userId);
  });

  console.log('[IPC] Follower handlers registered');
}
```

**Register in**: `src/backend/core/ipc-handlers/index.ts`

```typescript
import { registerFollowerHandlers } from './followers';

export function registerAllHandlers() {
  // ...existing handlers...
  registerFollowerHandlers();
}
```

### 4. Frontend Implementation

#### 4.1 Followers Screen

**File**: `src/frontend/screens/followers/followers.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface Follower {
  channel_id: string;
  viewer_id: string;
  follower_user_id: string;
  follower_user_login: string;
  follower_user_name?: string;
  followed_at: string;
  detected_at: string;
  display_name?: string;
}

interface FollowerStats {
  total_current_followers: number;
  total_follows: number;
  total_unfollows: number;
  new_today: number;
  new_this_week: number;
}

export const FollowersScreen: React.FC<{ channelId?: string }> = ({ channelId }) => {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [stats, setStats] = useState<FollowerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (channelId) {
      loadFollowers();
      loadStats();
    }
  }, [channelId, offset]);

  // Listen for new follower events
  useEffect(() => {
    const handleNewFollower = () => {
      loadFollowers();
      loadStats();
    };

    ipcRenderer.on('event:stored', (_event: any, eventData: any) => {
      if (eventData.event_type === 'channel.follow' && eventData.channel_id === channelId) {
        handleNewFollower();
      }
    });

    return () => {
      ipcRenderer.removeAllListeners('event:stored');
    };
  }, [channelId]);

  const loadFollowers = async () => {
    setLoading(true);
    const result = await ipcRenderer.invoke('followers:getCurrentFollowers', channelId, limit, offset);
    
    if (result.success) {
      setFollowers(result.followers || []);
    }
    
    setLoading(false);
  };

  const loadStats = async () => {
    const result = await ipcRenderer.invoke('followers:getStats', channelId);
    
    if (result.success) {
      setStats(result.stats);
      setTotalCount(result.stats.total_current_followers);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="content">
      <h2>Followers</h2>

      {/* Statistics */}
      {stats && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0 }}>Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9147ff' }}>
                {stats.total_current_followers.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Current Followers</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                {stats.total_follows.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Total Follows</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
                {stats.total_unfollows.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>Total Unfollows</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                {stats.new_today.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>New Today</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                {stats.new_this_week.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>New This Week</div>
            </div>
          </div>
        </div>
      )}

      {/* Followers List */}
      <div style={{ marginBottom: '10px', color: '#888' }}>
        Showing {followers.length} of {totalCount} followers
      </div>

      {loading && <div>Loading followers...</div>}

      {!loading && followers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No followers found. Follower polling will automatically detect new followers.
        </div>
      )}

      {!loading && followers.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Username</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Display Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Followed At</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Detected At</th>
              </tr>
            </thead>
            <tbody>
              {followers.map((follower) => (
                <tr 
                  key={follower.follower_user_id}
                  style={{ borderBottom: '1px solid #333' }}
                >
                  <td style={{ padding: '10px' }}>{follower.follower_user_login}</td>
                  <td style={{ padding: '10px' }}>{follower.follower_user_name || '-'}</td>
                  <td style={{ padding: '10px' }}>{formatDate(follower.followed_at)}</td>
                  <td style={{ padding: '10px' }}>{formatDate(follower.detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && followers.length > 0 && (
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

#### 4.2 Add to Menu Navigation

**File**: `src/frontend/components/Menu.tsx` (MODIFY)

```tsx
import { FollowersScreen } from '../screens/followers/followers';

// Add to menu items
<button onClick={() => setActiveScreen('followers')}>Followers</button>

// Add to screen rendering
{activeScreen === 'followers' && <FollowersScreen channelId={selectedChannelId} />}
```

### 5. Event Actions Integration

The follower events are automatically compatible with the Event Actions feature because:

1. **Event Type**: `channel.follow` is stored in `events` table
2. **Event Data**: Contains `user_id`, `user_login`, `user_name`, `followed_at`
3. **Viewer Link**: `viewer_id` populated with follower's user ID

**Add to Event Formatter** (`src/shared/utils/event-formatter.ts`):

```typescript
case 'channel.follow':
  const followerName = data.user_name || data.user_login || displayName;
  return {
    html: `<strong style="color: #9147FF">❤️ ${followerName}</strong> followed the channel`,
    plainText: `${followerName} followed the channel`,
    emoji: '❤️',
    variables: {
      ...variables,
      follower_name: followerName,
      followed_at: data.followed_at
    }
  };
```

**Example Alert Templates**:
```
"{{username}} just followed! ❤️"
"Welcome to the community, {{username}}!"
"New follower: {{username}} 🎉"
```

### 6. Polling Configuration

The polling interval is already configured in `twitch_polling_config` table:

```sql
-- From migrations.ts (already exists)
('followers', 120, 60, 600, 'seconds', 10, 'Detect new followers and trigger alerts')
```

**Default**: 120 seconds (2 minutes)  
**Range**: 60-600 seconds (1-10 minutes)  
**Step**: 10 seconds

Users can adjust in UI via existing polling configuration screen.

## Implementation Checklist

### Backend
- [ ] Add `follower_history` table migration to `migrations.ts`
- [ ] Add `current_followers` view migration
- [ ] Create `FollowerHistoryRepository` class
- [ ] Create `TwitchFollowersService` class
- [ ] Integrate with `DynamicPollingManager`
- [ ] Create IPC handlers in `followers.ts`
- [ ] Register follower handlers in `index.ts`
- [ ] Add follower event to event formatter

### Frontend
- [ ] Create `FollowersScreen` component
- [ ] Add followers navigation to `Menu.tsx`
- [ ] Listen for `channel.follow` events in Events screen
- [ ] Add follower statistics display
- [ ] Test real-time updates

### Event Actions Integration
- [ ] Add `channel.follow` to event formatter
- [ ] Add follower alert templates
- [ ] Test follower alerts (in-app and browser source)

### Testing
- [ ] Test first-time follower detection
- [ ] Test duplicate follower handling
- [ ] Test unfollow detection
- [ ] Test pagination with many followers
- [ ] Test real-time event emission
- [ ] Test viewer creation on follow
- [ ] Test event actions triggering

## Data Flow

```
1. Polling Manager triggers every 2 minutes
   ↓
2. TwitchFollowersService fetches followers from API
   ↓
3. Compare with known followers in memory/DB
   ↓
4. For each NEW follower:
   ├─ Create/Update viewer in `viewers` table
   ├─ Record follow in `follower_history` table
   ├─ Create event in `events` table
   └─ Emit IPC event to frontend
   ↓
5. Frontend updates:
   ├─ Events screen shows new follow event
   ├─ Followers screen shows new follower
   └─ Event Actions triggers alert (if configured)
```

## Unfollow Detection

**How it works**:
- During each poll, fetch ALL current followers from API
- Compare with `current_followers` view (last known state)
- If user in DB but NOT in API response → Record unfollow

**Limitations**:
- Only works for channels with <1000 followers (due to safety limit)
- For larger channels, unfollow detection may be incomplete
- Twitch API doesn't notify of unfollows directly

**Future Enhancement**:
- Track follower count from API
- If count decreases, do full scan to find who unfollowed
- This is more accurate but uses more API quota

## Performance Considerations

### API Usage
- **Default**: 30 requests/hour (every 2 minutes)
- **With 3 channels**: 90 requests/hour
- **Well under** Twitch's 800 requests/minute limit

### Database
- Indexes on all common query columns
- View uses `ROW_NUMBER()` window function for efficiency
- Pagination prevents loading all followers at once

### Memory
- Known followers cached in-memory (`Set<string>`)
- Reloaded from DB on service restart
- Memory usage: ~100 bytes per follower (10K followers = ~1MB)

## Success Metrics

- ✅ New followers detected within 2 minutes
- ✅ Zero duplicate follow records
- ✅ Viewer auto-created on first follow
- ✅ Events trigger alerts via Event Actions
- ✅ Statistics accurate and real-time
- ✅ No performance degradation with 10K+ followers

---

**Status**: Planned (Not Yet Implemented)  
**Priority**: High  
**Dependencies**: 
- `events` table (exists)
- `viewers` table (exists)
- `twitch_polling_config` table (exists)
- Event Actions feature (planned, but follower events will work without it)

**Estimated Time**: 8-12 hours (1-1.5 days)
