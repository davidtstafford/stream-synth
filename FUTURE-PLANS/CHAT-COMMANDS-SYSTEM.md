# Chat Commands System Feature

**Status:** 📋 **FUTURE FEATURE - DOCUMENTATION**  
**Priority:** High  
**Estimated Effort:** 10-14 hours  
**Dependencies:** Discord TTS Bot feature (for ~voices command), existing TTS system  
**Risk:** Low  

---

## Overview

Create a comprehensive chat command system that allows viewers and moderators to interact with Stream Synth directly through Twitch chat. Commands can be enabled/disabled individually through a dedicated configuration screen.

**Current State**: No chat command system exists  
**Desired State**: Configurable chat commands with viewer and moderator tiers

### Key Benefits

- ✅ Viewers can interact with TTS system via chat
- ✅ Moderators can manage TTS in real-time
- ✅ Individual command enable/disable toggles
- ✅ Customizable command prefixes
- ✅ Rate limiting to prevent spam
- ✅ Permission-based command execution

---

## Command Categories

### Viewer Commands

| Command | Description | Response |
|---------|-------------|----------|
| `~hello` | Greet the user | "Hello @username! Welcome to the stream!" |
| `~voices` | Get Discord bot info | "Find voices using our Discord bot! Use `!tts search` in discord.gg/example" |
| `~setvoice <voice_id>` | Set personal TTS voice | "Voice set to en-US-JennyNeural" or error |

### Moderator Commands

| Command | Description | Effect |
|---------|-------------|--------|
| `~mutevoice @user [mins]` | Mute user's TTS | Disables TTS for user (temp or perm) |
| `~unmutevoice @user` | Unmute user's TTS | Re-enables TTS for user |
| `~cooldownvoice @user <gap> [mins]` | Set user TTS cooldown | Adds cooldown between messages |
| `~mutetts` | Disable global TTS | Same as toggling "Enable TTS" OFF |
| `~unmutetts` | Enable global TTS | Same as toggling "Enable TTS" ON |

---

## Use Cases

### Scenario 1: Viewer Sets Their Voice
**Viewer in Twitch chat:** `~setvoice en-GB-RyanNeural`  
**Bot Response:** "✅ @Viewer, your TTS voice has been set to en-GB-RyanNeural (British Male)"

### Scenario 2: Moderator Temporarily Mutes Spammer
**Moderator in chat:** `~mutevoice @SpammyUser 30`  
**Bot Response:** "🔇 @SpammyUser has been muted from TTS for 30 minutes"

### Scenario 3: Moderator Adds Cooldown
**Moderator in chat:** `~cooldownvoice @ChatterBox 45 60`  
**Bot Response:** "⏱️ @ChatterBox now has a 45 second TTS cooldown for 60 minutes"

### Scenario 4: Moderator Disables Global TTS
**Moderator in chat:** `~mutetts`  
**Bot Response:** "🔇 TTS has been globally disabled"

---

## Architecture Overview

### Database Schema

#### `chat_commands_config` Table

```sql
CREATE TABLE chat_commands_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_name TEXT UNIQUE NOT NULL,
  command_prefix TEXT NOT NULL,        -- e.g., '~'
  enabled INTEGER DEFAULT 1,
  permission_level TEXT NOT NULL,      -- 'viewer' | 'moderator' | 'broadcaster'
  rate_limit_seconds INTEGER DEFAULT 5,
  custom_response TEXT,                -- Optional override for response
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (permission_level IN ('viewer', 'moderator', 'broadcaster'))
);
```

**Indexes:**
```sql
CREATE INDEX idx_chat_commands_enabled ON chat_commands_config(enabled);
CREATE INDEX idx_chat_commands_permission ON chat_commands_config(permission_level);
```

#### `chat_command_usage` Table

```sql
CREATE TABLE chat_command_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_name TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  viewer_username TEXT NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_command_usage_viewer ON chat_command_usage(viewer_id);
CREATE INDEX idx_command_usage_executed ON chat_command_usage(executed_at);
CREATE INDEX idx_command_usage_command ON chat_command_usage(command_name);
```

---

## Backend Implementation

### 1. Chat Commands Configuration Repository

**File:** `src/backend/database/repositories/chat-commands-config.ts`

```typescript
import { BaseRepository } from '../base-repository';

export interface ChatCommandConfig {
  id: number;
  command_name: string;
  command_prefix: string;
  enabled: boolean;
  permission_level: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds: number;
  custom_response?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCommandInput {
  command_name: string;
  command_prefix?: string;
  enabled?: boolean;
  permission_level: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds?: number;
  custom_response?: string;
}

export class ChatCommandsConfigRepository extends BaseRepository {
  /**
   * Get all command configurations
   */
  getAll(): { success: boolean; commands?: ChatCommandConfig[]; error?: string } {
    try {
      const db = this.getDatabase();
      const commands = db.prepare(`
        SELECT * FROM chat_commands_config
        ORDER BY permission_level, command_name
      `).all() as ChatCommandConfig[];

      return { success: true, commands };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error getting commands:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get enabled commands only
   */
  getEnabled(): { success: boolean; commands?: ChatCommandConfig[]; error?: string } {
    try {
      const db = this.getDatabase();
      const commands = db.prepare(`
        SELECT * FROM chat_commands_config
        WHERE enabled = 1
        ORDER BY permission_level, command_name
      `).all() as ChatCommandConfig[];

      return { success: true, commands };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error getting enabled commands:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get command by name
   */
  getByName(commandName: string): { success: boolean; command?: ChatCommandConfig; error?: string } {
    try {
      const db = this.getDatabase();
      const command = db.prepare(`
        SELECT * FROM chat_commands_config
        WHERE command_name = ?
      `).get(commandName) as ChatCommandConfig | undefined;

      if (!command) {
        return { success: false, error: 'Command not found' };
      }

      return { success: true, command };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error getting command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update command configuration
   */
  update(
    commandName: string,
    updates: Partial<ChatCommandInput>
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.command_prefix !== undefined) {
        fields.push('command_prefix = ?');
        values.push(updates.command_prefix);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      if (updates.permission_level !== undefined) {
        fields.push('permission_level = ?');
        values.push(updates.permission_level);
      }
      if (updates.rate_limit_seconds !== undefined) {
        fields.push('rate_limit_seconds = ?');
        values.push(updates.rate_limit_seconds);
      }
      if (updates.custom_response !== undefined) {
        fields.push('custom_response = ?');
        values.push(updates.custom_response || null);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(commandName);

      db.prepare(`
        UPDATE chat_commands_config
        SET ${fields.join(', ')}
        WHERE command_name = ?
      `).run(...values);

      return { success: true };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error updating command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record command usage
   */
  recordUsage(
    commandName: string,
    viewerId: string,
    viewerUsername: string,
    success: boolean,
    errorMessage?: string
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      db.prepare(`
        INSERT INTO chat_command_usage (
          command_name, viewer_id, viewer_username, success, error_message
        ) VALUES (?, ?, ?, ?, ?)
      `).run(commandName, viewerId, viewerUsername, success ? 1 : 0, errorMessage || null);

      return { success: true };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error recording usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get command usage statistics
   */
  getUsageStats(
    commandName?: string,
    limit: number = 100
  ): { success: boolean; usage?: any[]; error?: string } {
    try {
      const db = this.getDatabase();
      
      let query = `
        SELECT * FROM chat_command_usage
      `;

      const params: any[] = [];

      if (commandName) {
        query += ` WHERE command_name = ?`;
        params.push(commandName);
      }

      query += ` ORDER BY executed_at DESC LIMIT ?`;
      params.push(limit);

      const usage = db.prepare(query).all(...params);

      return { success: true, usage };
    } catch (error: any) {
      console.error('[ChatCommandsConfigRepo] Error getting usage stats:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 2. Chat Command Handler Service

**File:** `src/backend/services/chat-command-handler.ts`

```typescript
import { ChatCommandsConfigRepository } from '../database/repositories/chat-commands-config';
import { ViewersRepository } from '../database/repositories/viewers';
import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { ViewerVoicePreferencesRepository } from '../database/repositories/viewer-voice-preferences';
import { ViewerRulesRepository } from '../database/repositories/viewer-rules';
import { TTSRepository } from '../database/repositories/tts';
import { VoicesRepository } from '../database/repositories/voices';

export interface ChatCommandContext {
  username: string;
  userId: string;
  isModerator: boolean;
  isBroadcaster: boolean;
  isVip: boolean;
}

export class ChatCommandHandler {
  private commandsRepo = new ChatCommandsConfigRepository();
  private viewersRepo = new ViewersRepository();
  private rolesRepo = new ViewerRolesRepository();
  private voicePrefsRepo = new ViewerVoicePreferencesRepository();
  private viewerRulesRepo = new ViewerRulesRepository();
  private ttsRepo = new TTSRepository();
  private voicesRepo = new VoicesRepository();

  // Rate limiting cache: commandName -> userId -> lastExecuted
  private rateLimitCache = new Map<string, Map<string, number>>();

  /**
   * Handle incoming chat command
   */
  async handle(
    message: string,
    context: ChatCommandContext
  ): Promise<string | null> {
    // Get enabled commands
    const commandsResult = this.commandsRepo.getEnabled();
    if (!commandsResult.success || !commandsResult.commands) {
      return null;
    }

    // Check if message starts with any command
    for (const config of commandsResult.commands) {
      const fullCommand = config.command_prefix + config.command_name;
      
      if (!message.startsWith(fullCommand)) {
        continue;
      }

      // Check permissions
      if (!this.hasPermission(context, config.permission_level)) {
        this.commandsRepo.recordUsage(
          config.command_name,
          context.userId,
          context.username,
          false,
          'Insufficient permissions'
        );
        return null; // Silently ignore
      }

      // Check rate limit
      if (!this.checkRateLimit(config.command_name, context.userId, config.rate_limit_seconds)) {
        this.commandsRepo.recordUsage(
          config.command_name,
          context.userId,
          context.username,
          false,
          'Rate limited'
        );
        return null; // Silently ignore
      }

      // Extract args
      const args = message.slice(fullCommand.length).trim().split(/\s+/);

      // Execute command
      try {
        const response = await this.executeCommand(config.command_name, args, context);
        
        this.commandsRepo.recordUsage(
          config.command_name,
          context.userId,
          context.username,
          true
        );

        // Update rate limit
        this.updateRateLimit(config.command_name, context.userId);

        return response;
      } catch (error: any) {
        console.error(`[ChatCommand] Error executing ${config.command_name}:`, error);
        
        this.commandsRepo.recordUsage(
          config.command_name,
          context.userId,
          context.username,
          false,
          error.message
        );

        return `❌ Error: ${error.message}`;
      }
    }

    return null; // No matching command
  }

  /**
   * Execute specific command
   */
  private async executeCommand(
    commandName: string,
    args: string[],
    context: ChatCommandContext
  ): Promise<string> {
    switch (commandName) {
      case 'hello':
        return this.handleHello(context);
      
      case 'voices':
        return this.handleVoices(context);
      
      case 'setvoice':
        return this.handleSetVoice(args, context);
      
      case 'mutevoice':
        return this.handleMuteVoice(args, context);
      
      case 'unmutevoice':
        return this.handleUnmuteVoice(args, context);
      
      case 'cooldownvoice':
        return this.handleCooldownVoice(args, context);
      
      case 'mutetts':
        return this.handleMuteTTS(context);
      
      case 'unmutetts':
        return this.handleUnmuteTTS(context);
      
      default:
        throw new Error('Unknown command');
    }
  }

  /**
   * Command: ~hello
   */
  private handleHello(context: ChatCommandContext): string {
    return `Hello @${context.username}! Welcome to the stream! 👋`;
  }

  /**
   * Command: ~voices
   */
  private handleVoices(context: ChatCommandContext): string {
    // Get Discord bot info from config
    const discordInvite = 'discord.gg/yourserver'; // TODO: Make configurable
    
    return `🔊 Find TTS voices using our Discord bot! Join ${discordInvite} and use \`!tts search\` to browse available voices. Then use \`~setvoice <voice_id>\` here in chat!`;
  }

  /**
   * Command: ~setvoice <voice_id>
   */
  private async handleSetVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~setvoice <voice_id>');
    }

    const voiceId = args[0];

    // Validate voice exists
    const voices = this.voicesRepo.getAllVoices();
    const voice = voices?.find(v => v.voice_id === voiceId);

    if (!voice) {
      throw new Error(`Voice "${voiceId}" not found. Use ~voices to find available voices.`);
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate({
      id: context.userId,
      username: context.username,
      display_name: context.username
    });

    if (!viewer) {
      throw new Error('Failed to create viewer record');
    }

    // Set voice preference
    const result = this.voicePrefsRepo.setVoicePreference(viewer.id, {
      voice_id: voiceId,
      provider: voice.provider,
      pitch: 1.0,
      speed: 1.0
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to set voice');
    }

    const gender = voice.gender ? ` (${voice.gender})` : '';
    return `✅ @${context.username}, your TTS voice has been set to ${voice.name}${gender}`;
  }

  /**
   * Command: ~mutevoice @user [mins]
   */
  private async handleMuteVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~mutevoice @username [minutes]');
    }

    const targetUsername = args[0].replace('@', '');
    const minutes = args.length > 1 ? parseInt(args[1]) : 5;

    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Invalid time. Use a number >= 0 (0 = permanent)');
    }

    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);
    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found`);
    }

    // Add/update mute rule
    const result = this.viewerRulesRepo.setMute(targetViewer.id, {
      mute_period_mins: minutes === 0 ? null : minutes
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to mute user');
    }

    if (minutes === 0) {
      return `🔇 @${targetUsername} has been permanently muted from TTS`;
    } else {
      return `🔇 @${targetUsername} has been muted from TTS for ${minutes} minute(s)`;
    }
  }

  /**
   * Command: ~unmutevoice @user
   */
  private async handleUnmuteVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~unmutevoice @username');
    }

    const targetUsername = args[0].replace('@', '');

    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);
    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found`);
    }

    // Remove mute rule
    const result = this.viewerRulesRepo.removeMute(targetViewer.id);

    if (!result.success) {
      throw new Error(result.error || 'Failed to unmute user');
    }

    return `✅ @${targetUsername} has been unmuted from TTS`;
  }

  /**
   * Command: ~cooldownvoice @user <gap_seconds> [mins]
   */
  private async handleCooldownVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length < 2) {
      throw new Error('Usage: ~cooldownvoice @username <gap_seconds> [minutes]');
    }

    const targetUsername = args[0].replace('@', '');
    const gapSeconds = parseInt(args[1]);
    const minutes = args.length > 2 ? parseInt(args[2]) : 5;

    if (isNaN(gapSeconds) || gapSeconds < 1 || gapSeconds > 120) {
      throw new Error('Gap must be between 1 and 120 seconds');
    }

    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Invalid time. Use a number >= 0 (0 = permanent)');
    }

    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);
    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found`);
    }

    // Add/update cooldown rule
    const result = this.viewerRulesRepo.setCooldown(targetViewer.id, {
      cooldown_gap_seconds: gapSeconds,
      cooldown_period_mins: minutes === 0 ? null : minutes
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to set cooldown');
    }

    if (minutes === 0) {
      return `⏱️ @${targetUsername} now has a permanent ${gapSeconds} second TTS cooldown`;
    } else {
      return `⏱️ @${targetUsername} now has a ${gapSeconds} second TTS cooldown for ${minutes} minute(s)`;
    }
  }

  /**
   * Command: ~mutetts
   */
  private async handleMuteTTS(context: ChatCommandContext): Promise<string> {
    const result = this.ttsRepo.updateSetting('tts_enabled', 'false');

    if (!result.success) {
      throw new Error(result.error || 'Failed to disable TTS');
    }

    return `🔇 TTS has been globally disabled`;
  }

  /**
   * Command: ~unmutetts
   */
  private async handleUnmuteTTS(context: ChatCommandContext): Promise<string> {
    const result = this.ttsRepo.updateSetting('tts_enabled', 'true');

    if (!result.success) {
      throw new Error(result.error || 'Failed to enable TTS');
    }

    return `🔊 TTS has been globally enabled`;
  }

  /**
   * Check if user has permission for command
   */
  private hasPermission(
    context: ChatCommandContext,
    requiredLevel: 'viewer' | 'moderator' | 'broadcaster'
  ): boolean {
    if (requiredLevel === 'viewer') {
      return true; // Everyone
    }

    if (requiredLevel === 'moderator') {
      return context.isModerator || context.isBroadcaster;
    }

    if (requiredLevel === 'broadcaster') {
      return context.isBroadcaster;
    }

    return false;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(commandName: string, userId: string, limitSeconds: number): boolean {
    if (!this.rateLimitCache.has(commandName)) {
      return true;
    }

    const userCache = this.rateLimitCache.get(commandName)!;
    if (!userCache.has(userId)) {
      return true;
    }

    const lastExecuted = userCache.get(userId)!;
    const now = Date.now();
    const elapsed = (now - lastExecuted) / 1000;

    return elapsed >= limitSeconds;
  }

  /**
   * Update rate limit
   */
  private updateRateLimit(commandName: string, userId: string): void {
    if (!this.rateLimitCache.has(commandName)) {
      this.rateLimitCache.set(commandName, new Map());
    }

    this.rateLimitCache.get(commandName)!.set(userId, Date.now());
  }
}
```

### 3. Integration with Twitch IRC

**Update:** `src/backend/services/twitch-irc.ts`

```typescript
// Add to TwitchIRCService class

import { ChatCommandHandler, ChatCommandContext } from './chat-command-handler';

export class TwitchIRCService {
  private commandHandler = new ChatCommandHandler();

  // ...existing code...

  private async handleMessage(channel: string, tags: any, message: string, self: boolean) {
    // ...existing message handling...

    // Check for chat commands
    const context: ChatCommandContext = {
      username: tags.username,
      userId: tags['user-id'],
      isModerator: tags.mod || false,
      isBroadcaster: tags.badges?.broadcaster === '1',
      isVip: tags.badges?.vip === '1'
    };

    try {
      const response = await this.commandHandler.handle(message, context);
      
      if (response && this.client) {
        // Send response to chat
        this.client.say(channel, response);
      }
    } catch (error) {
      console.error('[IRC] Error handling command:', error);
    }

    // ...rest of message handling...
  }
}
```

---

## Frontend Implementation

### Chat Commands Configuration Screen

**File:** `src/frontend/screens/chat-commands/chat-commands.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import './chat-commands.css';

const { ipcRenderer } = window.require('electron');

interface ChatCommand {
  id: number;
  command_name: string;
  command_prefix: string;
  enabled: boolean;
  permission_level: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds: number;
  custom_response?: string;
}

export const ChatCommandsScreen: React.FC = () => {
  const [commands, setCommands] = useState<ChatCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    setLoading(true);
    try {
      const response = await ipcRenderer.invoke('chat-commands:get-all');
      if (response.success) {
        setCommands(response.commands);
      } else {
        setError(response.error || 'Failed to load commands');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCommand = async (commandName: string, enabled: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke('chat-commands:update', commandName, { enabled });
      
      if (response.success) {
        setSuccess(`${commandName} ${enabled ? 'enabled' : 'disabled'}!`);
        setTimeout(() => setSuccess(null), 2000);
        loadCommands();
      } else {
        setError(response.error || 'Failed to update command');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRateLimit = async (commandName: string, seconds: number) => {
    try {
      const response = await ipcRenderer.invoke('chat-commands:update', commandName, {
        rate_limit_seconds: seconds
      });
      
      if (response.success) {
        loadCommands();
      } else {
        setError(response.error || 'Failed to update rate limit');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getPermissionBadge = (level: string) => {
    switch (level) {
      case 'viewer':
        return <span className="badge badge-viewer">👤 Viewer</span>;
      case 'moderator':
        return <span className="badge badge-moderator">⚔️ Moderator</span>;
      case 'broadcaster':
        return <span className="badge badge-broadcaster">👑 Broadcaster</span>;
      default:
        return null;
    }
  };

  const viewerCommands = commands.filter(c => c.permission_level === 'viewer');
  const moderatorCommands = commands.filter(c => c.permission_level === 'moderator');

  return (
    <div className="chat-commands-screen">
      <h1>Chat Commands</h1>
      
      <p className="description">
        Enable or disable chat commands that viewers and moderators can use in Twitch chat.
      </p>

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

      {loading && <div className="loading-spinner">Loading...</div>}

      {/* Viewer Commands */}
      <div className="command-section">
        <h2>👤 Viewer Commands</h2>
        <div className="commands-grid">
          {viewerCommands.map(command => (
            <div key={command.id} className="command-card">
              <div className="command-header">
                <div className="command-info">
                  <code className="command-name">
                    {command.command_prefix}{command.command_name}
                  </code>
                  {getPermissionBadge(command.permission_level)}
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={command.enabled}
                    onChange={(e) => toggleCommand(command.command_name, e.target.checked)}
                    disabled={loading}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="command-description">
                {command.command_name === 'hello' && '👋 Greets the user'}
                {command.command_name === 'voices' && '🔊 Directs users to Discord for voice browsing'}
                {command.command_name === 'setvoice' && '🎤 Allows users to set their TTS voice'}
              </div>

              <div className="command-settings">
                <label>Rate Limit: {command.rate_limit_seconds}s</label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={command.rate_limit_seconds}
                  onChange={(e) => updateRateLimit(command.command_name, parseInt(e.target.value))}
                  disabled={loading || !command.enabled}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Moderator Commands */}
      <div className="command-section">
        <h2>⚔️ Moderator Commands</h2>
        <div className="commands-grid">
          {moderatorCommands.map(command => (
            <div key={command.id} className="command-card">
              <div className="command-header">
                <div className="command-info">
                  <code className="command-name">
                    {command.command_prefix}{command.command_name}
                  </code>
                  {getPermissionBadge(command.permission_level)}
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={command.enabled}
                    onChange={(e) => toggleCommand(command.command_name, e.target.checked)}
                    disabled={loading}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="command-description">
                {command.command_name === 'mutevoice' && '🔇 Mute a user\'s TTS'}
                {command.command_name === 'unmutevoice' && '✅ Unmute a user\'s TTS'}
                {command.command_name === 'cooldownvoice' && '⏱️ Set TTS cooldown for a user'}
                {command.command_name === 'mutetts' && '🔇 Disable TTS globally'}
                {command.command_name === 'unmutetts' && '🔊 Enable TTS globally'}
              </div>

              <div className="command-settings">
                <label>Rate Limit: {command.rate_limit_seconds}s</label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={command.rate_limit_seconds}
                  onChange={(e) => updateRateLimit(command.command_name, parseInt(e.target.value))}
                  disabled={loading || !command.enabled}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## Database Migration

Add to `src/backend/database/migrations.ts`:

```typescript
// Create chat_commands_config table
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_commands_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_name TEXT UNIQUE NOT NULL,
    command_prefix TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    permission_level TEXT NOT NULL,
    rate_limit_seconds INTEGER DEFAULT 5,
    custom_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (permission_level IN ('viewer', 'moderator', 'broadcaster'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_commands_enabled ON chat_commands_config(enabled)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_commands_permission ON chat_commands_config(permission_level)
`);

// Insert default command configurations
db.exec(`
  INSERT OR IGNORE INTO chat_commands_config (
    command_name, command_prefix, enabled, permission_level, rate_limit_seconds
  ) VALUES 
    ('hello', '~', 1, 'viewer', 10),
    ('voices', '~', 1, 'viewer', 30),
    ('setvoice', '~', 1, 'viewer', 5),
    ('mutevoice', '~', 1, 'moderator', 1),
    ('unmutevoice', '~', 1, 'moderator', 1),
    ('cooldownvoice', '~', 1, 'moderator', 1),
    ('mutetts', '~', 1, 'moderator', 5),
    ('unmutetts', '~', 1, 'moderator', 5)
`);

// Create chat_command_usage table
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_command_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_name TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    viewer_username TEXT NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    
    FOREIGN KEY (viewer_id) REFERENCES viewers(id)
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_command_usage_viewer ON chat_command_usage(viewer_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_command_usage_executed ON chat_command_usage(executed_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_command_usage_command ON chat_command_usage(command_name)
`);
```

---

## IPC Handlers

**File:** `src/backend/core/ipc-handlers/chat-commands.ts`

```typescript
import { ipcMain } from 'electron';
import { ChatCommandsConfigRepository } from '../../database/repositories/chat-commands-config';

export function registerChatCommandsHandlers() {
  const repo = new ChatCommandsConfigRepository();

  // Get all commands
  ipcMain.handle('chat-commands:get-all', async () => {
    return repo.getAll();
  });

  // Get enabled commands
  ipcMain.handle('chat-commands:get-enabled', async () => {
    return repo.getEnabled();
  });

  // Update command
  ipcMain.handle('chat-commands:update', async (_, commandName: string, updates: any) => {
    return repo.update(commandName, updates);
  });

  // Get usage stats
  ipcMain.handle('chat-commands:get-usage', async (_, commandName?: string, limit?: number) => {
    return repo.getUsageStats(commandName, limit);
  });

  console.log('[IPC] Chat commands handlers registered');
}
```

---

## Implementation Steps

1. **Add Database Migration** - Create tables and insert default commands
2. **Create Repository** - `chat-commands-config.ts`
3. **Create Service** - `chat-command-handler.ts`
4. **Update Twitch IRC** - Integrate command handler
5. **Create IPC Handlers** - `chat-commands.ts`
6. **Create Frontend Screen** - `chat-commands.tsx`
7. **Update Menu** - Add "Chat Commands" navigation
8. **Testing** - Test all commands in Twitch chat

---

## Testing Checklist

- [ ] ~hello responds correctly
- [ ] ~voices provides Discord info
- [ ] ~setvoice sets user voice
- [ ] ~mutevoice mutes user TTS
- [ ] ~unmutevoice unmutes user TTS
- [ ] ~cooldownvoice sets cooldown
- [ ] ~mutetts disables global TTS
- [ ] ~unmutetts enables global TTS
- [ ] Rate limiting works
- [ ] Permission checks work (mod-only commands)
- [ ] Command enable/disable toggles work
- [ ] Usage tracking works

---

## Summary

| Aspect | Details |
|--------|---------|
| **Files Created** | 3 backend + 1 frontend |
| **Database Tables** | 2 tables |
| **Commands** | 8 total (3 viewer + 5 moderator) |
| **IPC Handlers** | 4 handlers |
| **Estimated Time** | 10-14 hours |
| **Dependencies** | Discord TTS Bot (for ~voices) |
| **Risk Level** | Low |

---

**Status:** 📋 Documentation Complete  
**Next Step:** Implementation  
**Priority:** High

---

**Last Updated:** October 2025  
**Author:** AI Code Analysis  
**Version:** 1.0
