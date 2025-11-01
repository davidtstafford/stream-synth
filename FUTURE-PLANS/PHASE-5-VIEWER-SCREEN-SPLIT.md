# Phase 5: Split Viewer Rules into Two Separate Screens

**Status:** 📋 **PLANNING**  
**Priority:** 🔴 **CRITICAL** (Fix fundamental design flaw)  
**Estimated Time:** 4-6 hours  
**Prerequisites:** Phase 5 Chat Commands complete  
**Created:** October 30, 2025

---

## 🎯 Objective

**Split the current "Viewer Rules" screen into two completely separate, focused screens:**

1. **Viewer Voice Settings** - Custom voice preferences (voice, pitch, speed)
2. **Viewer TTS Restrictions** - Mute and cooldown management

This separation fixes the fundamental design flaw where TTS restrictions (mute/cooldown) were awkwardly coupled with voice preferences, causing confusion and inconsistent behavior.

---

## 🔴 Current Problems

### Design Issues

1. **Conflated Concerns:**
   - Voice preferences (optional customization) mixed with TTS restrictions (moderation)
   - Creating a mute doesn't require a voice preference, but UI suggests it does
   - "Existing Rules" table only shows voice preferences, not mute/cooldown rules

2. **Inconsistent UI Behavior:**
   - Navigate to Viewer Rules → search for user → no rule visible
   - Click "Create Rule" → then mute/cooldown appear
   - Rules created via chat commands don't show in "Existing Rules" table
   - Confusing whether a user has rules or not

3. **Database Confusion:**
   - Two separate tables (`viewer_rules` for voice, `viewer_tts_rules` for restrictions)
   - UI treats them as one combined "rule"
   - Backend correctly separates them, frontend doesn't

4. **User Experience:**
   - Moderators want to quickly see who is muted/on cooldown
   - But they have to search for each user individually
   - No way to see "all muted users" at a glance

---

## 🎨 New Design: Two Separate Screens

### Screen 1: Viewer Voice Settings

**Purpose:** Allow viewers (or mods) to customize TTS voice output for specific users

**Location:** `TTS Settings` → `Viewer Voice Settings`

**Features:**
- Search for viewer
- Select custom voice from voice picker
- Adjust pitch (0.5 - 2.0)
- Adjust speed (0.5 - 2.0)
- Save/Update/Delete voice preference
- View list of all viewers with custom voices

**Use Cases:**
- "Make @Bob sound like a robot" (specific voice + high pitch)
- "Make @Alice's messages slower" (normal voice, 0.8x speed)
- "Use British English for @Charlie" (specific regional voice)

**Database:** `viewer_rules` table (unchanged)

**IPC Handlers:** Existing `viewer-rules:*` handlers (unchanged)

---

### Screen 2: Viewer TTS Restrictions

**Purpose:** Moderate TTS usage by muting users or adding cooldowns

**Location:** `TTS Settings` → `Viewer TTS Restrictions`

**Features:**
- **Muted Users Table:**
  - Show all currently muted users
  - Display expiration time (or "Permanent")
  - Quick unmute button
  - Countdown timer for temporary mutes
  
- **Cooldown Users Table:**
  - Show all users with active cooldowns
  - Display gap duration (e.g., "30 seconds")
  - Display expiration time (or "Permanent")
  - Quick remove button
  
- **Add Restriction:**
  - Search for viewer
  - Choose restriction type (Mute or Cooldown)
  - Configure parameters
  - Save

- **Real-Time Updates:**
  - Listen for chat command events
  - Auto-refresh when restrictions change
  - Show notification when rules updated via chat

**Use Cases:**
- "Who is currently muted?" (see list at a glance)
- "How long until @Bob's cooldown expires?" (countdown timer)
- "Temporarily mute @Spammer for 30 minutes" (create timed mute)
- Chat command: `~mutevoice @user` → instantly see in UI

**Database:** `viewer_tts_rules` table (unchanged)

**IPC Handlers:** Existing `viewer-tts-rules:*` handlers (unchanged)

---

## 📋 Implementation Plan

### Step 1: Rename Existing Screen (30 minutes)

**1A: Rename Component File**
- Rename: `src/frontend/screens/tts/tabs/ViewerRulesTab.tsx`
- To: `src/frontend/screens/tts/tabs/ViewerVoiceSettingsTab.tsx`
- Update component name: `ViewerRulesTab` → `ViewerVoiceSettingsTab`

**1B: Remove Mute/Cooldown Logic from Voice Settings Screen**

Remove all TTS restriction code:
- Remove `ttsRules` state and related useState hooks:
  - `ttsRules`
  - `isMuted`
  - `mutePeriodMins`
  - `hasCooldown`
  - `cooldownGapSeconds`
  - `cooldownPeriodMins`
- Remove `loadTTSRules()` function
- Remove TTS rules event listener (`viewer-tts-rules-updated`)
- Remove TTS rules status display box
- Remove "TTS Restrictions" section from JSX
- Remove "Clear All TTS Rules" button
- Remove refresh button (no longer needed)

**1C: Update UI Labels**
- Change tab title: "Viewer Custom Voice Rules" → "Viewer Voice Settings"
- Change description: Focus only on voice customization
- Change table header: "Existing Viewer Rules" → "Custom Voice Settings"

**1D: Update Screen Registration**

In `src/frontend/screens/tts/TTSScreen.tsx`:
```typescript
// OLD
import { ViewerRulesTab } from './tabs/ViewerRulesTab';

// NEW
import { ViewerVoiceSettingsTab } from './tabs/ViewerVoiceSettingsTab';
```

Update tab array:
```typescript
{
  id: 'viewer-voice-settings',
  label: 'Viewer Voice Settings',
  component: <ViewerVoiceSettingsTab voiceGroups={voiceGroups} accessMode={accessMode} />
}
```

---

### Step 2: Create New Restrictions Screen (2-3 hours)

**2A: Create New Component**

Create: `src/frontend/screens/tts/tabs/ViewerTTSRestrictionsTab.tsx`

**Component Structure:**

```typescript
export const ViewerTTSRestrictionsTab: React.FC = () => {
  // State
  const [mutedUsers, setMutedUsers] = useState<ViewerTTSRules[]>([]);
  const [cooldownUsers, setCooldownUsers] = useState<ViewerTTSRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Viewer[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  
  // Add Restriction Form
  const [restrictionType, setRestrictionType] = useState<'mute' | 'cooldown'>('mute');
  const [mutePeriodMins, setMutePeriodMins] = useState(0); // 0 = permanent
  const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
  const [cooldownPeriodMins, setCooldownPeriodMins] = useState(0); // 0 = permanent
  
  // Load data on mount
  useEffect(() => {
    loadAllRestrictions();
  }, []);
  
  // Listen for real-time updates from chat commands
  useEffect(() => {
    const handleUpdate = (event: any, data: { viewerId: string }) => {
      loadAllRestrictions(); // Refresh entire list
      showNotification('Restriction updated via chat command');
    };
    
    ipcRenderer.on('viewer-tts-rules-updated', handleUpdate);
    return () => {
      ipcRenderer.removeListener('viewer-tts-rules-updated', handleUpdate);
    };
  }, []);
  
  // Auto-refresh every 10 seconds to update countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllRestrictions();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Functions
  const loadAllRestrictions = async () => {
    // Load muted users
    const mutedResponse = await ipcRenderer.invoke('viewer-tts-rules:get-all-muted');
    if (mutedResponse.success) {
      setMutedUsers(mutedResponse.data);
    }
    
    // Load cooldown users
    const cooldownResponse = await ipcRenderer.invoke('viewer-tts-rules:get-all-cooldown');
    if (cooldownResponse.success) {
      setCooldownUsers(cooldownResponse.data);
    }
  };
  
  const handleAddRestriction = async () => {
    if (!selectedViewer) return;
    
    if (restrictionType === 'mute') {
      const response = await ipcRenderer.invoke('viewer-tts-rules:set-mute', {
        viewerId: selectedViewer.id,
        mutePeriodMins: mutePeriodMins === 0 ? null : mutePeriodMins
      });
      
      if (response.success) {
        showSuccess('Mute applied successfully');
        resetForm();
        loadAllRestrictions();
      }
    } else {
      const response = await ipcRenderer.invoke('viewer-tts-rules:set-cooldown', {
        viewerId: selectedViewer.id,
        cooldownGapSeconds,
        cooldownPeriodMins: cooldownPeriodMins === 0 ? null : cooldownPeriodMins
      });
      
      if (response.success) {
        showSuccess('Cooldown applied successfully');
        resetForm();
        loadAllRestrictions();
      }
    }
  };
  
  const handleRemoveMute = async (viewerId: string) => {
    const response = await ipcRenderer.invoke('viewer-tts-rules:remove-mute', { viewerId });
    if (response.success) {
      loadAllRestrictions();
    }
  };
  
  const handleRemoveCooldown = async (viewerId: string) => {
    const response = await ipcRenderer.invoke('viewer-tts-rules:remove-cooldown', { viewerId });
    if (response.success) {
      loadAllRestrictions();
    }
  };
  
  const formatTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Permanent';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };
  
  // JSX (see detailed layout below)
};
```

**2B: JSX Layout Structure**

```tsx
<div className="viewer-tts-restrictions-tab">
  <div className="tab-header">
    <h2>Viewer TTS Restrictions</h2>
    <p className="tab-description">
      Manage mutes and cooldowns for viewer TTS messages. 
      Restrictions can be set here or via chat commands (~mutevoice, ~cooldownvoice).
    </p>
  </div>

  {message && (
    <div className={`message message-${message.type}`}>
      {message.text}
    </div>
  )}

  {/* Add Restriction Section */}
  <div className="add-restriction-section">
    <h3>Add Restriction</h3>
    
    {/* Viewer Search */}
    <div className="search-container">
      <input
        type="text"
        placeholder="Search for viewer..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      {searchResults.length > 0 && (
        <ul className="autocomplete-results">
          {searchResults.map(viewer => (
            <li 
              key={viewer.id}
              onClick={() => selectViewer(viewer)}
            >
              {viewer.display_name || viewer.username}
            </li>
          ))}
        </ul>
      )}
    </div>
    
    {selectedViewer && (
      <div className="restriction-form">
        <h4>Add restriction for: {selectedViewer.display_name || selectedViewer.username}</h4>
        
        {/* Restriction Type Toggle */}
        <div className="restriction-type-toggle">
          <button 
            className={restrictionType === 'mute' ? 'active' : ''}
            onClick={() => setRestrictionType('mute')}
          >
            🔇 Mute
          </button>
          <button 
            className={restrictionType === 'cooldown' ? 'active' : ''}
            onClick={() => setRestrictionType('cooldown')}
          >
            ⏰ Cooldown
          </button>
        </div>
        
        {/* Mute Configuration */}
        {restrictionType === 'mute' && (
          <div className="mute-config">
            <label>Mute Duration (minutes):</label>
            <input 
              type="number" 
              min="0" 
              value={mutePeriodMins}
              onChange={(e) => setMutePeriodMins(parseInt(e.target.value))}
            />
            <p className="help-text">0 = Permanent mute</p>
          </div>
        )}
        
        {/* Cooldown Configuration */}
        {restrictionType === 'cooldown' && (
          <div className="cooldown-config">
            <label>Cooldown Gap (seconds): {cooldownGapSeconds}s</label>
            <input 
              type="range" 
              min="1" 
              max="120" 
              value={cooldownGapSeconds}
              onChange={(e) => setCooldownGapSeconds(parseInt(e.target.value))}
            />
            
            <label>Cooldown Period (minutes): {cooldownPeriodMins === 0 ? 'Permanent' : `${cooldownPeriodMins}m`}</label>
            <input 
              type="range" 
              min="0" 
              max="1440" 
              step="5"
              value={cooldownPeriodMins}
              onChange={(e) => setCooldownPeriodMins(parseInt(e.target.value))}
            />
            <p className="help-text">0 = Permanent cooldown</p>
          </div>
        )}
        
        <div className="button-group">
          <button onClick={handleAddRestriction} className="button-primary">
            Add Restriction
          </button>
          <button onClick={resetForm} className="button-secondary">
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>

  {/* Muted Users Table */}
  <div className="muted-users-section">
    <h3>🔇 Muted Users ({mutedUsers.length})</h3>
    
    {mutedUsers.length === 0 ? (
      <p className="no-data">No users are currently muted.</p>
    ) : (
      <table className="restrictions-table">
        <thead>
          <tr>
            <th>Viewer</th>
            <th>Muted At</th>
            <th>Duration</th>
            <th>Expires In</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mutedUsers.map(rule => (
            <tr key={rule.viewer_id}>
              <td>{rule.viewer_username || rule.viewer_id}</td>
              <td>{new Date(rule.muted_at).toLocaleString()}</td>
              <td>
                {rule.mute_period_mins ? `${rule.mute_period_mins} minutes` : 'Permanent'}
              </td>
              <td className={rule.mute_expires_at ? 'countdown' : 'permanent'}>
                {formatTimeRemaining(rule.mute_expires_at)}
              </td>
              <td>
                <button 
                  onClick={() => handleRemoveMute(rule.viewer_id)}
                  className="button-small button-danger"
                >
                  Unmute
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>

  {/* Cooldown Users Table */}
  <div className="cooldown-users-section">
    <h3>⏰ Users with Cooldowns ({cooldownUsers.length})</h3>
    
    {cooldownUsers.length === 0 ? (
      <p className="no-data">No users have active cooldowns.</p>
    ) : (
      <table className="restrictions-table">
        <thead>
          <tr>
            <th>Viewer</th>
            <th>Gap</th>
            <th>Set At</th>
            <th>Duration</th>
            <th>Expires In</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cooldownUsers.map(rule => (
            <tr key={rule.viewer_id}>
              <td>{rule.viewer_username || rule.viewer_id}</td>
              <td className="cooldown-gap">{rule.cooldown_gap_seconds}s</td>
              <td>{new Date(rule.cooldown_set_at).toLocaleString()}</td>
              <td>
                {rule.cooldown_period_mins ? `${rule.cooldown_period_mins} minutes` : 'Permanent'}
              </td>
              <td className={rule.cooldown_expires_at ? 'countdown' : 'permanent'}>
                {formatTimeRemaining(rule.cooldown_expires_at)}
              </td>
              <td>
                <button 
                  onClick={() => handleRemoveCooldown(rule.viewer_id)}
                  className="button-small button-danger"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
  
  {/* Chat Commands Help Section */}
  <div className="chat-commands-help">
    <h3>💬 Chat Commands</h3>
    <p>Moderators can also manage restrictions via chat:</p>
    <ul className="command-list">
      <li><code>~mutevoice @username [minutes]</code> - Mute user (0 or omit = permanent)</li>
      <li><code>~unmutevoice @username</code> - Remove mute</li>
      <li><code>~cooldownvoice @username &lt;gap_seconds&gt; [period_mins]</code> - Add cooldown</li>
    </ul>
    <p className="help-note">
      Changes made via chat commands will appear here automatically.
    </p>
  </div>
</div>
```

**2C: Add to Tab Registration**

In `src/frontend/screens/tts/TTSScreen.tsx`:

```typescript
import { ViewerTTSRestrictionsTab } from './tabs/ViewerTTSRestrictionsTab';

// Add to tabs array
{
  id: 'viewer-tts-restrictions',
  label: 'Viewer TTS Restrictions',
  component: <ViewerTTSRestrictionsTab />
}
```

---

### Step 3: Update Backend IPC Handlers (30 minutes)

**3A: Add Get All Methods**

These handlers already exist but verify they return viewer info:

In `src/backend/core/ipc-handlers/database.ts`:

```typescript
// Verify these include viewer username/display_name via JOIN
ipcRegistry.register<void, any[]>(
  'viewer-tts-rules:get-all-muted',
  {
    execute: async () => viewerTTSRulesRepo.getAllMuted()
  }
);

ipcRegistry.register<void, any[]>(
  'viewer-tts-rules:get-all-cooldown',
  {
    execute: async () => viewerTTSRulesRepo.getAllCooldown()
  }
);
```

**3B: Update Repository Methods**

In `src/backend/database/repositories/viewer-tts-rules.ts`:

Add JOIN to include viewer info:

```typescript
getAllMuted(): Array<ViewerTTSRules & { viewer_username: string; viewer_display_name: string }> {
  const db = this.getDatabase();
  const rows = db.prepare(`
    SELECT 
      vtr.*,
      v.username as viewer_username,
      v.display_name as viewer_display_name
    FROM viewer_tts_rules vtr
    JOIN viewers v ON v.id = vtr.viewer_id
    WHERE vtr.is_muted = 1
    ORDER BY vtr.muted_at DESC
  `).all();
  
  return rows.map(row => this.mapRow(row));
}

getAllCooldown(): Array<ViewerTTSRules & { viewer_username: string; viewer_display_name: string }> {
  const db = this.getDatabase();
  const rows = db.prepare(`
    SELECT 
      vtr.*,
      v.username as viewer_username,
      v.display_name as viewer_display_name
    FROM viewer_tts_rules vtr
    JOIN viewers v ON v.id = vtr.viewer_id
    WHERE vtr.has_cooldown = 1
    ORDER BY vtr.cooldown_set_at DESC
  `).all();
  
  return rows.map(row => this.mapRow(row));
}
```

---

### Step 4: Styling (1 hour)

**4A: Update Styles**

Create or update: `src/frontend/screens/tts/tabs/styles/ViewerTTSRestrictionsTab.css`

```css
.viewer-tts-restrictions-tab {
  padding: 20px;
}

.add-restriction-section {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.restriction-type-toggle {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.restriction-type-toggle button {
  flex: 1;
  padding: 12px;
  border: 2px solid #444;
  background: #2a2a2a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.restriction-type-toggle button.active {
  background: #4a9eff;
  border-color: #4a9eff;
  color: white;
}

.restrictions-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.restrictions-table th {
  background: #2a2a2a;
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid #444;
}

.restrictions-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #333;
}

.restrictions-table tr:hover {
  background: #252525;
}

.countdown {
  color: #ffd43b;
  font-weight: bold;
}

.permanent {
  color: #ff6b6b;
  font-style: italic;
}

.cooldown-gap {
  background: #2a4a5a;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
}

.muted-users-section,
.cooldown-users-section {
  margin-bottom: 30px;
}

.muted-users-section h3 {
  color: #ff6b6b;
}

.cooldown-users-section h3 {
  color: #ffd43b;
}

.chat-commands-help {
  background: #1e3a5f;
  border: 1px solid #3d5a80;
  border-radius: 8px;
  padding: 20px;
  margin-top: 30px;
}

.chat-commands-help code {
  background: #2a2a2a;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #4a9eff;
}

.command-list {
  list-style: none;
  padding-left: 0;
}

.command-list li {
  padding: 8px 0;
  border-bottom: 1px solid #3d5a80;
}

.command-list li:last-child {
  border-bottom: none;
}

.help-note {
  margin-top: 15px;
  font-style: italic;
  color: #aaa;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 40px;
  font-style: italic;
}
```

**4B: Update Voice Settings Styles**

Remove mute/cooldown specific styles from existing CSS.

---

### Step 5: Update Tab Navigation Order (15 minutes)

**5A: Organize TTS Tabs Logically**

In `src/frontend/screens/tts/TTSScreen.tsx`, order tabs as:

1. **General Settings** - Global TTS config
2. **Voices** - Available voices
3. **Viewer Voice Settings** - Custom voice preferences (renamed)
4. **Viewer TTS Restrictions** - Mutes & cooldowns (NEW)
5. **Access Control** - Who can use TTS
6. **Channel Points** - Redemption settings

---

### Step 6: Testing Checklist (1 hour)

**6A: Voice Settings Screen**
- [ ] Rename verification
- [ ] No mute/cooldown UI elements present
- [ ] Search for viewer works
- [ ] Create voice preference works
- [ ] Update voice preference works
- [ ] Delete voice preference works
- [ ] "Existing Voice Settings" table shows all voice prefs
- [ ] No database errors

**6B: TTS Restrictions Screen**
- [ ] Muted users table populates
- [ ] Cooldown users table populates
- [ ] Search for viewer works
- [ ] Create mute (permanent) works
- [ ] Create mute (timed) works
- [ ] Create cooldown (permanent) works
- [ ] Create cooldown (timed) works
- [ ] Unmute button works
- [ ] Remove cooldown button works
- [ ] Countdown timers update every 10 seconds
- [ ] Event listener receives chat command updates
- [ ] UI auto-refreshes when chat command executed
- [ ] Notification appears when rules updated via chat

**6C: Integration Testing**
- [ ] Chat command `~mutevoice @user` → appears in restrictions screen
- [ ] Chat command `~unmutevoice @user` → disappears from restrictions screen
- [ ] Chat command `~cooldownvoice @user 30 15` → appears in restrictions screen
- [ ] Navigate away and back → restrictions still visible
- [ ] Multiple users with different restrictions → all displayed correctly
- [ ] Expired restrictions handled gracefully

**6D: Database Consistency**
- [ ] Voice preferences and TTS rules completely independent
- [ ] Can have voice preference without restrictions
- [ ] Can have restrictions without voice preference
- [ ] Deleting voice preference doesn't affect restrictions
- [ ] Clearing restrictions doesn't affect voice preference

---

## 📊 Benefits of Split Design

### For Users

✅ **Clarity:** Clear separation of concerns  
✅ **Discoverability:** Easy to find muted/cooldown users  
✅ **Real-time:** See all active restrictions at a glance  
✅ **Monitoring:** Countdown timers show when restrictions expire  
✅ **Integration:** Chat commands update UI automatically  

### For Developers

✅ **Maintainability:** Each screen has single responsibility  
✅ **Testability:** Easier to test isolated features  
✅ **Extensibility:** Add features without affecting other screen  
✅ **Debugging:** Clear separation makes bugs easier to find  

### For Database

✅ **Consistency:** Two tables remain independent  
✅ **Flexibility:** Voice prefs optional for restrictions  
✅ **Performance:** Efficient queries for each use case  

---

## 🗑️ Code to Remove

### From ViewerRulesTab.tsx (now ViewerVoiceSettingsTab.tsx)

**State Variables:**
```typescript
// REMOVE:
const [ttsRules, setTtsRules] = useState<ViewerTTSRules | null>(null);
const [isMuted, setIsMuted] = useState(false);
const [mutePeriodMins, setMutePeriodMins] = useState(0);
const [hasCooldown, setHasCooldown] = useState(false);
const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
const [cooldownPeriodMins, setCooldownPeriodMins] = useState(0);
```

**Functions:**
```typescript
// REMOVE:
const loadTTSRules = async (viewerId: string) => { ... }
const handleToggleMute = (enabled: boolean) => { ... }
const handleToggleCooldown = (enabled: boolean) => { ... }
const handleClearAllRules = async () => { ... }
const handleSaveRule = async () => {
  // REMOVE: TTS rules save logic
  // KEEP: Voice preference save logic only
}
```

**useEffect Hooks:**
```typescript
// REMOVE: TTS rules event listener
useEffect(() => {
  const handleTTSRulesUpdated = ...
  ipcRenderer.on('viewer-tts-rules-updated', handleTTSRulesUpdated);
  ...
}, [selectedViewer]);
```

**JSX Elements:**
```tsx
{/* REMOVE: TTS Rules Status Display */}
{ttsRules && (
  <div style={{ backgroundColor: '#1e3a5f', ... }}>
    ...
  </div>
)}

{/* REMOVE: TTS Restrictions Section */}
<div className="tts-rules-section">
  <h4>TTS Restrictions</h4>
  ...
</div>

{/* REMOVE: Mute Control */}
<div className="tts-rule-control">
  ...
</div>

{/* REMOVE: Cooldown Control */}
<div className="tts-rule-control">
  ...
</div>

{/* REMOVE: Clear All Button */}
{(ttsRules?.is_muted || ttsRules?.has_cooldown) && (
  <button onClick={handleClearAllRules}>
    ...
  </button>
)}

{/* REMOVE: Refresh Rules Button */}
<button onClick={() => selectedViewer && loadTTSRules(selectedViewer.id)}>
  🔄 Refresh Rules
</button>
```

**Keep Only:**
- Viewer search
- Voice selection (voice picker, filters)
- Pitch slider
- Speed slider
- Save/Update/Delete voice preference buttons
- Existing voice preferences table

---

## 📁 Files to Modify

### Frontend

1. **Rename:**
   - `src/frontend/screens/tts/tabs/ViewerRulesTab.tsx`
   - → `src/frontend/screens/tts/tabs/ViewerVoiceSettingsTab.tsx`

2. **Create:**
   - `src/frontend/screens/tts/tabs/ViewerTTSRestrictionsTab.tsx`
   - `src/frontend/screens/tts/tabs/styles/ViewerTTSRestrictionsTab.css`

3. **Modify:**
   - `src/frontend/screens/tts/TTSScreen.tsx` (update imports, tab registration)
   - Remove mute/cooldown logic from ViewerVoiceSettingsTab.tsx

### Backend

4. **Modify:**
   - `src/backend/database/repositories/viewer-tts-rules.ts`
   - Add JOINs to `getAllMuted()` and `getAllCooldown()` to include viewer info

5. **Verify:**
   - `src/backend/core/ipc-handlers/database.ts` (handlers already exist)

### No Database Changes Required

✅ Tables remain unchanged:
- `viewer_rules` - voice preferences
- `viewer_tts_rules` - mutes & cooldowns

---

## 📝 Documentation Updates

### Update These Docs

- [ ] `README.md` - Update TTS features section
- [ ] `PHASE-5-IMPLEMENTATION-SUMMARY.md` - Document screen split
- [ ] `ENHANCED-VIEWER-TTS-RULES.md` - Mark as superseded
- [ ] Create: `VIEWER-VOICE-SETTINGS.md` - New screen docs
- [ ] Create: `VIEWER-TTS-RESTRICTIONS.md` - New screen docs

---

## 🎯 Success Criteria

- [ ] **Two separate screens exist** with clear purposes
- [ ] **Voice Settings screen** has zero mute/cooldown logic
- [ ] **Restrictions screen** shows all muted/cooldown users at a glance
- [ ] **Chat commands update Restrictions screen** automatically
- [ ] **No database schema changes** required
- [ ] **All existing functionality** preserved
- [ ] **Build completes** without errors
- [ ] **No TypeScript errors**
- [ ] **All tests pass** (8 test scenarios from checklist)

---

## 🚀 Rollout Plan

### Phase 1: Rename & Clean (1 hour)
- Rename ViewerRulesTab → ViewerVoiceSettingsTab
- Remove mute/cooldown code
- Test voice preferences still work

### Phase 2: Create Restrictions Screen (2-3 hours)
- Build new component
- Implement tables
- Add form
- Style everything

### Phase 3: Integration & Testing (1-2 hours)
- Wire up event listeners
- Test chat command integration
- Verify countdown timers
- Test all scenarios

---

## 💡 Future Enhancements (Post-Split)

Once split is complete, we can add:

1. **Bulk Actions:**
   - "Unmute All Expired" button
   - "Clear All Cooldowns" button
   - Multi-select for batch operations

2. **Advanced Filtering:**
   - Filter by permanent vs temporary
   - Sort by expiration time
   - Search within restrictions list

3. **Statistics:**
   - Total mutes issued (lifetime)
   - Average mute duration
   - Most frequently restricted users

4. **Export/Import:**
   - Export restrictions list
   - Import ban/mute lists

5. **Templates:**
   - "Standard 30min mute"
   - "Spam cooldown (5s gap, 1hr)"
   - Quick-apply presets

---

**Next Steps:**
1. Review this plan
2. Confirm approach
3. Implement tomorrow
4. Test thoroughly
5. Deploy with confidence! 🎉
