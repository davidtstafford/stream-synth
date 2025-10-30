# Enhanced Viewer TTS Rules Feature

**Status:** ✅ **IMPLEMENTED** (October 30, 2025)  
**Priority:** High  
**Estimated Effort:** 6-10 hours (Actual: ~4 hours)  
**Dependencies:** Chat Commands System (uses same database schema)  
**Risk:** Low  

**Implementation Summary:** See `PHASE-4-IMPLEMENTATION-SUMMARY.md`

---

## Overview

Enhance the existing Viewer Rules TTS tab to add UI controls for **Mute Viewer** and **Cooldown Viewer** settings. This provides a graphical interface for managing per-viewer TTS restrictions that moderators can also control via chat commands.

**Current State**: Viewer Rules TTS tab exists but lacks mute/cooldown UI  
**Desired State**: Complete UI for managing viewer-specific TTS restrictions with sliders and visual feedback

### Key Benefits

- ✅ Visual management of viewer TTS restrictions
- ✅ Integrates with chat command system (~mutevoice, ~cooldownvoice)
- ✅ Time-based temporary restrictions with auto-expiry
- ✅ Clear visual feedback on active restrictions
- ✅ Easy-to-use sliders for time configuration

---

## UI Design

### Layout

The Viewer Rules screen will have **two new sections** in the TTS Rules tab:

```
┌─────────────────────────────────────────────┐
│ TTS Rules for @Username                     │
├─────────────────────────────────────────────┤
│                                             │
│ [✓] Mute Viewer                            │
│                                             │
│     Mute Period (Minutes):                  │
│     0 ─────────●─────── 1440               │
│     Current: 30 minutes                     │
│     (0 = Permanent mute)                    │
│                                             │
│     Status: 🔇 Muted for 27 mins remaining │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ [✓] Cooldown Viewer                        │
│                                             │
│     Cooldown Gap (Seconds):                 │
│     1 ────────●────────── 120              │
│     Current: 30 seconds                     │
│                                             │
│     Cooldown Period (Minutes):              │
│     0 ─────────●─────── 1440               │
│     Current: 60 minutes                     │
│     (0 = Permanent cooldown)                │
│                                             │
│     Status: ⏱️ Active - 45 mins remaining  │
│                                             │
└─────────────────────────────────────────────┘

        [💾 Save Rules]  [🗑️ Clear All Rules]
```

---

## Database Schema

### `viewer_tts_rules` Table

```sql
CREATE TABLE viewer_tts_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id TEXT UNIQUE NOT NULL,
  
  -- Mute Settings
  is_muted INTEGER DEFAULT 0,
  mute_period_mins INTEGER,              -- NULL = permanent
  muted_at DATETIME,
  mute_expires_at DATETIME,
  
  -- Cooldown Settings
  has_cooldown INTEGER DEFAULT 0,
  cooldown_gap_seconds INTEGER,
  cooldown_period_mins INTEGER,          -- NULL = permanent
  cooldown_set_at DATETIME,
  cooldown_expires_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
);
```

**Indexes:**
```sql
CREATE INDEX idx_viewer_tts_rules_viewer ON viewer_tts_rules(viewer_id);
CREATE INDEX idx_viewer_tts_rules_muted ON viewer_tts_rules(is_muted);
CREATE INDEX idx_viewer_tts_rules_cooldown ON viewer_tts_rules(has_cooldown);
CREATE INDEX idx_viewer_tts_rules_mute_expires ON viewer_tts_rules(mute_expires_at);
CREATE INDEX idx_viewer_tts_rules_cooldown_expires ON viewer_tts_rules(cooldown_expires_at);
```

---

## Backend Implementation

### 1. Viewer TTS Rules Repository

**File:** `src/backend/database/repositories/viewer-tts-rules.ts`

```typescript
import { BaseRepository } from '../base-repository';

export interface ViewerTTSRules {
  id: number;
  viewer_id: string;
  
  // Mute
  is_muted: boolean;
  mute_period_mins?: number;
  muted_at?: string;
  mute_expires_at?: string;
  
  // Cooldown
  has_cooldown: boolean;
  cooldown_gap_seconds?: number;
  cooldown_period_mins?: number;
  cooldown_set_at?: string;
  cooldown_expires_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface MuteConfig {
  mute_period_mins?: number | null; // null = permanent
}

export interface CooldownConfig {
  cooldown_gap_seconds: number;
  cooldown_period_mins?: number | null; // null = permanent
}

export class ViewerTTSRulesRepository extends BaseRepository {
  /**
   * Get rules for viewer
   */
  getByViewerId(viewerId: string): ViewerTTSRules | null {
    try {
      const db = this.getDatabase();
      const rules = db.prepare(`
        SELECT * FROM viewer_tts_rules WHERE viewer_id = ?
      `).get(viewerId) as ViewerTTSRules | undefined;

      return rules || null;
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error getting rules:', error);
      return null;
    }
  }

  /**
   * Set mute for viewer
   */
  setMute(
    viewerId: string,
    config: MuteConfig
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      const now = new Date();
      let expiresAt: Date | null = null;

      if (config.mute_period_mins !== null && config.mute_period_mins !== undefined) {
        expiresAt = new Date(now.getTime() + config.mute_period_mins * 60000);
      }

      // Upsert
      db.prepare(`
        INSERT INTO viewer_tts_rules (
          viewer_id, is_muted, mute_period_mins, muted_at, mute_expires_at
        ) VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          is_muted = 1,
          mute_period_mins = excluded.mute_period_mins,
          muted_at = excluded.muted_at,
          mute_expires_at = excluded.mute_expires_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        viewerId,
        config.mute_period_mins || null,
        now.toISOString(),
        expiresAt?.toISOString() || null
      );

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error setting mute:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove mute from viewer
   */
  removeMute(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        UPDATE viewer_tts_rules
        SET is_muted = 0,
            mute_period_mins = NULL,
            muted_at = NULL,
            mute_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE viewer_id = ?
      `).run(viewerId);

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error removing mute:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set cooldown for viewer
   */
  setCooldown(
    viewerId: string,
    config: CooldownConfig
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      const now = new Date();
      let expiresAt: Date | null = null;

      if (config.cooldown_period_mins !== null && config.cooldown_period_mins !== undefined) {
        expiresAt = new Date(now.getTime() + config.cooldown_period_mins * 60000);
      }

      // Upsert
      db.prepare(`
        INSERT INTO viewer_tts_rules (
          viewer_id, has_cooldown, cooldown_gap_seconds, cooldown_period_mins, 
          cooldown_set_at, cooldown_expires_at
        ) VALUES (?, 1, ?, ?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          has_cooldown = 1,
          cooldown_gap_seconds = excluded.cooldown_gap_seconds,
          cooldown_period_mins = excluded.cooldown_period_mins,
          cooldown_set_at = excluded.cooldown_set_at,
          cooldown_expires_at = excluded.cooldown_expires_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        viewerId,
        config.cooldown_gap_seconds,
        config.cooldown_period_mins || null,
        now.toISOString(),
        expiresAt?.toISOString() || null
      );

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error setting cooldown:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove cooldown from viewer
   */
  removeCooldown(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        UPDATE viewer_tts_rules
        SET has_cooldown = 0,
            cooldown_gap_seconds = NULL,
            cooldown_period_mins = NULL,
            cooldown_set_at = NULL,
            cooldown_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE viewer_id = ?
      `).run(viewerId);

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error removing cooldown:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if viewer is currently muted
   */
  isViewerMuted(viewerId: string): boolean {
    const rules = this.getByViewerId(viewerId);
    if (!rules || !rules.is_muted) {
      return false;
    }

    // Check expiry
    if (rules.mute_expires_at) {
      const now = new Date();
      const expiresAt = new Date(rules.mute_expires_at);
      
      if (now >= expiresAt) {
        // Auto-unmute
        this.removeMute(viewerId);
        return false;
      }
    }

    return true;
  }

  /**
   * Get active cooldown for viewer
   */
  getActiveCooldown(viewerId: string): number | null {
    const rules = this.getByViewerId(viewerId);
    if (!rules || !rules.has_cooldown) {
      return null;
    }

    // Check expiry
    if (rules.cooldown_expires_at) {
      const now = new Date();
      const expiresAt = new Date(rules.cooldown_expires_at);
      
      if (now >= expiresAt) {
        // Auto-remove cooldown
        this.removeCooldown(viewerId);
        return null;
      }
    }

    return rules.cooldown_gap_seconds || null;
  }

  /**
   * Clear all rules for viewer
   */
  clearAllRules(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      db.prepare(`DELETE FROM viewer_tts_rules WHERE viewer_id = ?`).run(viewerId);
      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error clearing rules:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired rules (background job)
   */
  cleanupExpired(): { success: boolean; removed?: number; error?: string } {
    try {
      const db = this.getDatabase();
      const now = new Date().toISOString();

      // Remove expired mutes
      db.prepare(`
        UPDATE viewer_tts_rules
        SET is_muted = 0,
            mute_period_mins = NULL,
            muted_at = NULL,
            mute_expires_at = NULL
        WHERE is_muted = 1 
          AND mute_expires_at IS NOT NULL 
          AND mute_expires_at <= ?
      `).run(now);

      // Remove expired cooldowns
      const result = db.prepare(`
        UPDATE viewer_tts_rules
        SET has_cooldown = 0,
            cooldown_gap_seconds = NULL,
            cooldown_period_mins = NULL,
            cooldown_set_at = NULL,
            cooldown_expires_at = NULL
        WHERE has_cooldown = 1 
          AND cooldown_expires_at IS NOT NULL 
          AND cooldown_expires_at <= ?
      `).run(now);

      return { 
        success: true, 
        removed: (result.changes || 0)
      };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error cleaning up:', error);
      return { success: false, error: error.message };
    }
  }
}
```

---

## Frontend Implementation

### Enhanced Viewer Rules Screen

**File:** `src/frontend/screens/viewers/tabs/ViewerRulesTTSTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import './viewer-rules-tts-tab.css';

const { ipcRenderer } = window.require('electron');

interface ViewerTTSRules {
  is_muted: boolean;
  mute_period_mins?: number;
  muted_at?: string;
  mute_expires_at?: string;
  
  has_cooldown: boolean;
  cooldown_gap_seconds?: number;
  cooldown_period_mins?: number;
  cooldown_set_at?: string;
  cooldown_expires_at?: string;
}

interface Props {
  viewerId: string;
  viewerUsername: string;
}

export const ViewerRulesTTSTab: React.FC<Props> = ({ viewerId, viewerUsername }) => {
  const [rules, setRules] = useState<ViewerTTSRules | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mute state
  const [muteEnabled, setMuteEnabled] = useState(false);
  const [mutePeriodMins, setMutePeriodMins] = useState(30);

  // Cooldown state
  const [cooldownEnabled, setCooldownEnabled] = useState(false);
  const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
  const [cooldownPeriodMins, setCooldownPeriodMins] = useState(60);

  useEffect(() => {
    loadRules();
  }, [viewerId]);

  useEffect(() => {
    if (rules) {
      setMuteEnabled(rules.is_muted);
      setMutePeriodMins(rules.mute_period_mins || 0);
      
      setCooldownEnabled(rules.has_cooldown);
      setCooldownGapSeconds(rules.cooldown_gap_seconds || 30);
      setCooldownPeriodMins(rules.cooldown_period_mins || 0);
    }
  }, [rules]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:get', viewerId);
      if (response.success) {
        setRules(response.rules);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save mute
      if (muteEnabled) {
        const muteResponse = await ipcRenderer.invoke('viewer-tts-rules:set-mute', viewerId, {
          mute_period_mins: mutePeriodMins === 0 ? null : mutePeriodMins
        });

        if (!muteResponse.success) {
          throw new Error(muteResponse.error || 'Failed to set mute');
        }
      } else {
        await ipcRenderer.invoke('viewer-tts-rules:remove-mute', viewerId);
      }

      // Save cooldown
      if (cooldownEnabled) {
        const cooldownResponse = await ipcRenderer.invoke('viewer-tts-rules:set-cooldown', viewerId, {
          cooldown_gap_seconds: cooldownGapSeconds,
          cooldown_period_mins: cooldownPeriodMins === 0 ? null : cooldownPeriodMins
        });

        if (!cooldownResponse.success) {
          throw new Error(cooldownResponse.error || 'Failed to set cooldown');
        }
      } else {
        await ipcRenderer.invoke('viewer-tts-rules:remove-cooldown', viewerId);
      }

      setSuccess('TTS rules saved!');
      setTimeout(() => setSuccess(null), 3000);
      loadRules();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAllRules = async () => {
    if (!confirm(`Clear all TTS rules for @${viewerUsername}?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:clear', viewerId);
      
      if (response.success) {
        setSuccess('All rules cleared!');
        setTimeout(() => setSuccess(null), 3000);
        loadRules();
      } else {
        setError(response.error || 'Failed to clear rules');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return 'Never expires';

    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMins}m remaining`;
    } else {
      return `${mins}m remaining`;
    }
  };

  const formatMutePeriod = (mins: number): string => {
    if (mins === 0) return 'Permanent';
    if (mins < 60) return `${mins} minutes`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hour(s)`;
  };

  return (
    <div className="viewer-rules-tts-tab">
      <h2>TTS Rules for @{viewerUsername}</h2>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Mute Section */}
      <div className="rules-section">
        <div className="section-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={muteEnabled}
              onChange={(e) => setMuteEnabled(e.target.checked)}
              disabled={loading}
            />
            <span className="section-title">🔇 Mute Viewer</span>
          </label>
        </div>

        {muteEnabled && (
          <div className="section-content">
            <div className="slider-group">
              <label>Mute Period (Minutes): {formatMutePeriod(mutePeriodMins)}</label>
              <input
                type="range"
                min="0"
                max="1440"
                step="5"
                value={mutePeriodMins}
                onChange={(e) => setMutePeriodMins(parseInt(e.target.value))}
                disabled={loading}
              />
              <div className="slider-labels">
                <span>0 (Permanent)</span>
                <span>1 hour</span>
                <span>6 hours</span>
                <span>12 hours</span>
                <span>24 hours</span>
              </div>
            </div>

            {rules?.is_muted && (
              <div className="status-box status-muted">
                🔇 Muted - {formatTimeRemaining(rules.mute_expires_at)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cooldown Section */}
      <div className="rules-section">
        <div className="section-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={cooldownEnabled}
              onChange={(e) => setCooldownEnabled(e.target.checked)}
              disabled={loading}
            />
            <span className="section-title">⏱️ Cooldown Viewer</span>
          </label>
        </div>

        {cooldownEnabled && (
          <div className="section-content">
            <div className="slider-group">
              <label>Cooldown Gap (Seconds): {cooldownGapSeconds}s</label>
              <input
                type="range"
                min="1"
                max="120"
                step="1"
                value={cooldownGapSeconds}
                onChange={(e) => setCooldownGapSeconds(parseInt(e.target.value))}
                disabled={loading}
              />
              <div className="slider-labels">
                <span>1s</span>
                <span>30s</span>
                <span>60s</span>
                <span>120s</span>
              </div>
            </div>

            <div className="slider-group">
              <label>Cooldown Period (Minutes): {formatMutePeriod(cooldownPeriodMins)}</label>
              <input
                type="range"
                min="0"
                max="1440"
                step="5"
                value={cooldownPeriodMins}
                onChange={(e) => setCooldownPeriodMins(parseInt(e.target.value))}
                disabled={loading}
              />
              <div className="slider-labels">
                <span>0 (Permanent)</span>
                <span>1 hour</span>
                <span>6 hours</span>
                <span>12 hours</span>
                <span>24 hours</span>
              </div>
            </div>

            {rules?.has_cooldown && (
              <div className="status-box status-cooldown">
                ⏱️ Active - {cooldownGapSeconds}s gap - {formatTimeRemaining(rules.cooldown_expires_at)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="actions">
        <button
          className="btn-primary"
          onClick={saveRules}
          disabled={loading}
        >
          💾 Save Rules
        </button>

        <button
          className="btn-danger"
          onClick={clearAllRules}
          disabled={loading}
        >
          🗑️ Clear All Rules
        </button>
      </div>
    </div>
  );
};
```

---

## IPC Handlers

**File:** `src/backend/core/ipc-handlers/viewer-tts-rules.ts`

```typescript
import { ipcMain } from 'electron';
import { ViewerTTSRulesRepository } from '../../database/repositories/viewer-tts-rules';

export function registerViewerTTSRulesHandlers() {
  const repo = new ViewerTTSRulesRepository();

  // Get rules for viewer
  ipcMain.handle('viewer-tts-rules:get', async (_, viewerId: string) => {
    const rules = repo.getByViewerId(viewerId);
    return { success: true, rules };
  });

  // Set mute
  ipcMain.handle('viewer-tts-rules:set-mute', async (_, viewerId: string, config: any) => {
    return repo.setMute(viewerId, config);
  });

  // Remove mute
  ipcMain.handle('viewer-tts-rules:remove-mute', async (_, viewerId: string) => {
    return repo.removeMute(viewerId);
  });

  // Set cooldown
  ipcMain.handle('viewer-tts-rules:set-cooldown', async (_, viewerId: string, config: any) => {
    return repo.setCooldown(viewerId, config);
  });

  // Remove cooldown
  ipcMain.handle('viewer-tts-rules:remove-cooldown', async (_, viewerId: string) => {
    return repo.removeCooldown(viewerId);
  });

  // Clear all rules
  ipcMain.handle('viewer-tts-rules:clear', async (_, viewerId: string) => {
    return repo.clearAllRules(viewerId);
  });

  console.log('[IPC] Viewer TTS rules handlers registered');
}
```

---

## Database Migration

Add to `src/backend/database/migrations.ts`:

```typescript
// Create viewer_tts_rules table
db.exec(`
  CREATE TABLE IF NOT EXISTS viewer_tts_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_id TEXT UNIQUE NOT NULL,
    
    -- Mute Settings
    is_muted INTEGER DEFAULT 0,
    mute_period_mins INTEGER,
    muted_at DATETIME,
    mute_expires_at DATETIME,
    
    -- Cooldown Settings
    has_cooldown INTEGER DEFAULT 0,
    cooldown_gap_seconds INTEGER,
    cooldown_period_mins INTEGER,
    cooldown_set_at DATETIME,
    cooldown_expires_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_viewer ON viewer_tts_rules(viewer_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_muted ON viewer_tts_rules(is_muted)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_cooldown ON viewer_tts_rules(has_cooldown)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_mute_expires ON viewer_tts_rules(mute_expires_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_cooldown_expires ON viewer_tts_rules(cooldown_expires_at)
`);
```

---

## Background Cleanup Job

Add to `src/backend/main.ts`:

```typescript
import { ViewerTTSRulesRepository } from './database/repositories/viewer-tts-rules';

// In main initialization
const ttsRulesRepo = new ViewerTTSRulesRepository();

// Run cleanup every 5 minutes
setInterval(() => {
  const result = ttsRulesRepo.cleanupExpired();
  if (result.success && result.removed && result.removed > 0) {
    console.log(`[TTS Rules] Cleaned up ${result.removed} expired rules`);
  }
}, 5 * 60 * 1000);
```

---

## Integration with TTS Manager

**Update:** `src/backend/services/tts/manager.ts`

```typescript
import { ViewerTTSRulesRepository } from '../../database/repositories/viewer-tts-rules';

export class TTSManager {
  private ttsRulesRepo = new ViewerTTSRulesRepository();

  async processMessage(username: string, userId: string, message: string) {
    // Check if viewer is muted
    if (this.ttsRulesRepo.isViewerMuted(userId)) {
      console.log(`[TTS] User ${username} is muted, skipping`);
      return;
    }

    // Check cooldown
    const cooldownSeconds = this.ttsRulesRepo.getActiveCooldown(userId);
    if (cooldownSeconds) {
      // Check last message time and enforce cooldown
      // Implementation depends on existing cooldown tracking
    }

    // ... rest of TTS processing
  }
}
```

---

## Implementation Steps

1. **Add Database Migration** - Create `viewer_tts_rules` table
2. **Create Repository** - `viewer-tts-rules.ts`
3. **Create IPC Handlers** - `viewer-tts-rules.ts`
4. **Update Frontend Tab** - `ViewerRulesTTSTab.tsx`
5. **Add Background Cleanup** - In `main.ts`
6. **Integrate with TTS Manager** - Check rules before processing
7. **Testing** - Test mute/cooldown UI and auto-expiry

---

## Testing Checklist

- [ ] Mute checkbox enables/disables mute section
- [ ] Mute period slider works (0-1440 mins)
- [ ] Permanent mute (0 mins) works
- [ ] Temporary mute expires correctly
- [ ] Cooldown checkbox enables/disables cooldown section
- [ ] Cooldown gap slider works (1-120 seconds)
- [ ] Cooldown period slider works (0-1440 mins)
- [ ] Permanent cooldown (0 mins) works
- [ ] Temporary cooldown expires correctly
- [ ] Clear all rules button works
- [ ] Status displays show correct time remaining
- [ ] Background cleanup removes expired rules
- [ ] Integration with chat commands (~mutevoice, etc.)
- [ ] TTS manager respects mute/cooldown rules

---

## Summary

| Aspect | Details |
|--------|---------|
| **Files Created** | 1 repository + 1 IPC handler |
| **Files Modified** | 1 frontend tab + 1 TTS manager |
| **Database Tables** | 1 table |
| **UI Components** | 2 sections (Mute + Cooldown) |
| **Sliders** | 3 total (mute period, cooldown gap, cooldown period) |
| **Estimated Time** | 6-10 hours |
| **Dependencies** | Chat Commands System |
| **Risk Level** | Low |

---

**Status:** 📋 Documentation Complete  
**Next Step:** Implementation after Chat Commands System  
**Priority:** High  
**Note:** Integrates seamlessly with chat commands feature

---

**Last Updated:** October 2025  
**Author:** AI Code Analysis  
**Version:** 1.0
