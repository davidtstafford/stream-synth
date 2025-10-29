# TTS Access & Enablement System - Architecture Document

## 📋 Executive Summary

This document outlines the complete architecture for implementing a modular, future-proof TTS access control system for Stream Synth. The system will manage viewer access to TTS features and premium voices (Azure/Google) based on subscription status, VIP status, and channel point redeems.

---

## 🎯 Design Principles

1. **Modular & Centralized**: Single source of truth for access validation
2. **Future-Proof**: Extensible for chat commands, bot integration, and in-app currency
3. **Cost Control**: Granular control over premium voice usage (Azure/Google)
4. **Non-Breaking**: Uses existing IPC framework pattern
5. **Database-First**: Leverage existing SQLite infrastructure

---

## 🏗️ System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Chat Message Arrives (IRC)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         TTS Access Control Service (NEW)                     │
│  1. Get Access Mode (All/Limited/Premium)                    │
│  2. Check Viewer Eligibility (Sub/VIP/Redeem)               │
│  3. Determine Voice Selection                                │
│     ├─ Custom voice set? → Validate eligibility             │
│     ├─ Premium voice but no access? → Fallback to global    │
│     └─ No custom voice? → Use global                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         TTS Manager (EXISTING - Modified)                    │
│  • Receives validated voice selection                        │
│  • Processes message with spam filters (existing)            │
│  • Queues and speaks message                                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────┤
│  TTS Screen (tabs)                                           │
│  ├─ Voice Settings Tab (EXISTING)                            │
│  ├─ TTS Rules Tab (EXISTING - to be renamed)                │
│  ├─ TTS Access Tab (NEW)                                     │
│  └─ Viewer Rules Tab (NEW)                                   │
└────────────────────┬────────────────────────────────────────┘
                     │ IPC Framework
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Electron Main)                     │
├─────────────────────────────────────────────────────────────┤
│  IPC Handlers (NEW)                                          │
│  ├─ tts-access:get-config                                    │
│  ├─ tts-access:save-config                                   │
│  ├─ tts-access:validate-config                               │
│  ├─ viewer-rules:list                                        │
│  ├─ viewer-rules:get                                         │
│  ├─ viewer-rules:save                                        │
│  ├─ viewer-rules:delete                                      │
│  └─ viewer-rules:search                                      │
├─────────────────────────────────────────────────────────────┤
│  Services (NEW)                                              │
│  ├─ TTSAccessControlService                                  │
│  │   ├─ validateViewerAccess()                               │
│  │   ├─ determineVoiceForViewer()                            │
│  │   ├─ checkSubscriptionEligibility()                       │
│  │   ├─ checkVIPEligibility()                                │
│  │   ├─ checkRedeemEligibility()                             │
│  │   └─ isVoicePremium()                                     │
│  └─ TwitchVIPService (NEW)                                   │
│      ├─ syncVIPsFromTwitch()                                 │
│      ├─ isViewerVIP()                                        │
│      └─ fetchVIPsFromAPI()                                   │
├─────────────────────────────────────────────────────────────┤
│  Repositories (NEW & MODIFIED)                               │
│  ├─ TTSAccessRepository (NEW)                                │
│  ├─ ViewerRulesRepository (NEW)                              │
│  ├─ ChannelPointGrantsRepository (NEW)                       │
│  ├─ ViewerRolesRepository (NEW)                              │
│  └─ ViewersRepository (MODIFIED - add voice fields)          │
├─────────────────────────────────────────────────────────────┤
│  Database (SQLite)                                           │
│  ├─ tts_access_config (NEW)                                  │
│  ├─ viewer_voice_preferences (NEW)                           │
│  ├─ viewer_roles (NEW - VIP tracking)                        │
│  ├─ channel_point_grants (NEW)                               │
│  └─ viewers (MODIFIED - add voice preferences)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### New Tables

#### 1. `tts_access_config`
Stores the global TTS access configuration.

```sql
CREATE TABLE tts_access_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_mode TEXT NOT NULL DEFAULT 'access_all', 
    -- 'access_all' | 'limited_access' | 'premium_voice_access'
  
  -- Limited Access Rules
  limited_allow_subscribers INTEGER DEFAULT 1,  -- Always 1 when mode = limited_access
  limited_deny_gifted_subs INTEGER DEFAULT 0,
  limited_allow_vip INTEGER DEFAULT 0,
  limited_redeem_name TEXT,
  limited_redeem_duration_mins INTEGER,
  
  -- Premium Voice Access Rules  
  premium_allow_subscribers INTEGER DEFAULT 1,  -- Always 1 when mode = premium_voice_access
  premium_deny_gifted_subs INTEGER DEFAULT 0,
  premium_allow_vip INTEGER DEFAULT 0,
  premium_redeem_name TEXT,
  premium_redeem_duration_mins INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (id = 1) -- Ensure only one config row
);

-- Insert default config
INSERT INTO tts_access_config (id, access_mode) VALUES (1, 'access_all');
```

#### 2. `viewer_voice_preferences`
Stores custom voice settings per viewer (replaces `viewers.tts_voice_id`).

```sql
CREATE TABLE viewer_voice_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id TEXT NOT NULL UNIQUE,
  voice_id TEXT NOT NULL,          -- Voice ID from voices table
  provider TEXT NOT NULL,           -- 'webspeech' | 'azure' | 'google'
  pitch REAL DEFAULT 1.0,           -- 0.5 to 2.0
  speed REAL DEFAULT 1.0,           -- 0.5 to 2.0
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
);

CREATE INDEX idx_viewer_voice_prefs ON viewer_voice_preferences(viewer_id);
```

#### 3. `viewer_roles`
Tracks VIP status and other roles for viewers.

```sql
CREATE TABLE viewer_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id TEXT NOT NULL,
  role_type TEXT NOT NULL,          -- 'vip' | 'moderator' | 'broadcaster'
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME,               -- NULL = still active
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
  UNIQUE(viewer_id, role_type)
);

CREATE INDEX idx_viewer_roles ON viewer_roles(viewer_id, role_type);
CREATE INDEX idx_active_roles ON viewer_roles(viewer_id, role_type, revoked_at);
```

#### 4. `channel_point_grants`
Tracks temporary TTS access granted via channel point redeems.

```sql
CREATE TABLE channel_point_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id TEXT NOT NULL,
  grant_type TEXT NOT NULL,         -- 'limited_access' | 'premium_voice_access'
  redeem_name TEXT NOT NULL,        -- Name of the channel points reward
  duration_mins INTEGER NOT NULL,   -- How many minutes granted
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,     -- granted_at + duration_mins
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
);

CREATE INDEX idx_grants_viewer ON channel_point_grants(viewer_id);
CREATE INDEX idx_grants_expiry ON channel_point_grants(expires_at);
CREATE INDEX idx_grants_active ON channel_point_grants(viewer_id, expires_at);
```

### Modified Tables

#### Modify `viewers` table
Remove `tts_voice_id` (moved to `viewer_voice_preferences`), keep `tts_enabled`.

**Migration Strategy**: 
- Create new `viewer_voice_preferences` table
- Migrate existing `tts_voice_id` data to new table
- Drop `tts_voice_id` column (SQLite requires table recreation)

```sql
-- Migration will be handled in migrations.ts
-- We'll recreate the viewers table without tts_voice_id
```

---

## 🔧 Backend Services

### 1. TTSAccessControlService

**Location**: `src/backend/services/tts-access-control.ts`

**Purpose**: Central service for validating viewer TTS access and voice eligibility.

**Key Methods**:

```typescript
interface AccessValidationResult {
  canUseTTS: boolean;           // Can viewer use TTS at all?
  canUsePremiumVoices: boolean; // Can viewer use Azure/Google voices?
  voiceToUse: string | null;    // Final voice ID to use (after validation)
  reason?: string;              // Debug/log reason for denial
}

class TTSAccessControlService {
  /**
   * Main validation entry point - called before TTS speaks
   */
  async validateAndDetermineVoice(
    viewerId: string, 
    message: string
  ): Promise<AccessValidationResult>

  /**
   * Check if viewer passes access mode rules
   */
  private async checkAccessEligibility(
    viewerId: string, 
    mode: 'limited_access' | 'premium_voice_access'
  ): Promise<boolean>

  /**
   * Check if viewer is subscribed (and if gifted subs are allowed)
   */
  private async checkSubscriptionEligibility(
    viewerId: string, 
    denyGifted: boolean
  ): Promise<boolean>

  /**
   * Check if viewer has VIP role
   */
  private async checkVIPEligibility(viewerId: string): Promise<boolean>

  /**
   * Check if viewer has active channel point grant
   */
  private async checkRedeemEligibility(
    viewerId: string, 
    grantType: string
  ): Promise<boolean>

  /**
   * Determine if a voice ID is premium (Azure/Google)
   */
  private async isVoicePremium(voiceId: string): Promise<boolean>

  /**
   * Get the global default voice
   */
  private async getGlobalDefaultVoice(): Promise<string>

  /**
   * Get viewer's custom voice preference
   */
  private async getViewerCustomVoice(viewerId: string): Promise<{
    voiceId: string;
    provider: string;
    pitch: number;
    speed: number;
  } | null>
}
```

**Logic Flow**:

```typescript
async validateAndDetermineVoice(viewerId: string, message: string) {
  // 1. Get access config
  const config = await this.accessRepo.getConfig();
  
  // 2. Handle "Access to All" mode
  if (config.access_mode === 'access_all') {
    const customVoice = await this.getViewerCustomVoice(viewerId);
    return {
      canUseTTS: true,
      canUsePremiumVoices: true,
      voiceToUse: customVoice?.voiceId || await this.getGlobalDefaultVoice()
    };
  }
  
  // 3. Handle "Limited Access" mode
  if (config.access_mode === 'limited_access') {
    const canAccess = await this.checkAccessEligibility(viewerId, 'limited_access');
    
    if (!canAccess) {
      return {
        canUseTTS: false,
        canUsePremiumVoices: false,
        voiceToUse: null,
        reason: 'Viewer does not meet Limited Access criteria'
      };
    }
    
    // Viewer has access - use their custom voice or global
    const customVoice = await this.getViewerCustomVoice(viewerId);
    return {
      canUseTTS: true,
      canUsePremiumVoices: true,
      voiceToUse: customVoice?.voiceId || await this.getGlobalDefaultVoice()
    };
  }
  
  // 4. Handle "Premium Voice Access" mode
  if (config.access_mode === 'premium_voice_access') {
    const canUsePremium = await this.checkAccessEligibility(viewerId, 'premium_voice_access');
    const customVoice = await this.getViewerCustomVoice(viewerId);
    
    // Everyone can use TTS, but voice depends on premium access
    if (customVoice) {
      const isPremium = await this.isVoicePremium(customVoice.voiceId);
      
      if (isPremium && !canUsePremium) {
        // Viewer has premium voice set but no access - fallback to global
        return {
          canUseTTS: true,
          canUsePremiumVoices: false,
          voiceToUse: await this.getGlobalDefaultVoice(),
          reason: 'Premium voice access denied, using global default'
        };
      }
      
      // Viewer can use their custom voice
      return {
        canUseTTS: true,
        canUsePremiumVoices: canUsePremium,
        voiceToUse: customVoice.voiceId
      };
    }
    
    // No custom voice - use global
    return {
      canUseTTS: true,
      canUsePremiumVoices: canUsePremium,
      voiceToUse: await this.getGlobalDefaultVoice()
    };
  }
}

private async checkAccessEligibility(viewerId: string, mode: string) {
  const config = await this.accessRepo.getConfig();
  
  const denyGifted = mode === 'limited_access' 
    ? config.limited_deny_gifted_subs 
    : config.premium_deny_gifted_subs;
  const allowVIP = mode === 'limited_access'
    ? config.limited_allow_vip
    : config.premium_allow_vip;
  const redeemName = mode === 'limited_access'
    ? config.limited_redeem_name
    : config.premium_redeem_name;
  
  // Check subscriber status (always checked first - required)
  const isSubEligible = await this.checkSubscriptionEligibility(viewerId, denyGifted);
  if (isSubEligible) return true;
  
  // Check VIP status
  if (allowVIP) {
    const isVIP = await this.checkVIPEligibility(viewerId);
    if (isVIP) return true;
  }
  
  // Check channel point grant
  if (redeemName) {
    const hasGrant = await this.checkRedeemEligibility(viewerId, mode);
    if (hasGrant) return true;
  }
  
  return false;
}
```

---

### 2. TwitchVIPService

**Location**: `src/backend/services/twitch-vip.ts`

**Purpose**: Sync and track VIP status for viewers (similar to `TwitchSubscriptionsService`).

**Implementation**:

```typescript
export class TwitchVIPService {
  private tokensRepo: TokensRepository;
  private rolesRepo: ViewerRolesRepository;
  private viewersRepo: ViewersRepository;

  /**
   * Sync VIPs from Twitch API (similar to subscription sync)
   * Uses Helix API: GET https://api.twitch.tv/helix/channels/vips
   */
  async syncVIPsFromTwitch(
    broadcasterId: string, 
    userId: string
  ): Promise<{ success: boolean; count?: number; error?: string }>

  /**
   * Check if a viewer is currently VIP
   */
  async isViewerVIP(viewerId: string): Promise<boolean>

  /**
   * Fetch VIPs from Twitch API with pagination
   */
  private async fetchVIPsFromAPI(
    broadcasterId: string,
    accessToken: string,
    clientId: string
  ): Promise<any[]>
}
```

**API Details**:
- Endpoint: `GET https://api.twitch.tv/helix/channels/vips`
- Requires: `channel:read:vips` or `channel:manage:vips` scope
- Pagination: Similar to subscriptions (use `after` cursor)
- Response: `{ data: [{ user_id, user_login, user_name }], pagination: { cursor } }`

---

### 3. Modified TTSManager

**Location**: `src/backend/services/tts/manager.ts`

**Changes Required**:

```typescript
export class TTSManager {
  private accessControl: TTSAccessControlService; // NEW
  
  constructor(db: Database.Database) {
    // ...existing code...
    this.accessControl = new TTSAccessControlService(); // NEW
  }
  
  /**
   * Queue a TTS message (MODIFIED)
   * Now validates access before queueing
   */
  async speak(
    username: string, 
    message: string, 
    viewerId?: string  // NEW parameter
  ): Promise<void> {
    // NEW: Validate access if viewerId provided
    if (viewerId) {
      const validation = await this.accessControl.validateAndDetermineVoice(
        viewerId, 
        message
      );
      
      if (!validation.canUseTTS) {
        console.log(`[TTS] Viewer ${username} denied TTS access: ${validation.reason}`);
        return; // Silent denial - don't queue message
      }
      
      // Use validated voice
      const voiceToUse = validation.voiceToUse;
      console.log(`[TTS] Using voice ${voiceToUse} for ${username}`);
      
      // Continue with existing spam filtering and queueing...
      // Use voiceToUse instead of settings.voiceId
    }
    
    // ...existing spam filtering code...
    // ...existing queueing code...
  }
}
```

---

## 🗂️ Database Repositories

### 1. TTSAccessRepository

**Location**: `src/backend/database/repositories/tts-access.ts`

```typescript
export interface TTSAccessConfig {
  id: number;
  access_mode: 'access_all' | 'limited_access' | 'premium_voice_access';
  
  // Limited Access
  limited_allow_subscribers: number;
  limited_deny_gifted_subs: number;
  limited_allow_vip: number;
  limited_redeem_name: string | null;
  limited_redeem_duration_mins: number | null;
  
  // Premium Voice Access
  premium_allow_subscribers: number;
  premium_deny_gifted_subs: number;
  premium_allow_vip: number;
  premium_redeem_name: string | null;
  premium_redeem_duration_mins: number | null;
  
  created_at: string;
  updated_at: string;
}

export class TTSAccessRepository extends BaseRepository<TTSAccessConfig> {
  get tableName(): string {
    return 'tts_access_config';
  }
  
  getConfig(): TTSAccessConfig
  saveConfig(config: Partial<TTSAccessConfig>): void
  validateConfig(config: Partial<TTSAccessConfig>): string | null
}
```

---

### 2. ViewerRulesRepository

**Location**: `src/backend/database/repositories/viewer-rules.ts`

```typescript
export interface ViewerVoicePreference {
  id: number;
  viewer_id: string;
  voice_id: string;
  provider: string;
  pitch: number;
  speed: number;
  created_at: string;
  updated_at: string;
}

export class ViewerRulesRepository extends BaseRepository<ViewerVoicePreference> {
  get tableName(): string {
    return 'viewer_voice_preferences';
  }
  
  getByViewerId(viewerId: string): ViewerVoicePreference | null
  upsert(pref: Omit<ViewerVoicePreference, 'id' | 'created_at' | 'updated_at'>): void
  deleteByViewerId(viewerId: string): void
  getAllWithViewerInfo(): Array<ViewerVoicePreference & { display_name: string }>
  search(query: string): Array<ViewerVoicePreference & { display_name: string }>
}
```

---

### 3. ViewerRolesRepository

**Location**: `src/backend/database/repositories/viewer-roles.ts`

```typescript
export interface ViewerRole {
  id: number;
  viewer_id: string;
  role_type: 'vip' | 'moderator' | 'broadcaster';
  granted_at: string;
  revoked_at: string | null;
}

export class ViewerRolesRepository extends BaseRepository<ViewerRole> {
  get tableName(): string {
    return 'viewer_roles';
  }
  
  isViewerVIP(viewerId: string): boolean
  grantRole(viewerId: string, roleType: string): void
  revokeRole(viewerId: string, roleType: string): void
  syncVIPs(viewerIds: string[]): void  // Sync from Twitch API
}
```

---

### 4. ChannelPointGrantsRepository

**Location**: `src/backend/database/repositories/channel-point-grants.ts`

```typescript
export interface ChannelPointGrant {
  id: number;
  viewer_id: string;
  grant_type: 'limited_access' | 'premium_voice_access';
  redeem_name: string;
  duration_mins: number;
  granted_at: string;
  expires_at: string;
}

export class ChannelPointGrantsRepository extends BaseRepository<ChannelPointGrant> {
  get tableName(): string {
    return 'channel_point_grants';
  }
  
  createGrant(viewerId: string, grantType: string, redeemName: string, durationMins: number): void
  hasActiveGrant(viewerId: string, grantType: string): boolean
  cleanupExpiredGrants(): void  // Background cleanup job
}
```

---

## 🎨 Frontend Components

### 1. TTS Access Tab (NEW)

**Location**: `src/frontend/screens/tts/tabs/TTSAccessTab.tsx`

**UI Structure**:

```tsx
export const TTSAccessTab: React.FC = () => {
  const [config, setConfig] = useState<TTSAccessConfig | null>(null);
  const [globalVoice, setGlobalVoice] = useState<{ provider: string } | null>(null);
  
  // Validation: Prevent enabling Premium Voice Access if global is premium
  const canEnablePremiumMode = globalVoice?.provider === 'webspeech';
  
  return (
    <div className="tts-access-tab">
      <h2>TTS Access Control</h2>
      
      {/* Mode Selector */}
      <div className="access-mode-selector">
        <label>Apply TTS Restrictions:</label>
        <select 
          value={config.access_mode} 
          onChange={handleModeChange}
        >
          <option value="access_all">Access to All</option>
          <option value="limited_access">Limited Access</option>
          <option value="premium_voice_access">Premium Voice Access</option>
        </select>
      </div>
      
      {/* Conditional Rules - Limited Access */}
      {config.access_mode === 'limited_access' && (
        <div className="access-rules">
          <h3>Limited Access Rules</h3>
          <label>
            <input 
              type="checkbox" 
              checked={true} 
              disabled 
            />
            Allow Subscribers (required)
          </label>
          
          <label className="sub-rule">
            <input 
              type="checkbox"
              checked={config.limited_deny_gifted_subs}
              onChange={(e) => updateConfig('limited_deny_gifted_subs', e.target.checked ? 1 : 0)}
            />
            Deny Gifted Subscribers
          </label>
          
          <label>
            <input 
              type="checkbox"
              checked={config.limited_allow_vip}
              onChange={(e) => updateConfig('limited_allow_vip', e.target.checked ? 1 : 0)}
            />
            Allow VIP
          </label>
          
          <div className="redeem-config">
            <label>
              <input type="checkbox" checked={!!config.limited_redeem_name} />
              If Redeem
            </label>
            <input 
              type="text" 
              placeholder="Redeem name"
              value={config.limited_redeem_name || ''}
              onChange={(e) => updateConfig('limited_redeem_name', e.target.value)}
            />
            <span>is activated, allocate</span>
            <input 
              type="number" 
              min="0"
              value={config.limited_redeem_duration_mins || 0}
              onChange={(e) => updateConfig('limited_redeem_duration_mins', parseInt(e.target.value))}
            />
            <span>mins of access</span>
          </div>
        </div>
      )}
      
      {/* Conditional Rules - Premium Voice Access */}
      {config.access_mode === 'premium_voice_access' && (
        <>
          {!canEnablePremiumMode && (
            <div className="warning-message">
              ⚠️ Cannot enable Premium Voice Access while global voice is set to Azure or Google.
              Please set global voice to WebSpeech first.
            </div>
          )}
          
          <div className="access-rules">
            {/* Same structure as Limited Access but with premium_ fields */}
          </div>
        </>
      )}
      
      <button onClick={handleSave}>Save Configuration</button>
    </div>
  );
};
```

---

### 2. Viewer Rules Tab (NEW)

**Location**: `src/frontend/screens/tts/tabs/ViewerRulesTab.tsx`

**UI Structure**:

```tsx
export const ViewerRulesTab: React.FC = () => {
  const [viewers, setViewers] = useState<ViewerWithRule[]>([]);
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRule, setEditingRule] = useState<ViewerVoicePreference | null>(null);
  
  // Voice selection UI (mirrored from VoiceSettingsTab)
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([]);
  const [providerFilter, setProviderFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [voiceSearchTerm, setVoiceSearchTerm] = useState('');
  
  return (
    <div className="viewer-rules-tab">
      <h2>Viewer Custom Voice Rules</h2>
      
      {/* Viewer Search/Autocomplete */}
      <div className="viewer-search">
        <input
          type="text"
          placeholder="Search for viewer..."
          value={searchTerm}
          onChange={(e) => handleViewerSearch(e.target.value)}
        />
        
        {/* Autocomplete dropdown */}
        {searchResults.length > 0 && (
          <ul className="autocomplete-results">
            {searchResults.map(viewer => (
              <li onClick={() => selectViewer(viewer.id)}>
                {viewer.display_name || viewer.username}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Create/Edit Rule Button */}
      {selectedViewer && (
        <button onClick={hasRule ? handleEditRule : handleCreateRule}>
          {hasRule ? 'Edit Rule' : 'Create Rule'}
        </button>
      )}
      
      {/* Voice Selection UI (shown when creating/editing) */}
      {editingRule && (
        <div className="voice-selection-panel">
          <h3>Select Voice for {selectedViewer.display_name}</h3>
          
          {/* Mirror VoiceSettingsTab filters */}
          <div className="filters">
            <input 
              type="text" 
              placeholder="Search voices..."
              value={voiceSearchTerm}
              onChange={(e) => setVoiceSearchTerm(e.target.value)}
            />
            
            <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              <option value="all">All Providers</option>
              <option value="webspeech">WebSpeech</option>
              <option value="azure">Azure</option>
              <option value="google">Google</option>
            </select>
            
            {/* Language and Gender filters */}
          </div>
          
          {/* Voice Dropdown */}
          <select 
            value={editingRule.voice_id}
            onChange={(e) => updateRule('voice_id', e.target.value)}
          >
            {filteredVoices.map(voice => (
              <option value={voice.voice_id}>
                {formatVoiceOption(voice)}
              </option>
            ))}
          </select>
          
          {/* Validation Warning */}
          {voiceValidationWarning && (
            <div className="validation-warning">
              ⚠️ {voiceValidationWarning}
            </div>
          )}
          
          {/* Pitch Slider */}
          <div className="pitch-control">
            <label>Pitch: {editingRule.pitch}</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1"
              value={editingRule.pitch}
              onChange={(e) => updateRule('pitch', parseFloat(e.target.value))}
            />
          </div>
          
          {/* Speed Slider */}
          <div className="speed-control">
            <label>Speed: {editingRule.speed}</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1"
              value={editingRule.speed}
              onChange={(e) => updateRule('speed', parseFloat(e.target.value))}
            />
          </div>
          
          <button onClick={handleSaveRule}>Save Rule</button>
          <button onClick={handleCancelEdit}>Cancel</button>
        </div>
      )}
      
      {/* Existing Rules List */}
      <div className="existing-rules">
        <h3>Existing Viewer Rules</h3>
        <table>
          <thead>
            <tr>
              <th>Viewer</th>
              <th>Voice</th>
              <th>Provider</th>
              <th>Pitch</th>
              <th>Speed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {viewers.map(viewer => (
              <tr key={viewer.viewer_id}>
                <td>{viewer.display_name}</td>
                <td>{viewer.voice_name}</td>
                <td>{viewer.provider}</td>
                <td>{viewer.pitch}</td>
                <td>{viewer.speed}</td>
                <td>
                  <button onClick={() => editRule(viewer)}>Edit</button>
                  <button onClick={() => deleteRule(viewer.viewer_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## 🔌 IPC Handlers

**Location**: `src/backend/core/ipc-handlers/tts-access.ts` (NEW file)

Following the established IPC framework pattern:

```typescript
import { ipcRegistry } from '../ipc/ipc-framework';
import { TTSAccessRepository } from '../../database/repositories/tts-access';
import { ViewerRulesRepository } from '../../database/repositories/viewer-rules';
import { TTSAccessControlService } from '../../services/tts-access-control';

export function setupTTSAccessHandlers(): void {
  const accessRepo = new TTSAccessRepository();
  const rulesRepo = new ViewerRulesRepository();
  const accessControl = new TTSAccessControlService();
  
  // Get TTS Access Config
  ipcRegistry.register<void, TTSAccessConfig>(
    'tts-access:get-config',
    {
      execute: async () => {
        return accessRepo.getConfig();
      }
    }
  );
  
  // Save TTS Access Config
  ipcRegistry.register<Partial<TTSAccessConfig>, { success: boolean }>(
    'tts-access:save-config',
    {
      validate: (input) => {
        const error = accessRepo.validateConfig(input);
        return error;
      },
      execute: async (input) => {
        accessRepo.saveConfig(input);
        return { success: true };
      }
    }
  );
  
  // Validate config (for UI validation)
  ipcRegistry.register<Partial<TTSAccessConfig>, { valid: boolean; error?: string }>(
    'tts-access:validate-config',
    {
      execute: async (input) => {
        const error = accessRepo.validateConfig(input);
        return {
          valid: !error,
          error: error || undefined
        };
      }
    }
  );
  
  // List all viewer rules
  ipcRegistry.register<void, ViewerVoicePreference[]>(
    'viewer-rules:list',
    {
      execute: async () => {
        return rulesRepo.getAllWithViewerInfo();
      }
    }
  );
  
  // Get viewer rule
  ipcRegistry.register<{ viewerId: string }, ViewerVoicePreference | null>(
    'viewer-rules:get',
    {
      validate: (input) => input.viewerId ? null : 'Viewer ID required',
      execute: async (input) => {
        return rulesRepo.getByViewerId(input.viewerId);
      }
    }
  );
  
  // Save viewer rule
  ipcRegistry.register<Omit<ViewerVoicePreference, 'id' | 'created_at' | 'updated_at'>, { success: boolean }>(
    'viewer-rules:save',
    {
      validate: (input) => {
        if (!input.viewer_id) return 'Viewer ID required';
        if (!input.voice_id) return 'Voice ID required';
        if (!input.provider) return 'Provider required';
        return null;
      },
      execute: async (input) => {
        rulesRepo.upsert(input);
        return { success: true };
      }
    }
  );
  
  // Delete viewer rule
  ipcRegistry.register<{ viewerId: string }, { success: boolean }>(
    'viewer-rules:delete',
    {
      validate: (input) => input.viewerId ? null : 'Viewer ID required',
      execute: async (input) => {
        rulesRepo.deleteByViewerId(input.viewerId);
        return { success: true };
      }
    }
  );
  
  // Search viewers (for autocomplete)
  ipcRegistry.register<{ query: string }, ViewerVoicePreference[]>(
    'viewer-rules:search',
    {
      validate: (input) => input.query ? null : 'Search query required',
      execute: async (input) => {
        return rulesRepo.search(input.query);
      }
    }
  );
}
```

---

## 🔄 Integration Points

### 1. IRC Chat Message Flow

**Location**: `src/backend/services/twitch-irc.ts`

**Current Flow**:
```typescript
client.on('message', (channel, tags, message, self) => {
  // ...existing code...
  
  if (ttsEnabled) {
    ttsManager.speak(username, cleanMessage);
  }
});
```

**Modified Flow**:
```typescript
client.on('message', (channel, tags, message, self) => {
  // ...existing code...
  
  if (ttsEnabled) {
    const viewerId = tags['user-id']; // Twitch provides user-id in tags
    ttsManager.speak(username, cleanMessage, viewerId); // Pass viewer ID
  }
});
```

---

### 2. EventSub Channel Point Redemptions

**Location**: New event handler in `src/backend/main.ts`

**Event Type**: `channel.channel_points_custom_reward_redemption.add`

**Handler**:
```typescript
// When EventSub receives a channel point redemption
websocket.on('notification', (event) => {
  if (event.subscription.type === 'channel.channel_points_custom_reward_redemption.add') {
    const { user_id, user_login, reward } = event.event;
    
    // Check if this redeem grants TTS access
    const config = ttsAccessRepo.getConfig();
    
    if (config.limited_redeem_name === reward.title) {
      channelPointGrantsRepo.createGrant(
        user_id,
        'limited_access',
        reward.title,
        config.limited_redeem_duration_mins
      );
      console.log(`[TTS Access] Granted ${config.limited_redeem_duration_mins} mins of Limited Access to ${user_login}`);
    }
    
    if (config.premium_redeem_name === reward.title) {
      channelPointGrantsRepo.createGrant(
        user_id,
        'premium_voice_access',
        reward.title,
        config.premium_redeem_duration_mins
      );
      console.log(`[TTS Access] Granted ${config.premium_redeem_duration_mins} mins of Premium Voice Access to ${user_login}`);
    }
  }
});
```

---

### 3. Subscription Sync

**Location**: `src/backend/core/ipc-handlers/twitch.ts`

**Modify**: Add VIP sync alongside subscription sync

```typescript
// Existing handler
ipcRegistry.register<void, { success: boolean; subCount?: number; vipCount?: number }>(
  'twitch:sync-subscriptions-from-twitch',
  {
    execute: async () => {
      const session = sessionsRepo.getCurrentSession();
      if (!session) {
        throw new Error('No active session');
      }
      
      // Sync subscriptions (existing)
      const subService = new TwitchSubscriptionsService();
      const subResult = await subService.syncSubscriptionsFromTwitch(
        session.channel_id,
        session.user_id
      );
      
      // Sync VIPs (NEW)
      const vipService = new TwitchVIPService();
      const vipResult = await vipService.syncVIPsFromTwitch(
        session.channel_id,
        session.user_id
      );
      
      return {
        success: subResult.success && vipResult.success,
        subCount: subResult.count,
        vipCount: vipResult.count
      };
    }
  }
);
```

---

## 🧪 Testing Strategy

### Unit Tests

1. **TTSAccessControlService**:
   - Test access validation for all modes
   - Test subscription eligibility (with/without gifted)
   - Test VIP eligibility
   - Test redeem eligibility (active/expired)
   - Test voice fallback logic

2. **Repositories**:
   - Test CRUD operations
   - Test unique constraints
   - Test foreign key relationships

### Integration Tests

1. **End-to-End TTS Flow**:
   - Viewer sends chat message
   - Access validated
   - Correct voice selected
   - TTS speaks or is denied

2. **Channel Point Redemption**:
   - Redeem triggered via EventSub
   - Grant created in database
   - Access validated during TTS check
   - Grant expires after duration

### Manual Testing Scenarios

| Scenario | Access Mode | Viewer Status | Expected Result |
|----------|-------------|---------------|-----------------|
| 1 | Access to All | Anyone | TTS speaks with custom or global voice |
| 2 | Limited Access | Non-subscriber | TTS denied (silent) |
| 3 | Limited Access | Subscriber (not gifted) | TTS speaks |
| 4 | Limited Access | Subscriber (gifted), deny_gifted=true | TTS denied |
| 5 | Limited Access | VIP, allow_vip=true | TTS speaks |
| 6 | Premium Voice Access | Non-subscriber, has Azure voice | TTS speaks with global (WebSpeech) voice |
| 7 | Premium Voice Access | Subscriber, has Azure voice | TTS speaks with Azure voice |
| 8 | Premium Voice Access | VIP, has Google voice | TTS speaks with Google voice |
| 9 | Any Mode | Active channel point grant | TTS speaks (grant overrides restrictions) |
| 10 | Any Mode | Expired channel point grant | Grant rules not applied |

---

## 📋 Implementation Checklist

### Phase 1: Database Foundation ✅
- [ ] Create database migration for new tables
- [ ] Create `TTSAccessRepository`
- [ ] Create `ViewerRulesRepository`
- [ ] Create `ViewerRolesRepository`
- [ ] Create `ChannelPointGrantsRepository`
- [ ] Migrate existing `viewers.tts_voice_id` data to `viewer_voice_preferences`
- [ ] Test all repository CRUD operations

### Phase 2: Backend Services ✅
- [ ] Implement `TTSAccessControlService`
- [ ] Implement `TwitchVIPService`
- [ ] Add VIP sync to subscription sync handler
- [ ] Modify `TTSManager.speak()` to accept `viewerId`
- [ ] Integrate access validation into TTS flow
- [ ] Test all service methods

### Phase 3: IPC Handlers ✅
- [ ] Create `tts-access.ts` handler file
- [ ] Implement all 7 IPC handlers
- [ ] Register handlers in `src/backend/core/ipc-handlers/index.ts`
- [ ] Test handlers via IPC

### Phase 4: Frontend - TTS Access Tab ✅
- [ ] Create `TTSAccessTab.tsx`
- [ ] Implement mode selector with conditional rendering
- [ ] Implement validation (prevent premium mode with Azure/Google global)
- [ ] Add save/cancel functionality
- [ ] Test UI state management

### Phase 5: Frontend - Viewer Rules Tab ✅
- [ ] Create `ViewerRulesTab.tsx`
- [ ] Implement viewer search/autocomplete
- [ ] Mirror voice selection UI from `VoiceSettingsTab`
- [ ] Implement create/edit/delete rule functionality
- [ ] Add pitch/speed sliders
- [ ] Show validation warnings
- [ ] Test CRUD operations

### Phase 6: Integration ✅
- [ ] Modify IRC message handler to pass `viewerId`
- [ ] Add channel point redemption handler
- [ ] Add background job to cleanup expired grants
- [ ] Test end-to-end flow (chat → validation → TTS)

### Phase 7: Documentation & Polish ✅
- [ ] Update README.md with new features
- [ ] Add inline code documentation
- [ ] Create user guide for TTS Access & Viewer Rules
- [ ] Add tooltips/help text in UI

---

## 🔮 Future Enhancements (Not in MVP)

### 1. Chat Command System
```
Viewer: !voice set en-US-female-1
Bot: @Viewer, your TTS voice has been set to English (US) Female 1
```

**Implementation**:
- Monitor IRC messages for `!voice` commands
- Parse voice selection
- Validate access (if Premium Voice Access enabled)
- Save to `viewer_voice_preferences`

### 2. Twitch Bot Integration
```
Viewer: !tts settings
Bot: @Viewer, you have Premium Voice Access enabled. Your voice: Azure EN-US Jenny
```

**Implementation**:
- Separate bot service
- Respond to `!tts` commands
- Query `viewer_voice_preferences` and `tts_access_config`

### 3. In-App Currency
- Add `viewer_currency` table
- Extend access rules to check currency balance
- Deduct currency when TTS is used

### 4. Time-Based Access Tracking
- Track how many minutes of TTS access a viewer has used
- Enforce limits (e.g., 10 mins per day for non-subscribers)

---

## 🎓 Key Design Decisions

### Decision 1: Why Separate `viewer_voice_preferences` Table?
**Rationale**: 
- Keeps viewer data clean (only identity info)
- Allows multiple voice preferences in future (e.g., language-specific)
- Easier to query and index
- Cleaner migration path

### Decision 2: Why Single `tts_access_config` Row?
**Rationale**:
- Only one access mode active at a time
- Simpler to query (no need to filter)
- Enforced by `CHECK (id = 1)` constraint
- Matches existing `tts_settings` pattern

### Decision 3: Why Not Merge Limited Access & Premium Voice Access?
**Rationale**:
- User requirement: mutually exclusive modes
- Different use cases (block entirely vs. restrict voices)
- Clearer UI/UX (dropdown instead of complex checkboxes)
- Easier validation logic

### Decision 4: Why Track VIPs in Database?
**Rationale**:
- API rate limiting (can't query Twitch on every message)
- Offline access validation
- Historical tracking (who was VIP when)
- Consistent with subscription tracking pattern

### Decision 5: Why Silent TTS Denial?
**Rationale**:
- User requirement: "TTS just won't use that voice"
- Avoid spamming chat with denial messages
- Fallback to global voice is seamless
- Logging provides admin visibility

---

## ❓ Open Questions for User

1. **VIP Sync Frequency**: Should VIP status sync:
   - On app start only?
   - Every X minutes automatically?
   - Manual button in UI?
   - **Recommendation**: App start + manual button (same as subscriptions)

2. **Channel Point Redeem Detection**: 
   - Should the app auto-detect redeems by name, or require EventSub toggle?
   - **Recommendation**: Require `channel.channel_points_custom_reward_redemption.add` to be enabled in Event Subscriptions screen

3. **Expired Grants Cleanup**:
   - Run cleanup on app start?
   - Background interval (every 5 mins)?
   - **Recommendation**: Both (startup + 5 min interval)

4. **Voice Validation Warning Text**:
   - What exact message to show when viewer sets premium voice but lacks access?
   - **Recommendation**: "⚠️ This voice requires Premium Voice Access. If the viewer doesn't have access, the global default voice will be used instead."

5. **Migration of Existing Data**:
   - You have existing viewers with `tts_voice_id` set. Should we:
     - Migrate all to `viewer_voice_preferences` automatically?
     - Only migrate when viewer next uses TTS?
   - **Recommendation**: Migrate all automatically during database migration

---

## 🚀 Summary

This architecture provides:

✅ **Modular Design**: Single `TTSAccessControlService` handles all validation  
✅ **Future-Proof**: Extensible for commands, bot, currency  
✅ **Non-Breaking**: Uses existing IPC framework and patterns  
✅ **Database-First**: Leverages SQLite with proper indexes  
✅ **Cost Control**: Granular premium voice access management  
✅ **User-Friendly**: Two clear tabs for configuration  
✅ **Testable**: Clear boundaries between services and repositories  

**Next Steps**: Review this architecture, answer open questions, and I'll begin implementation! 🎉
