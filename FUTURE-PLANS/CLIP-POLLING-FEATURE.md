# Clip Polling Feature

## Overview

This feature would add automatic clip detection to Stream Synth by polling the Twitch Helix API for newly created clips. Since Twitch does not provide an EventSub subscription for clip creation events, polling is the only viable approach to detect clips in near-real-time.

## Why This Feature?

- **Gap in EventSub**: Twitch's EventSub API doesn't provide clip creation notifications
- **User Value**: Streamers want to know when viewers create clips of their content
- **Existing Infrastructure**: The dynamic polling framework already supports similar use cases (moderators, VIPs, etc.)
- **Low API Cost**: 15-minute polling interval = only 96 API requests per day per channel

## Technical Architecture

### 1. Twitch API Integration

**Endpoint**: `GET https://api.twitch.tv/helix/clips`

**Query Parameters**:
- `broadcaster_id` - The channel to get clips from (required)
- `started_at` - RFC3339 timestamp for start of time range
- `ended_at` - RFC3339 timestamp for end of time range
- `first` - Number of clips to return (max 100, default 20)
- `after` - Cursor for pagination (if needed)

**Response Data** (per clip):
```json
{
  "id": "AwkwardHelplessSalamanderSwiftRage",
  "url": "https://clips.twitch.tv/AwkwardHelplessSalamanderSwiftRage",
  "embed_url": "https://clips.twitch.tv/embed?clip=AwkwardHelplessSalamanderSwiftRage",
  "broadcaster_id": "67955580",
  "broadcaster_name": "ChewieMelodies",
  "creator_id": "53834192",
  "creator_name": "BlackNova03",
  "video_id": "1234567890",
  "game_id": "33103",
  "language": "en",
  "title": "babymetal",
  "view_count": 10,
  "created_at": "2017-11-30T22:34:18Z",
  "thumbnail_url": "https://clips-media-assets.twitch.tv/157589949-preview-480x272.jpg",
  "duration": 60,
  "vod_offset": 480
}
```

**API Rate Limits**:
- 800 requests per minute per client ID
- At 15-minute intervals, this feature uses ~4 requests/hour per channel
- Even with 10 channels, only 40 requests/hour (well under limit)

### 2. Database Schema

**New Table: `clips`**

```sql
CREATE TABLE clips (
  id TEXT PRIMARY KEY,                    -- Twitch clip ID
  channel_id TEXT NOT NULL,               -- FK to channels table
  broadcaster_id TEXT NOT NULL,           -- Twitch broadcaster ID
  broadcaster_name TEXT,                  -- Broadcaster display name
  creator_id TEXT,                        -- Twitch user ID of clip creator
  creator_name TEXT,                      -- Creator display name
  video_id TEXT,                          -- VOD ID (if available)
  game_id TEXT,                           -- Game/category ID
  title TEXT NOT NULL,                    -- Clip title
  language TEXT,                          -- Language code (e.g., 'en')
  url TEXT NOT NULL,                      -- Public clip URL
  embed_url TEXT,                         -- Embeddable URL
  thumbnail_url TEXT,                     -- Thumbnail image URL
  view_count INTEGER DEFAULT 0,           -- View count at detection time
  duration REAL,                          -- Clip duration in seconds
  vod_offset INTEGER,                     -- Offset in VOD (seconds)
  created_at TEXT NOT NULL,               -- When clip was created (ISO 8601)
  detected_at TEXT DEFAULT CURRENT_TIMESTAMP, -- When we detected it
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_clips_channel_id ON clips(channel_id);
CREATE INDEX idx_clips_created_at ON clips(created_at);
CREATE INDEX idx_clips_creator_id ON clips(creator_id);
CREATE INDEX idx_clips_detected_at ON clips(detected_at);
```

**Migration Addition** (in `src/backend/database/migrations.ts`):

```typescript
// Add to migrations array
{
  version: <NEXT_VERSION>,
  name: 'create_clips_table',
  up: async (db: Database) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        broadcaster_id TEXT NOT NULL,
        broadcaster_name TEXT,
        creator_id TEXT,
        creator_name TEXT,
        video_id TEXT,
        game_id TEXT,
        title TEXT NOT NULL,
        language TEXT,
        url TEXT NOT NULL,
        embed_url TEXT,
        thumbnail_url TEXT,
        view_count INTEGER DEFAULT 0,
        duration REAL,
        vod_offset INTEGER,
        created_at TEXT NOT NULL,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
      );
      
      CREATE INDEX idx_clips_channel_id ON clips(channel_id);
      CREATE INDEX idx_clips_created_at ON clips(created_at);
      CREATE INDEX idx_clips_creator_id ON clips(creator_id);
      CREATE INDEX idx_clips_detected_at ON clips(detected_at);
    `);
  }
}
```

### 3. Backend Implementation

#### 3.1 Add to Dynamic Polling Manager

**File**: `src/backend/services/dynamic-polling-manager.ts`

**Changes**:

1. **Add to PollType enum**:
```typescript
export type PollType = 'moderators' | 'vips' | 'clips';
```

2. **Add default config**:
```typescript
private getDefaultPollConfig(type: PollType): PollConfig {
  const configs: Record<PollType, PollConfig> = {
    moderators: { enabled: false, interval: 300000, unit: 'milliseconds' },
    vips: { enabled: false, interval: 300000, unit: 'milliseconds' },
    clips: { enabled: true, interval: 15, unit: 'minutes' } // NEW
  };
  return configs[type];
}
```

3. **Add handler in `handlePollExecution()`**:
```typescript
private async handlePollExecution(channelId: string, type: PollType): Promise<void> {
  // ...existing code...
  
  switch (type) {
    // ...existing cases...
    
    case 'clips':
      await this.pollClips(channelId);
      break;
  }
}
```

4. **Implement `pollClips()` method**:
```typescript
private async pollClips(channelId: string): Promise<void> {
  try {
    const channel = await channelRepo.getById(channelId);
    if (!channel) return;

    // Get last poll time to determine time range
    const lastPoll = this.lastPollTime.get(`${channelId}:clips`);
    const now = new Date();
    const startTime = lastPoll || new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago
    
    // Call Twitch API
    const response = await this.twitchApi.getClips({
      broadcaster_id: channel.broadcaster_id,
      started_at: startTime.toISOString(),
      ended_at: now.toISOString(),
      first: 100 // Get up to 100 clips
    });

    if (!response || !response.data) return;

    // Store new clips
    const clipRepo = new ClipRepository();
    for (const clipData of response.data) {
      // Check if clip already exists
      const existing = await clipRepo.getById(clipData.id);
      if (existing) continue;

      // Insert new clip
      await clipRepo.create({
        id: clipData.id,
        channel_id: channelId,
        broadcaster_id: clipData.broadcaster_id,
        broadcaster_name: clipData.broadcaster_name,
        creator_id: clipData.creator_id,
        creator_name: clipData.creator_name,
        video_id: clipData.video_id,
        game_id: clipData.game_id,
        title: clipData.title,
        language: clipData.language,
        url: clipData.url,
        embed_url: clipData.embed_url,
        thumbnail_url: clipData.thumbnail_url,
        view_count: clipData.view_count,
        duration: clipData.duration,
        vod_offset: clipData.vod_offset,
        created_at: clipData.created_at
      });

      // Emit IPC event for real-time UI update
      this.mainWindow?.webContents.send('clip:detected', {
        channel_id: channelId,
        clip: clipData
      });

      console.log(`[Clips] New clip detected: ${clipData.title} by ${clipData.creator_name}`);
    }

    this.lastPollTime.set(`${channelId}:clips`, now);
  } catch (error) {
    console.error(`[Clips] Error polling clips for channel ${channelId}:`, error);
  }
}
```

#### 3.2 Create Clip Repository

**File**: `src/backend/database/repositories/clips.ts` (NEW)

```typescript
import { Database } from 'better-sqlite3';
import { getDatabase } from '../connection';

export interface Clip {
  id: string;
  channel_id: string;
  broadcaster_id: string;
  broadcaster_name?: string;
  creator_id?: string;
  creator_name?: string;
  video_id?: string;
  game_id?: string;
  title: string;
  language?: string;
  url: string;
  embed_url?: string;
  thumbnail_url?: string;
  view_count: number;
  duration?: number;
  vod_offset?: number;
  created_at: string;
  detected_at?: string;
}

export interface ClipFilters {
  channelId?: string;
  creatorId?: string;
  searchText?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class ClipRepository {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  async create(clip: Omit<Clip, 'detected_at'>): Promise<{ success: boolean; error?: string }> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO clips (
          id, channel_id, broadcaster_id, broadcaster_name,
          creator_id, creator_name, video_id, game_id,
          title, language, url, embed_url, thumbnail_url,
          view_count, duration, vod_offset, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        clip.id,
        clip.channel_id,
        clip.broadcaster_id,
        clip.broadcaster_name || null,
        clip.creator_id || null,
        clip.creator_name || null,
        clip.video_id || null,
        clip.game_id || null,
        clip.title,
        clip.language || null,
        clip.url,
        clip.embed_url || null,
        clip.thumbnail_url || null,
        clip.view_count,
        clip.duration || null,
        clip.vod_offset || null,
        clip.created_at
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getById(id: string): Promise<Clip | null> {
    const stmt = this.db.prepare('SELECT * FROM clips WHERE id = ?');
    return stmt.get(id) as Clip || null;
  }

  async getClips(filters: ClipFilters): Promise<{ success: boolean; clips?: Clip[]; error?: string }> {
    try {
      let query = 'SELECT * FROM clips WHERE 1=1';
      const params: any[] = [];

      if (filters.channelId) {
        query += ' AND channel_id = ?';
        params.push(filters.channelId);
      }

      if (filters.creatorId) {
        query += ' AND creator_id = ?';
        params.push(filters.creatorId);
      }

      if (filters.searchText) {
        query += ' AND (title LIKE ? OR creator_name LIKE ?)';
        const searchPattern = `%${filters.searchText}%`;
        params.push(searchPattern, searchPattern);
      }

      if (filters.startDate) {
        query += ' AND created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND created_at <= ?';
        params.push(filters.endDate);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const clips = stmt.all(...params) as Clip[];

      return { success: true, clips };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getClipCount(channelId?: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      let query = 'SELECT COUNT(*) as count FROM clips';
      const params: any[] = [];

      if (channelId) {
        query += ' WHERE channel_id = ?';
        params.push(channelId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      return { success: true, count: result.count };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async deleteClip(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stmt = this.db.prepare('DELETE FROM clips WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
```

#### 3.3 Add Twitch API Method

**File**: `src/backend/services/twitch-api.ts` (or wherever Twitch API calls are made)

```typescript
interface GetClipsParams {
  broadcaster_id: string;
  started_at?: string;
  ended_at?: string;
  first?: number;
  after?: string;
}

async getClips(params: GetClipsParams): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.append('broadcaster_id', params.broadcaster_id);
  
  if (params.started_at) queryParams.append('started_at', params.started_at);
  if (params.ended_at) queryParams.append('ended_at', params.ended_at);
  if (params.first) queryParams.append('first', params.first.toString());
  if (params.after) queryParams.append('after', params.after);

  const response = await fetch(
    `https://api.twitch.tv/helix/clips?${queryParams}`,
    {
      headers: {
        'Client-ID': this.clientId,
        'Authorization': `Bearer ${this.accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Twitch API error: ${response.status}`);
  }

  return await response.json();
}
```

#### 3.4 Add IPC Handlers

**File**: `src/backend/core/ipc-handlers/clips.ts` (NEW)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ClipRepository, ClipFilters } from '../../database/repositories/clips';

export function registerClipHandlers() {
  ipcMain.handle('clips:get', async (_event: IpcMainInvokeEvent, filters: ClipFilters) => {
    const repo = new ClipRepository();
    return await repo.getClips(filters);
  });

  ipcMain.handle('clips:getCount', async (_event: IpcMainInvokeEvent, channelId?: string) => {
    const repo = new ClipRepository();
    return await repo.getClipCount(channelId);
  });

  ipcMain.handle('clips:delete', async (_event: IpcMainInvokeEvent, clipId: string) => {
    const repo = new ClipRepository();
    return await repo.deleteClip(clipId);
  });

  console.log('[IPC] Clip handlers registered');
}
```

**Register in**: `src/backend/core/ipc-handlers/index.ts`

```typescript
import { registerClipHandlers } from './clips';

export function registerAllHandlers() {
  // ...existing handlers...
  registerClipHandlers();
}
```

### 4. Frontend Implementation

#### 4.1 Add to Event Subscriptions UI

**File**: `src/frontend/components/EventSubscriptions.tsx`

Add clip polling toggle alongside moderator/VIP polling toggles:

```tsx
<div className="subscription-item">
  <input
    type="checkbox"
    id="poll-clips"
    checked={pollConfig.clips?.enabled || false}
    onChange={(e) => handlePollConfigChange('clips', e.target.checked)}
  />
  <label htmlFor="poll-clips">
    <strong>Clip Detection (Polling)</strong>
    <span className="description">
      Automatically detect new clips created by viewers (polls every 15 minutes)
    </span>
  </label>
</div>
```

#### 4.2 Create Clips Screen

**File**: `src/frontend/screens/clips/clips.tsx` (NEW)

```tsx
import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');
const { shell } = window.require('electron');

interface Clip {
  id: string;
  channel_id: string;
  broadcaster_name?: string;
  creator_name?: string;
  title: string;
  url: string;
  thumbnail_url?: string;
  view_count: number;
  duration?: number;
  created_at: string;
  detected_at?: string;
}

interface ClipsScreenProps {
  channelId?: string;
}

export const ClipsScreen: React.FC<ClipsScreenProps> = ({ channelId }) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadClips = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: any = { limit, offset };
      if (channelId) filters.channelId = channelId;
      if (searchText) filters.searchText = searchText;
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) filters.endDate = new Date(endDate).toISOString();

      const result = await ipcRenderer.invoke('clips:get', filters);
      if (result.success && result.clips) {
        setClips(result.clips);
      } else {
        setError(result.error || 'Failed to load clips');
      }

      const countResult = await ipcRenderer.invoke('clips:getCount', channelId);
      if (countResult.success) {
        setTotalCount(countResult.count || 0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClips();
  }, [channelId, searchText, startDate, endDate, offset]);

  // Listen for real-time clip detection
  useEffect(() => {
    const handleNewClip = (_event: any, data: any) => {
      if (channelId && data.channel_id !== channelId) return;
      
      // Refresh clips list
      loadClips();
    };

    ipcRenderer.on('clip:detected', handleNewClip);
    return () => {
      ipcRenderer.removeListener('clip:detected', handleNewClip);
    };
  }, [channelId, offset]);

  const openClip = (url: string) => {
    shell.openExternal(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="content">
      <h2>Clips</h2>

      {/* Filters */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label>Search:</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Title or creator..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <label>Start Date:</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <label>End Date:</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        </div>

        <button onClick={loadClips}>Refresh</button>
        <button onClick={() => { setSearchText(''); setStartDate(''); setEndDate(''); }}>
          Clear Filters
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        Showing {clips.length} of {totalCount} clips
      </div>

      {loading && <div>Loading clips...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {!loading && clips.length === 0 && (
        <div>No clips found. Enable clip detection in Event Subscriptions.</div>
      )}

      {!loading && clips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {clips.map((clip) => (
            <div key={clip.id} style={{ backgroundColor: '#2a2a2a', borderRadius: '8px', overflow: 'hidden' }}>
              {clip.thumbnail_url && (
                <img
                  src={clip.thumbnail_url}
                  alt={clip.title}
                  style={{ width: '100%', height: '169px', objectFit: 'cover' }}
                />
              )}
              <div style={{ padding: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{clip.title}</h4>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                  <div>👤 {clip.creator_name || 'Unknown'}</div>
                  <div>👁️ {clip.view_count.toLocaleString()} views</div>
                  <div>⏱️ {formatDuration(clip.duration)}</div>
                  <div>📅 {formatDate(clip.created_at)}</div>
                </div>
                <button
                  onClick={() => openClip(clip.url)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#9147ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Open Clip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && clips.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            Previous
          </button>
          <span>Page {Math.floor(offset / limit) + 1} of {Math.ceil(totalCount / limit)}</span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalCount}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

#### 4.3 Add to Menu Navigation

**File**: `src/frontend/components/Menu.tsx`

```tsx
import { ClipsScreen } from '../screens/clips/clips';

// Add to menu items
<button onClick={() => setActiveScreen('clips')}>Clips</button>

// Add to screen rendering
{activeScreen === 'clips' && <ClipsScreen channelId={selectedChannelId} />}
```

#### 4.4 Create IPC Client Methods

**File**: `src/frontend/services/clips.ts` (NEW)

```typescript
const { ipcRenderer } = window.require('electron');

export interface ClipFilters {
  channelId?: string;
  creatorId?: string;
  searchText?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export const getClips = async (filters: ClipFilters) => {
  return await ipcRenderer.invoke('clips:get', filters);
};

export const getClipCount = async (channelId?: string) => {
  return await ipcRenderer.invoke('clips:getCount', channelId);
};

export const deleteClip = async (clipId: string) => {
  return await ipcRenderer.invoke('clips:delete', clipId);
};
```

## Implementation Checklist

### Backend

- [ ] Add `clips` table migration to `migrations.ts`
- [ ] Create `ClipRepository` class in `src/backend/database/repositories/clips.ts`
- [ ] Add `clips` to `PollType` in `dynamic-polling-manager.ts`
- [ ] Implement `pollClips()` method in polling manager
- [ ] Add `getClips()` method to Twitch API service
- [ ] Create IPC handlers in `src/backend/core/ipc-handlers/clips.ts`
- [ ] Register clip handlers in `index.ts`
- [ ] Add `clip:detected` IPC event emission

### Frontend

- [ ] Create `ClipsScreen` component in `src/frontend/screens/clips/clips.tsx`
- [ ] Add clips toggle to `EventSubscriptions.tsx`
- [ ] Add clips navigation to `Menu.tsx`
- [ ] Create clips IPC client in `src/frontend/services/clips.ts`
- [ ] Add real-time listener for `clip:detected` events
- [ ] Style clips grid with thumbnails

### Testing

- [ ] Test clip polling starts when enabled
- [ ] Test clips are detected and stored correctly
- [ ] Test pagination works with many clips
- [ ] Test filters (search, date range) work correctly
- [ ] Test "Open Clip" button opens correct URL
- [ ] Test real-time updates when new clips detected
- [ ] Test multiple channels with different polling schedules
- [ ] Verify API rate limits are respected

### Documentation

- [ ] Update README with clip detection feature
- [ ] Document clip polling interval configuration
- [ ] Add troubleshooting guide for clip detection issues

## User Experience Flow

1. **Enable Clip Detection**:
   - User goes to Event Subscriptions screen
   - Toggles "Clip Detection (Polling)" checkbox
   - Polling begins automatically every 15 minutes

2. **View Clips**:
   - User navigates to Clips screen in menu
   - Sees grid of clip thumbnails with metadata
   - Can filter by date range, creator, or search title

3. **Open Clips**:
   - User clicks "Open Clip" button
   - Clip opens in default browser
   - Can share or download from Twitch

4. **Real-time Updates**:
   - When new clip detected, notification appears (optional)
   - Clips screen auto-refreshes to show new clip
   - Badge shows number of new clips since last view (optional)

## Future Enhancements

### Phase 2 Features

- **Clip Analytics**: Track view count changes over time
- **Clip Categories**: Auto-tag clips by game/category
- **Favorite Clips**: Star/bookmark important clips
- **Clip Notifications**: Desktop notifications for new clips
- **Clip Export**: Download clips locally for archival
- **Clip Highlights**: AI-powered highlight detection (stretch goal)

### Performance Optimizations

- **Incremental Polling**: Only poll during active streams
- **Smart Intervals**: Increase polling frequency during high-activity periods
- **Thumbnail Caching**: Cache clip thumbnails locally
- **Lazy Loading**: Load clip thumbnails as user scrolls

### Integration Ideas

- **Discord Integration**: Auto-post new clips to Discord channel
- **OBS Integration**: Add clips to OBS scene collection
- **Twitter Integration**: Auto-tweet new clips
- **Clip Compilation**: Generate "best clips of the week" video

## Potential Issues & Solutions

### Issue 1: Deleted Clips
**Problem**: Clip URLs may become invalid if clips are deleted from Twitch  
**Solution**: Add periodic validation job to check if clips still exist, mark as deleted

### Issue 2: High-Volume Channels
**Problem**: Popular channels may have hundreds of clips per poll  
**Solution**: Implement pagination in API calls, process clips in batches

### Issue 3: API Rate Limiting
**Problem**: Multiple channels polling simultaneously could hit rate limits  
**Solution**: Stagger poll times across channels, implement exponential backoff

### Issue 4: Duplicate Detection
**Problem**: Same clip might be returned in multiple polls  
**Solution**: Use clip ID as primary key (already handled), check existence before insert

### Issue 5: Time Zone Confusion
**Problem**: Clip timestamps are in UTC, user might be in different timezone  
**Solution**: Store in UTC, display in user's local timezone (already done in `formatDate()`)

## Estimated Development Time

- **Backend (Database + Polling)**: 4-6 hours
- **Frontend (UI + IPC)**: 4-6 hours
- **Testing & Bug Fixes**: 2-3 hours
- **Documentation**: 1-2 hours

**Total**: ~11-17 hours (1.5 - 2 days)

## Success Metrics

- Clips detected within 15 minutes of creation
- Zero duplicate clips stored
- API rate limits never exceeded
- UI updates in real-time without refresh
- No performance degradation with 1000+ clips

---

**Status**: Planned (Not Yet Implemented)  
**Priority**: Medium  
**Dependencies**: None (uses existing polling infrastructure)  
**API Requirements**: Twitch Helix API access (already available)
