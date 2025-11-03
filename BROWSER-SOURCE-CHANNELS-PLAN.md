# Browser Source Channels Feature - Implementation Plan

## 🎯 Feature Overview

**User-Defined Browser Source Channels** - Allow users to create custom named channels and assign event actions to them, enabling multiple OBS browser sources with different alert groups.

---

## 💡 User Experience

### Example Setup

**User Creates Channels:**
1. "main-alerts" - Follows, subs, raids
2. "tts" - TTS messages only
3. "hype-events" - Gifted subs, big bits, special events
4. "passive" - Background notifications

**OBS Browser Sources:**
```
Source 1: http://localhost:3737/browser-source?channel=main-alerts
Position: Center screen (full overlay)

Source 2: http://localhost:3737/browser-source?channel=tts
Position: Lower third

Source 3: http://localhost:3737/browser-source?channel=hype-events
Position: Center (takes over main when triggered)

Source 4: http://localhost:3737/browser-source?channel=passive
Position: Top corner
```

---

## 📊 Database Schema Updates

### New Table: browser_source_channels

```sql
CREATE TABLE IF NOT EXISTS browser_source_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,           -- e.g., '131323084'
  name TEXT NOT NULL,                 -- e.g., 'main-alerts', 'tts', 'hype-events'
  display_name TEXT NOT NULL,         -- e.g., 'Main Alerts', 'TTS Messages'
  description TEXT,                   -- e.g., 'Primary alerts shown center screen'
  color TEXT DEFAULT '#9147ff',       -- Color code for UI organization
  icon TEXT DEFAULT '📺',             -- Emoji icon
  priority INTEGER DEFAULT 0,         -- Display priority (higher = shows first)
  is_enabled BOOLEAN DEFAULT 1,       -- Can disable entire channel
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(channel_id, name)            -- One channel name per Twitch channel
);

-- Default channels for new users
INSERT INTO browser_source_channels (channel_id, name, display_name, description, created_at, updated_at)
VALUES 
  ('*', 'default', 'Default Channel', 'Default browser source channel', datetime('now'), datetime('now')),
  ('*', 'tts', 'TTS Messages', 'Text-to-speech messages', datetime('now'), datetime('now'));
```

### Update Table: event_actions

```sql
-- Add browser source channel assignment
ALTER TABLE event_actions 
ADD COLUMN browser_source_channel TEXT DEFAULT 'default';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_event_actions_browser_channel 
ON event_actions(browser_source_channel);
```

---

## 🎨 Phase 8: Action Editor Modal Updates

### Channel Selector in Action Editor

```typescript
// Action Editor Modal - Channel Assignment Section
<div className="form-section">
  <h4>📺 Browser Source Channel</h4>
  <p className="help-text">
    Assign this alert to a browser source channel for multi-source OBS setups
  </p>
  
  <div className="channel-selector">
    <select 
      value={formData.browser_source_channel}
      onChange={(e) => setFormData({...formData, browser_source_channel: e.target.value})}
      className="channel-select"
    >
      {channels.map(channel => (
        <option key={channel.name} value={channel.name}>
          {channel.icon} {channel.display_name}
        </option>
      ))}
    </select>
    
    <button 
      className="manage-channels-button"
      onClick={() => setShowChannelManager(true)}
    >
      ⚙️ Manage Channels
    </button>
  </div>
  
  <div className="channel-preview">
    <strong>Browser Source URL:</strong>
    <code>http://localhost:3737/browser-source?channel={formData.browser_source_channel}</code>
    <button 
      className="copy-button"
      onClick={() => copyToClipboard(getBrowserSourceUrl(formData.browser_source_channel))}
    >
      📋 Copy URL
    </button>
  </div>
</div>
```

---

## 🎛️ Channel Manager Modal (New Component)

### Location
`src/frontend/components/ChannelManager.tsx`

### Features
```typescript
interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  name: string;              // URL-safe name (e.g., 'main-alerts')
  display_name: string;      // Human-readable (e.g., 'Main Alerts')
  description?: string;
  color: string;
  icon: string;
  priority: number;
  is_enabled: boolean;
  action_count?: number;     // How many actions assigned
}

// Channel Manager Component
export const ChannelManager: React.FC = ({ channelId, onClose }) => {
  const [channels, setChannels] = useState<BrowserSourceChannel[]>([]);
  const [editingChannel, setEditingChannel] = useState<BrowserSourceChannel | null>(null);
  
  // CRUD operations
  const createChannel = async (data: Partial<BrowserSourceChannel>) => { ... };
  const updateChannel = async (id: number, data: Partial<BrowserSourceChannel>) => { ... };
  const deleteChannel = async (id: number) => { ... };
  
  return (
    <div className="modal-backdrop">
      <div className="modal-content channel-manager">
        <h3>📺 Browser Source Channels</h3>
        
        {/* Channel List */}
        <div className="channels-list">
          {channels.map(channel => (
            <div key={channel.id} className="channel-item">
              <span className="channel-icon">{channel.icon}</span>
              <div className="channel-info">
                <strong>{channel.display_name}</strong>
                <span className="channel-name">{channel.name}</span>
                <span className="action-count">{channel.action_count} alerts</span>
              </div>
              <div className="channel-url">
                <code>?channel={channel.name}</code>
                <button onClick={() => copyUrl(channel.name)}>📋</button>
              </div>
              <div className="channel-actions">
                <button onClick={() => setEditingChannel(channel)}>✏️</button>
                <button onClick={() => deleteChannel(channel.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Create New Channel Button */}
        <button 
          className="create-channel-button"
          onClick={() => setEditingChannel({ /* new channel defaults */ })}
        >
          ➕ Create New Channel
        </button>
        
        {/* Channel Editor (inline or modal) */}
        {editingChannel && (
          <ChannelEditor 
            channel={editingChannel}
            onSave={createOrUpdateChannel}
            onCancel={() => setEditingChannel(null)}
          />
        )}
      </div>
    </div>
  );
};
```

---

## 🔧 Backend Updates

### Repository: browser-source-channels.ts

**Location:** `src/backend/database/repositories/browser-source-channels.ts`

```typescript
export interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  name: string;
  display_name: string;
  description?: string;
  color: string;
  icon: string;
  priority: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class BrowserSourceChannelsRepository {
  constructor(private db: Database) {}
  
  // Get all channels for a Twitch channel
  async getChannels(channelId: string): Promise<BrowserSourceChannel[]> {
    return this.db.all(
      `SELECT * FROM browser_source_channels 
       WHERE channel_id = ? OR channel_id = '*'
       ORDER BY priority DESC, name ASC`,
      [channelId]
    );
  }
  
  // Get channel by name
  async getChannelByName(channelId: string, name: string): Promise<BrowserSourceChannel | null> {
    return this.db.get(
      `SELECT * FROM browser_source_channels 
       WHERE channel_id = ? AND name = ?`,
      [channelId, name]
    );
  }
  
  // Create channel
  async createChannel(data: Omit<BrowserSourceChannel, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO browser_source_channels 
       (channel_id, name, display_name, description, color, icon, priority, is_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.channel_id,
        data.name,
        data.display_name,
        data.description || null,
        data.color,
        data.icon,
        data.priority,
        data.is_enabled ? 1 : 0
      ]
    );
    return result.lastID!;
  }
  
  // Update channel
  async updateChannel(id: number, data: Partial<BrowserSourceChannel>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(data.display_name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.color !== undefined) {
      fields.push('color = ?');
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?');
      values.push(data.icon);
    }
    if (data.priority !== undefined) {
      fields.push('priority = ?');
      values.push(data.priority);
    }
    if (data.is_enabled !== undefined) {
      fields.push('is_enabled = ?');
      values.push(data.is_enabled ? 1 : 0);
    }
    
    fields.push('updated_at = datetime("now")');
    values.push(id);
    
    await this.db.run(
      `UPDATE browser_source_channels SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }
  
  // Delete channel (with safety check)
  async deleteChannel(id: number): Promise<void> {
    // Check if channel has actions assigned
    const count = await this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM event_actions 
       WHERE browser_source_channel = (SELECT name FROM browser_source_channels WHERE id = ?)`,
      [id]
    );
    
    if (count && count.count > 0) {
      throw new Error(`Cannot delete channel: ${count.count} actions are assigned to it. Reassign or delete them first.`);
    }
    
    await this.db.run('DELETE FROM browser_source_channels WHERE id = ?', [id]);
  }
  
  // Get action count per channel
  async getChannelStats(channelId: string): Promise<{ name: string; action_count: number }[]> {
    return this.db.all(
      `SELECT 
         c.name,
         COUNT(a.id) as action_count
       FROM browser_source_channels c
       LEFT JOIN event_actions a ON a.browser_source_channel = c.name AND a.channel_id = ?
       WHERE c.channel_id = ? OR c.channel_id = '*'
       GROUP BY c.name
       ORDER BY c.priority DESC`,
      [channelId, channelId]
    );
  }
}
```

### IPC Handlers: browser-source-channels.ts

**Location:** `src/backend/core/ipc-handlers/browser-source-channels.ts`

```typescript
import { ipcMain } from 'electron';
import { BrowserSourceChannelsRepository } from '../../database/repositories/browser-source-channels';
import { getDatabase } from '../../database';

export function registerBrowserSourceChannelHandlers() {
  const db = getDatabase();
  const repo = new BrowserSourceChannelsRepository(db);
  
  // Get all channels
  ipcMain.handle('browser-source-channels:get-all', async (event, channelId: string) => {
    return await repo.getChannels(channelId);
  });
  
  // Get channels with stats
  ipcMain.handle('browser-source-channels:get-with-stats', async (event, channelId: string) => {
    const channels = await repo.getChannels(channelId);
    const stats = await repo.getChannelStats(channelId);
    
    return channels.map(channel => ({
      ...channel,
      action_count: stats.find(s => s.name === channel.name)?.action_count || 0
    }));
  });
  
  // Create channel
  ipcMain.handle('browser-source-channels:create', async (event, data) => {
    return await repo.createChannel(data);
  });
  
  // Update channel
  ipcMain.handle('browser-source-channels:update', async (event, id: number, data) => {
    await repo.updateChannel(id, data);
    return { success: true };
  });
  
  // Delete channel
  ipcMain.handle('browser-source-channels:delete', async (event, id: number) => {
    await repo.deleteChannel(id);
    return { success: true };
  });
  
  console.log('[IPC] Browser Source Channel handlers registered');
}
```

### Frontend Service: browser-source-channels.ts

**Location:** `src/frontend/services/browser-source-channels.ts`

```typescript
const { ipcRenderer } = window.require('electron');

export interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  name: string;
  display_name: string;
  description?: string;
  color: string;
  icon: string;
  priority: number;
  is_enabled: boolean;
  action_count?: number;
}

export const browserSourceChannelsService = {
  // Get all channels for a Twitch channel
  async getChannels(channelId: string): Promise<BrowserSourceChannel[]> {
    return await ipcRenderer.invoke('browser-source-channels:get-all', channelId);
  },
  
  // Get channels with action counts
  async getChannelsWithStats(channelId: string): Promise<BrowserSourceChannel[]> {
    return await ipcRenderer.invoke('browser-source-channels:get-with-stats', channelId);
  },
  
  // Create new channel
  async createChannel(data: Omit<BrowserSourceChannel, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await ipcRenderer.invoke('browser-source-channels:create', data);
  },
  
  // Update channel
  async updateChannel(id: number, data: Partial<BrowserSourceChannel>): Promise<void> {
    await ipcRenderer.invoke('browser-source-channels:update', id, data);
  },
  
  // Delete channel
  async deleteChannel(id: number): Promise<void> {
    await ipcRenderer.invoke('browser-source-channels:delete', id);
  },
  
  // Helper: Get browser source URL
  getBrowserSourceUrl(channelName: string, port: number = 3737): string {
    return `http://localhost:${port}/browser-source?channel=${channelName}`;
  },
  
  // Helper: Validate channel name (URL-safe)
  validateChannelName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Channel name is required' };
    }
    
    if (!/^[a-z0-9-_]+$/.test(name)) {
      return { valid: false, error: 'Use only lowercase letters, numbers, hyphens, and underscores' };
    }
    
    if (name.length > 50) {
      return { valid: false, error: 'Channel name must be 50 characters or less' };
    }
    
    return { valid: true };
  }
};
```

---

## 🌐 Browser Source Client Updates

### browser-source.js - Channel Filtering

```javascript
// Parse channel from URL
const urlParams = new URLSearchParams(window.location.search);
const CHANNEL_NAME = urlParams.get('channel') || 'default';

console.log(`[BrowserSource] Listening on channel: ${CHANNEL_NAME}`);

// Filter alerts by channel
socket.on('alert', (payload) => {
  // Check if alert is for this channel
  const alertChannel = payload.browser_source_channel || 'default';
  
  if (alertChannel !== CHANNEL_NAME) {
    console.log(`[BrowserSource] Filtered out alert for channel '${alertChannel}' (listening on '${CHANNEL_NAME}')`);
    return;
  }
  
  console.log(`[BrowserSource] Displaying alert on channel '${CHANNEL_NAME}':`, payload.event_type);
  displayAlert(payload);
});

// Show channel name in corner (optional, for debugging)
function showChannelIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'channel-indicator';
  indicator.textContent = `📺 ${CHANNEL_NAME}`;
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  `;
  document.body.appendChild(indicator);
  
  // Hide after 3 seconds
  setTimeout(() => indicator.remove(), 3000);
}

// Show channel on connect (optional)
socket.on('connected', () => {
  showChannelIndicator();
});
```

---

## 🎨 Event Actions Screen Updates

### Add Channel Filter/Display

```typescript
// In event-actions.tsx

// Add channel filter state
const [selectedChannel, setSelectedChannel] = useState<string>('all');
const [channels, setChannels] = useState<BrowserSourceChannel[]>([]);

// Load channels
const loadChannels = async () => {
  if (!channelId) return;
  try {
    const data = await browserSourceChannelsService.getChannelsWithStats(channelId);
    setChannels(data);
  } catch (err) {
    console.error('[Event Actions] Failed to load channels:', err);
  }
};

// Load on mount
useEffect(() => {
  loadChannels();
}, [channelId]);

// Add channel filter to toolbar
<div className="toolbar">
  {/* ...existing search and filters... */}
  
  <div className="channel-filter">
    <label>Channel:</label>
    <select 
      value={selectedChannel}
      onChange={(e) => setSelectedChannel(e.target.value)}
    >
      <option value="all">All Channels</option>
      {channels.map(channel => (
        <option key={channel.name} value={channel.name}>
          {channel.icon} {channel.display_name} ({channel.action_count})
        </option>
      ))}
    </select>
  </div>
</div>

// Filter actions by channel
const filteredActions = actions.filter(action => {
  // ...existing filters...
  
  // Channel filter
  if (selectedChannel !== 'all' && action.browser_source_channel !== selectedChannel) {
    return false;
  }
  
  return true;
});

// Show channel in action list
<div className="cell channel">
  <span 
    className="channel-badge"
    style={{ backgroundColor: getChannelColor(action.browser_source_channel) }}
  >
    {getChannelIcon(action.browser_source_channel)} {getChannelDisplayName(action.browser_source_channel)}
  </span>
</div>
```

---

## 📋 Implementation Phases

### Phase 8A: Database & Backend (First)
1. ✅ Create migration for `browser_source_channels` table
2. ✅ Create repository class
3. ✅ Create IPC handlers
4. ✅ Test with sample data

### Phase 8B: Frontend Service (Second)
1. ✅ Create frontend service wrapper
2. ✅ Add TypeScript interfaces
3. ✅ Add helper methods

### Phase 8C: Channel Manager UI (Third)
1. ✅ Create Channel Manager modal component
2. ✅ Create Channel Editor form
3. ✅ Add CRUD operations
4. ✅ Add URL copy functionality

### Phase 8D: Action Editor Integration (Fourth)
1. ✅ Add channel selector to action editor
2. ✅ Show browser source URL preview
3. ✅ Update event_actions table schema
4. ✅ Save channel assignment with actions

### Phase 8E: Browser Source Updates (Fifth)
1. ✅ Update browser-source.js to filter by channel
2. ✅ Add channel indicator (optional)
3. ✅ Test multi-channel setup

### Phase 8F: Event Actions Screen (Sixth)
1. ✅ Add channel filter to toolbar
2. ✅ Show channel badges in action list
3. ✅ Link to channel manager

---

## 🎓 User Documentation

### Quick Start Guide for Users

**Step 1: Create Channels**
```
1. Go to Event Actions screen
2. Click "⚙️ Manage Channels"
3. Click "➕ Create New Channel"
4. Fill in:
   - Name: main-alerts (URL-safe)
   - Display Name: Main Alerts
   - Description: Primary alerts shown center screen
   - Icon: 📺
   - Color: #9147ff
5. Click "Save"
```

**Step 2: Assign Actions to Channels**
```
1. Edit any event action
2. Scroll to "Browser Source Channel" section
3. Select channel from dropdown
4. Save action
```

**Step 3: Add Browser Sources to OBS**
```
1. In OBS, add new Browser Source
2. Copy URL from Channel Manager or Action Editor
3. Example: http://localhost:3737/browser-source?channel=main-alerts
4. Set Width: 1920, Height: 1080
5. Position and resize as needed
6. Repeat for each channel
```

---

## 🎯 Benefits

### For Users
- ✅ **Organize alerts** by type or importance
- ✅ **Position alerts** differently on screen
- ✅ **Control visibility** per channel
- ✅ **Test individually** without affecting others
- ✅ **Custom workflows** for different scenes

### For Streamers
- ✅ **Professional layouts** with multiple alert areas
- ✅ **Scene-specific alerts** (starting soon, BRB, gameplay)
- ✅ **Priority system** (important alerts center, passive in corner)
- ✅ **Easy management** with visual UI
- ✅ **Flexible setup** adapts to any stream style

---

## 🚀 Timeline

- **Phase 8A-B:** Backend & Service (Day 1) - 2-3 hours
- **Phase 8C:** Channel Manager UI (Day 2) - 3-4 hours  
- **Phase 8D:** Action Editor Integration (Day 2-3) - 2-3 hours
- **Phase 8E:** Browser Source Updates (Day 3) - 1-2 hours
- **Phase 8F:** Event Actions Screen (Day 3) - 1-2 hours

**Total Estimated Time:** 9-14 hours across Phase 8

---

## ✅ Success Criteria

- [ ] Users can create custom channels with names, icons, colors
- [ ] Users can assign event actions to channels
- [ ] Browser sources filter alerts by channel parameter
- [ ] Multiple browser sources can run simultaneously
- [ ] Each channel shows only its assigned alerts
- [ ] Channel manager is intuitive and easy to use
- [ ] URLs are copyable with one click
- [ ] Default channels work out of the box
- [ ] Cannot delete channels with assigned actions
- [ ] Channel stats show action counts

---

**Ready to implement!** This feature will make Stream Synth incredibly flexible for advanced OBS setups. 🎉
