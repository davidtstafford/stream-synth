# Discord Webhooks Feature

**Status:** 📋 **FUTURE FEATURE - DOCUMENTATION**  
**Priority:** Medium  
**Estimated Effort:** 6-10 hours  
**Dependencies:** Discord webhook URLs, existing UI framework  
**Risk:** Low  

---

## Overview

Replace the current poorly-implemented Discord screen with a clean, dedicated Discord Webhooks management interface. This feature allows users to create, configure, and test Discord webhooks with custom messages that can be triggered manually at any time.

**Current State**: Discord screen exists but is poorly implemented  
**Desired State**: Clean webhook management UI with create/edit/test/send functionality

### Key Benefits

- ✅ Simple webhook management - no complex Discord bot setup required
- ✅ Multiple webhook configurations for different purposes
- ✅ Test messages before sending to live channels
- ✅ One-click send for quick notifications
- ✅ Template support for common message patterns
- ✅ Message history tracking

---

## Use Cases

### Scenario 1: Stream Starting Notification
User creates webhook named "Stream Start" that posts "🔴 LIVE NOW! Come watch at https://twitch.tv/username" to their Discord community server.

### Scenario 2: Milestone Announcements
User creates webhook named "Follower Milestone" with template "🎉 Just hit {{count}} followers! Thank you all!" that they can quickly send when hitting milestones.

### Scenario 3: Schedule Updates
User creates webhook named "Schedule Change" to notify Discord when stream schedule changes.

### Scenario 4: Clip Sharing
User creates webhook named "Highlight Clip" with message "Check out this clip! {{clip_url}}" to share notable moments.

---

## Architecture Overview

### Database Schema

#### `discord_webhooks` Table

```sql
CREATE TABLE discord_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  message_template TEXT NOT NULL,
  username TEXT,                    -- Optional custom bot username
  avatar_url TEXT,                  -- Optional custom bot avatar
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_sent_at DATETIME,
  send_count INTEGER DEFAULT 0
);
```

**Indexes:**
```sql
CREATE INDEX idx_discord_webhooks_enabled ON discord_webhooks(enabled);
CREATE INDEX idx_discord_webhooks_name ON discord_webhooks(name);
```

#### `discord_webhook_history` Table

```sql
CREATE TABLE discord_webhook_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  message_sent TEXT NOT NULL,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (webhook_id) REFERENCES discord_webhooks(id) ON DELETE CASCADE
);
```

**Indexes:**
```sql
CREATE INDEX idx_webhook_history_webhook ON discord_webhook_history(webhook_id);
CREATE INDEX idx_webhook_history_sent ON discord_webhook_history(sent_at);
```

---

## Backend Implementation

### 1. Discord Webhooks Repository

**File:** `src/backend/database/repositories/discord-webhooks.ts`

```typescript
import { BaseRepository } from '../base-repository';

export interface DiscordWebhook {
  id: number;
  name: string;
  webhook_url: string;
  message_template: string;
  username?: string;
  avatar_url?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_sent_at?: string;
  send_count: number;
}

export interface DiscordWebhookInput {
  name: string;
  webhook_url: string;
  message_template: string;
  username?: string;
  avatar_url?: string;
  enabled?: boolean;
}

export interface DiscordWebhookHistory {
  id: number;
  webhook_id: number;
  message_sent: string;
  success: boolean;
  error_message?: string;
  sent_at: string;
}

export class DiscordWebhooksRepository extends BaseRepository {
  /**
   * Get all webhooks
   */
  getAll(): { success: boolean; webhooks?: DiscordWebhook[]; error?: string } {
    try {
      const db = this.getDatabase();
      const webhooks = db.prepare(`
        SELECT * FROM discord_webhooks
        ORDER BY name ASC
      `).all() as DiscordWebhook[];

      return { success: true, webhooks };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error getting webhooks:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get webhook by ID
   */
  getById(id: number): { success: boolean; webhook?: DiscordWebhook; error?: string } {
    try {
      const db = this.getDatabase();
      const webhook = db.prepare(`
        SELECT * FROM discord_webhooks WHERE id = ?
      `).get(id) as DiscordWebhook | undefined;

      if (!webhook) {
        return { success: false, error: 'Webhook not found' };
      }

      return { success: true, webhook };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error getting webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create webhook
   */
  create(input: DiscordWebhookInput): { success: boolean; id?: number; error?: string } {
    try {
      const db = this.getDatabase();
      const result = db.prepare(`
        INSERT INTO discord_webhooks (
          name, webhook_url, message_template, username, avatar_url, enabled
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        input.name,
        input.webhook_url,
        input.message_template,
        input.username || null,
        input.avatar_url || null,
        input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1
      );

      return {
        success: true,
        id: result.lastInsertRowid as number
      };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error creating webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update webhook
   */
  update(id: number, input: Partial<DiscordWebhookInput>): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      const fields: string[] = [];
      const values: any[] = [];

      if (input.name !== undefined) {
        fields.push('name = ?');
        values.push(input.name);
      }
      if (input.webhook_url !== undefined) {
        fields.push('webhook_url = ?');
        values.push(input.webhook_url);
      }
      if (input.message_template !== undefined) {
        fields.push('message_template = ?');
        values.push(input.message_template);
      }
      if (input.username !== undefined) {
        fields.push('username = ?');
        values.push(input.username || null);
      }
      if (input.avatar_url !== undefined) {
        fields.push('avatar_url = ?');
        values.push(input.avatar_url || null);
      }
      if (input.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(input.enabled ? 1 : 0);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      db.prepare(`
        UPDATE discord_webhooks
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error updating webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete webhook
   */
  delete(id: number): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      db.prepare('DELETE FROM discord_webhooks WHERE id = ?').run(id);
      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error deleting webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record webhook send
   */
  recordSend(webhookId: number): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      db.prepare(`
        UPDATE discord_webhooks
        SET last_sent_at = CURRENT_TIMESTAMP,
            send_count = send_count + 1
        WHERE id = ?
      `).run(webhookId);

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error recording send:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add to history
   */
  addHistory(
    webhookId: number,
    messageSent: string,
    success: boolean,
    errorMessage?: string
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      db.prepare(`
        INSERT INTO discord_webhook_history (
          webhook_id, message_sent, success, error_message
        ) VALUES (?, ?, ?, ?)
      `).run(webhookId, messageSent, success ? 1 : 0, errorMessage || null);

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error adding history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get webhook history
   */
  getHistory(
    webhookId: number,
    limit: number = 50
  ): { success: boolean; history?: DiscordWebhookHistory[]; error?: string } {
    try {
      const db = this.getDatabase();
      const history = db.prepare(`
        SELECT * FROM discord_webhook_history
        WHERE webhook_id = ?
        ORDER BY sent_at DESC
        LIMIT ?
      `).all(webhookId, limit) as DiscordWebhookHistory[];

      return { success: true, history };
    } catch (error: any) {
      console.error('[DiscordWebhooksRepo] Error getting history:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 2. Discord Webhook Service

**File:** `src/backend/services/discord-webhook-sender.ts`

```typescript
import { DiscordWebhooksRepository, DiscordWebhook } from '../database/repositories/discord-webhooks';

export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    footer?: {
      text: string;
    };
    timestamp?: string;
  }>;
}

export class DiscordWebhookSender {
  private webhooksRepo = new DiscordWebhooksRepository();

  /**
   * Send webhook message
   */
  async send(
    webhookId: number,
    variables?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get webhook config
      const webhookResult = this.webhooksRepo.getById(webhookId);
      if (!webhookResult.success || !webhookResult.webhook) {
        return { success: false, error: 'Webhook not found' };
      }

      const webhook = webhookResult.webhook;

      if (!webhook.enabled) {
        return { success: false, error: 'Webhook is disabled' };
      }

      // Process template with variables
      const message = this.processTemplate(webhook.message_template, variables);

      // Build Discord payload
      const payload: DiscordWebhookPayload = {
        content: message
      };

      if (webhook.username) {
        payload.username = webhook.username;
      }

      if (webhook.avatar_url) {
        payload.avatar_url = webhook.avatar_url;
      }

      // Send to Discord
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      }

      // Record success
      this.webhooksRepo.recordSend(webhookId);
      this.webhooksRepo.addHistory(webhookId, message, true);

      console.log(`[DiscordWebhook] Sent message via webhook ${webhook.name}`);

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhook] Error sending:', error);

      // Record failure
      this.webhooksRepo.addHistory(
        webhookId,
        'Failed to send',
        false,
        error.message
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Test webhook (doesn't record to history)
   */
  async test(
    webhookUrl: string,
    message: string,
    username?: string,
    avatarUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload: DiscordWebhookPayload = {
        content: message + '\n\n_This is a test message from Stream Synth_'
      };

      if (username) {
        payload.username = username;
      }

      if (avatarUrl) {
        payload.avatar_url = avatarUrl;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordWebhook] Test error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process template variables
   */
  private processTemplate(
    template: string,
    variables?: Record<string, string>
  ): string {
    if (!variables) {
      return template;
    }

    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  /**
   * Get available template variables
   */
  getAvailableVariables(): Array<{ key: string; description: string; example: string }> {
    return [
      {
        key: 'count',
        description: 'Numeric count (followers, subs, etc.)',
        example: '{{count}}'
      },
      {
        key: 'username',
        description: 'Twitch username',
        example: '{{username}}'
      },
      {
        key: 'clip_url',
        description: 'Twitch clip URL',
        example: '{{clip_url}}'
      },
      {
        key: 'title',
        description: 'Stream title',
        example: '{{title}}'
      },
      {
        key: 'game',
        description: 'Game/category name',
        example: '{{game}}'
      },
      {
        key: 'timestamp',
        description: 'Current timestamp',
        example: '{{timestamp}}'
      }
    ];
  }
}
```

### 3. IPC Handlers

**File:** `src/backend/core/ipc-handlers/discord-webhooks.ts`

```typescript
import { ipcMain } from 'electron';
import { DiscordWebhooksRepository, DiscordWebhookInput } from '../../database/repositories/discord-webhooks';
import { DiscordWebhookSender } from '../../services/discord-webhook-sender';

export function registerDiscordWebhookHandlers() {
  const repo = new DiscordWebhooksRepository();
  const sender = new DiscordWebhookSender();

  // Get all webhooks
  ipcMain.handle('discord-webhooks:get-all', async () => {
    return repo.getAll();
  });

  // Get webhook by ID
  ipcMain.handle('discord-webhooks:get-by-id', async (_, id: number) => {
    return repo.getById(id);
  });

  // Create webhook
  ipcMain.handle('discord-webhooks:create', async (_, input: DiscordWebhookInput) => {
    return repo.create(input);
  });

  // Update webhook
  ipcMain.handle('discord-webhooks:update', async (_, id: number, input: Partial<DiscordWebhookInput>) => {
    return repo.update(id, input);
  });

  // Delete webhook
  ipcMain.handle('discord-webhooks:delete', async (_, id: number) => {
    return repo.delete(id);
  });

  // Send webhook
  ipcMain.handle('discord-webhooks:send', async (_, webhookId: number, variables?: Record<string, string>) => {
    return sender.send(webhookId, variables);
  });

  // Test webhook
  ipcMain.handle('discord-webhooks:test', async (_, webhookUrl: string, message: string, username?: string, avatarUrl?: string) => {
    return sender.test(webhookUrl, message, username, avatarUrl);
  });

  // Get history
  ipcMain.handle('discord-webhooks:get-history', async (_, webhookId: number, limit?: number) => {
    return repo.getHistory(webhookId, limit);
  });

  // Get available variables
  ipcMain.handle('discord-webhooks:get-variables', async () => {
    return { success: true, variables: sender.getAvailableVariables() };
  });

  console.log('[IPC] Discord webhook handlers registered');
}
```

---

## Frontend Implementation

### 1. Discord Webhooks Screen

**File:** `src/frontend/screens/discord-webhooks/discord-webhooks.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import './discord-webhooks.css';

const { ipcRenderer } = window.require('electron');

interface DiscordWebhook {
  id: number;
  name: string;
  webhook_url: string;
  message_template: string;
  username?: string;
  avatar_url?: string;
  enabled: boolean;
  last_sent_at?: string;
  send_count: number;
}

export const DiscordWebhooksScreen: React.FC = () => {
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<DiscordWebhook | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);

  // Variables for sending
  const [sendVariables, setSendVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const response = await ipcRenderer.invoke('discord-webhooks:get-all');
      if (response.success) {
        setWebhooks(response.webhooks);
      } else {
        setError(response.error || 'Failed to load webhooks');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (webhook?: DiscordWebhook) => {
    if (webhook) {
      setFormName(webhook.name);
      setFormWebhookUrl(webhook.webhook_url);
      setFormMessage(webhook.message_template);
      setFormUsername(webhook.username || '');
      setFormAvatarUrl(webhook.avatar_url || '');
      setFormEnabled(webhook.enabled);
      setSelectedWebhook(webhook);
    } else {
      setFormName('');
      setFormWebhookUrl('');
      setFormMessage('');
      setFormUsername('');
      setFormAvatarUrl('');
      setFormEnabled(true);
      setSelectedWebhook(null);
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedWebhook(null);
  };

  const saveWebhook = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const input = {
        name: formName,
        webhook_url: formWebhookUrl,
        message_template: formMessage,
        username: formUsername || undefined,
        avatar_url: formAvatarUrl || undefined,
        enabled: formEnabled
      };

      const response = selectedWebhook
        ? await ipcRenderer.invoke('discord-webhooks:update', selectedWebhook.id, input)
        : await ipcRenderer.invoke('discord-webhooks:create', input);

      if (response.success) {
        setSuccess(selectedWebhook ? 'Webhook updated!' : 'Webhook created!');
        setTimeout(() => setSuccess(null), 3000);
        closeEditor();
        loadWebhooks();
      } else {
        setError(response.error || 'Failed to save webhook');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await ipcRenderer.invoke('discord-webhooks:delete', id);
      if (response.success) {
        setSuccess('Webhook deleted!');
        setTimeout(() => setSuccess(null), 3000);
        loadWebhooks();
      } else {
        setError(response.error || 'Failed to delete webhook');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendWebhook = async (webhook: DiscordWebhook) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke(
        'discord-webhooks:send',
        webhook.id,
        Object.keys(sendVariables).length > 0 ? sendVariables : undefined
      );

      if (response.success) {
        setSuccess(`Message sent via ${webhook.name}!`);
        setTimeout(() => setSuccess(null), 3000);
        loadWebhooks(); // Refresh to update send count
      } else {
        setError(response.error || 'Failed to send webhook');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke(
        'discord-webhooks:test',
        formWebhookUrl,
        formMessage,
        formUsername || undefined,
        formAvatarUrl || undefined
      );

      if (response.success) {
        setSuccess('Test message sent! Check your Discord channel.');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to send test message');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discord-webhooks-screen">
      <div className="screen-header">
        <h1>Discord Webhooks</h1>
        <button
          className="btn-primary"
          onClick={() => openEditor()}
          disabled={loading}
        >
          + Create Webhook
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {loading && <div className="loading-spinner">Loading...</div>}

      {/* Webhooks List */}
      <div className="webhooks-grid">
        {webhooks.map(webhook => (
          <div key={webhook.id} className="webhook-card">
            <div className="webhook-header">
              <h3>{webhook.name}</h3>
              <div className="webhook-status">
                <span className={webhook.enabled ? 'status-enabled' : 'status-disabled'}>
                  {webhook.enabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>

            <div className="webhook-message">
              <p>{webhook.message_template}</p>
            </div>

            <div className="webhook-stats">
              <span>Sent: {webhook.send_count} times</span>
              {webhook.last_sent_at && (
                <span>Last: {new Date(webhook.last_sent_at).toLocaleString()}</span>
              )}
            </div>

            <div className="webhook-actions">
              <button
                className="btn-success"
                onClick={() => sendWebhook(webhook)}
                disabled={!webhook.enabled || loading}
              >
                📤 Send Now
              </button>
              <button
                className="btn-secondary"
                onClick={() => openEditor(webhook)}
                disabled={loading}
              >
                ✏️ Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => deleteWebhook(webhook.id)}
                disabled={loading}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {webhooks.length === 0 && !loading && (
        <div className="empty-state">
          <p>No webhooks configured yet.</p>
          <p>Create your first webhook to start sending messages to Discord!</p>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWebhook ? 'Edit Webhook' : 'Create Webhook'}</h2>
              <button className="btn-close" onClick={closeEditor}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Webhook Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Stream Start, Follower Milestone"
                />
              </div>

              <div className="form-group">
                <label>Discord Webhook URL *</label>
                <input
                  type="text"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                />
                <small>Get this from Discord Server Settings → Integrations → Webhooks</small>
              </div>

              <div className="form-group">
                <label>Message Template *</label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Your message here. Use {{variables}} for dynamic content."
                  rows={4}
                />
                <small>
                  Available variables: {'{'}{'{'}}count{'}'}{'}'}, {'{'}{'{'}}username{'}'}{'}'}, {'{'}{'{'}}clip_url{'}'}{'}'}, etc.
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Custom Username (Optional)</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g., Stream Bot"
                  />
                </div>

                <div className="form-group">
                  <label>Custom Avatar URL (Optional)</label>
                  <input
                    type="text"
                    value={formAvatarUrl}
                    onChange={(e) => setFormAvatarUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={testWebhook}
                disabled={!formWebhookUrl || !formMessage || loading}
              >
                🧪 Send Test
              </button>
              <button
                className="btn-primary"
                onClick={saveWebhook}
                disabled={!formName || !formWebhookUrl || !formMessage || loading}
              >
                💾 Save Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## Configuration

### Migration to Add Tables

Add to `src/backend/database/migrations.ts`:

```typescript
// Create discord_webhooks table
db.exec(`
  CREATE TABLE IF NOT EXISTS discord_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    message_template TEXT NOT NULL,
    username TEXT,
    avatar_url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_sent_at DATETIME,
    send_count INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_discord_webhooks_enabled ON discord_webhooks(enabled)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_discord_webhooks_name ON discord_webhooks(name)
`);

// Create discord_webhook_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS discord_webhook_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    message_sent TEXT NOT NULL,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (webhook_id) REFERENCES discord_webhooks(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_webhook_history_webhook ON discord_webhook_history(webhook_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_webhook_history_sent ON discord_webhook_history(sent_at)
`);
```

---

## Implementation Steps

1. **Remove Old Discord Screen** - Delete poorly implemented code
2. **Add Database Migration** - Create tables and indexes
3. **Create Repository** - `discord-webhooks.ts`
4. **Create Service** - `discord-webhook-sender.ts`
5. **Create IPC Handlers** - `discord-webhooks.ts`
6. **Create Frontend Screen** - `discord-webhooks.tsx`
7. **Update Menu** - Add "Discord Webhooks" navigation item
8. **Testing** - Test create/edit/send/delete flow

---

## Testing Checklist

- [ ] Create webhook with valid URL
- [ ] Test webhook sends successfully
- [ ] Edit webhook updates correctly
- [ ] Delete webhook removes from database
- [ ] Send webhook posts to Discord channel
- [ ] Template variables are replaced correctly
- [ ] Error handling for invalid webhook URLs
- [ ] Disabled webhooks cannot be sent
- [ ] Send count increments correctly
- [ ] History tracking works

---

## Summary

| Aspect | Details |
|--------|---------|
| **Files Created** | 3 backend + 1 frontend |
| **Database Tables** | 2 tables (webhooks + history) |
| **IPC Handlers** | 8 handlers |
| **UI Components** | 1 main screen + modal editor |
| **Estimated Time** | 6-10 hours |
| **Risk Level** | Low |

---

**Status:** 📋 Documentation Complete  
**Next Step:** Remove old Discord code, then implement  
**Priority:** Medium

---

**Last Updated:** October 2025  
**Author:** AI Code Analysis  
**Version:** 1.0
