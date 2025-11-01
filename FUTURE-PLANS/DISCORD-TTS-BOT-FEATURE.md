# Discord TTS Bot Feature

**Status:** 📋 **FUTURE FEATURE - DOCUMENTATION**  
**Priority:** Medium  
**Estimated Effort:** 12-16 hours  
**Dependencies:** Discord.js library, existing TTS system, voice repositories  
**Risk:** Medium (Discord bot authentication complexity)  

---

## Overview

Create a Discord bot that connects to your Discord server and responds to voice-related queries in chat. The bot provides an interface for users to search voices, check current TTS settings, view access restrictions, and get personalized voice commands.

**Current State**: No Discord bot integration  
**Desired State**: Fully functional Discord bot that answers TTS-related questions

### Key Benefits

- ✅ Users can query voice information without opening Stream Synth
- ✅ Bot provides personalized responses (your current voice, your permissions)
- ✅ Search voices by name, language, gender, premium status
- ✅ Shows TTS access restrictions in effect
- ✅ Provides ready-to-use chat commands for voice selection
- ✅ Integrated with existing TTS system (no duplicate logic)

---

## Use Cases

### Scenario 1: User Wants to Find a British Voice
**User in Discord:** `!tts search language:British`  
**Bot Response:**
```
🔊 Found 8 British English voices:

Premium Voices:
• en-GB-RyanNeural (Male) - Use: !voice en-GB-RyanNeural
• en-GB-SoniaNeural (Female) - Use: !voice en-GB-SoniaNeural

Standard Voices:
• Google UK English Male - Use: !voice google-en-GB-male
• Google UK English Female - Use: !voice google-en-GB-female
...
```

### Scenario 2: User Checks Current Voice
**User in Discord:** `!tts myvoice`  
**Bot Response:**
```
🎤 Your Current TTS Voice:
• Voice: en-US-JennyNeural (Female, Premium)
• Provider: Azure
• Language: English (United States)

✅ You have access to this voice.
```

### Scenario 3: User Checks TTS Access
**User in Discord:** `!tts access`  
**Bot Response:**
```
🔒 Current TTS Access Restrictions:

Access Mode: Limited Access
✅ Subscribers can use TTS
✅ VIPs can use TTS
❌ Gifted subs cannot use TTS
❌ Moderators do NOT have automatic access

Premium Voice Access:
✅ Subscribers can use Premium voices
❌ VIPs cannot use Premium voices

Use !tts voices to see all available voices.
```

### Scenario 4: User Searches for Female Voices
**User in Discord:** `!tts search gender:female premium:yes`  
**Bot Response:**
```
🔊 Found 24 Premium Female voices:

American English:
• en-US-JennyNeural - Use: !voice en-US-JennyNeural
• en-US-AriaNeural - Use: !voice en-US-AriaNeural

British English:
• en-GB-SoniaNeural - Use: !voice en-GB-SoniaNeural

French:
• fr-FR-DeniseNeural - Use: !voice fr-FR-DeniseNeural
...

(Showing 10 of 24 results. Use !tts search gender:female premium:yes page:2)
```

---

## Architecture Overview

### Technology Stack

- **Discord.js** - Discord bot library
- **Existing Repositories** - Reuse voice repos, TTS access repo, viewer repos
- **SQLite Database** - Existing Stream Synth database
- **IPC** - Communication with main Electron app

### Bot Flow

```
Discord User sends command (!tts search language:British)
    ↓
Discord Bot receives message
    ↓
Parse command and parameters
    ↓
Query appropriate repositories (voices, TTS access, viewers)
    ↓
Format response message
    ↓
Send to Discord channel
```

### Core Components

1. **DiscordBotService** - Manages bot connection and lifecycle
2. **DiscordCommandHandler** - Parses and routes commands
3. **VoiceSearchService** - Searches voices with filters
4. **TTSStatusFormatter** - Formats TTS access rules for display
5. **DiscordBotRepository** - Stores bot configuration

---

## Backend Implementation

### 1. Discord Bot Configuration Repository

**File:** `src/backend/database/repositories/discord-bot-config.ts`

```typescript
import { BaseRepository } from '../base-repository';

export interface DiscordBotConfig {
  id: number;
  bot_token: string;
  guild_id?: string;           // Optional: Specific server to connect to
  command_prefix: string;       // Default: !tts
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class DiscordBotConfigRepository extends BaseRepository {
  /**
   * Get bot config (singleton)
   */
  get(): { success: boolean; config?: DiscordBotConfig; error?: string } {
    try {
      const db = this.getDatabase();
      const config = db.prepare(`
        SELECT * FROM discord_bot_config WHERE id = 1
      `).get() as DiscordBotConfig | undefined;

      return { success: true, config };
    } catch (error: any) {
      console.error('[DiscordBotConfigRepo] Error getting config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save bot config
   */
  save(config: Partial<DiscordBotConfig>): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        INSERT INTO discord_bot_config (
          id, bot_token, guild_id, command_prefix, enabled
        ) VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          bot_token = excluded.bot_token,
          guild_id = excluded.guild_id,
          command_prefix = excluded.command_prefix,
          enabled = excluded.enabled,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        config.bot_token || '',
        config.guild_id || null,
        config.command_prefix || '!tts',
        config.enabled !== undefined ? (config.enabled ? 1 : 0) : 1
      );

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordBotConfigRepo] Error saving config:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### Database Schema

```sql
CREATE TABLE discord_bot_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  bot_token TEXT NOT NULL,
  guild_id TEXT,
  command_prefix TEXT NOT NULL DEFAULT '!tts',
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (id = 1)
);
```

### 2. Voice Search Service

**File:** `src/backend/services/voice-search-service.ts`

```typescript
import { VoicesRepository, Voice } from '../database/repositories/voices';

export interface VoiceSearchFilters {
  language?: string;       // Partial match on language_name
  gender?: string;         // 'male' | 'female'
  premium?: boolean;       // Azure/Google = premium, WebSpeech = standard
  provider?: string;       // 'webspeech' | 'azure' | 'google'
  name?: string;           // Partial match on voice name
}

export interface VoiceSearchResult {
  voice: Voice;
  commandText: string;     // Ready-to-use command: !voice en-US-JennyNeural
}

export class VoiceSearchService {
  private voicesRepo = new VoicesRepository();

  /**
   * Search voices with filters
   */
  search(
    filters: VoiceSearchFilters,
    limit: number = 10,
    offset: number = 0
  ): { success: boolean; results?: VoiceSearchResult[]; total?: number; error?: string } {
    try {
      const voices = this.voicesRepo.searchVoices(filters);

      if (!voices) {
        return { success: false, error: 'Failed to search voices' };
      }

      // Apply pagination
      const total = voices.length;
      const paginatedVoices = voices.slice(offset, offset + limit);

      // Build results with command text
      const results: VoiceSearchResult[] = paginatedVoices.map(voice => ({
        voice,
        commandText: `!voice ${voice.voice_id}`
      }));

      return {
        success: true,
        results,
        total
      };
    } catch (error: any) {
      console.error('[VoiceSearch] Error searching:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get voice by ID (for lookup commands)
   */
  getByVoiceId(voiceId: string): { success: boolean; voice?: Voice; error?: string } {
    try {
      const voices = this.voicesRepo.getAllVoices();
      if (!voices) {
        return { success: false, error: 'Failed to get voices' };
      }

      const voice = voices.find(v => v.voice_id === voiceId);
      if (!voice) {
        return { success: false, error: 'Voice not found' };
      }

      return { success: true, voice };
    } catch (error: any) {
      console.error('[VoiceSearch] Error getting voice:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 3. Discord Bot Service

**File:** `src/backend/services/discord-bot-service.ts`

```typescript
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { DiscordBotConfigRepository } from '../database/repositories/discord-bot-config';
import { DiscordCommandHandler } from './discord-command-handler';

export class DiscordBotService {
  private client: Client | null = null;
  private configRepo = new DiscordBotConfigRepository();
  private commandHandler: DiscordCommandHandler;
  private isConnected = false;

  constructor() {
    this.commandHandler = new DiscordCommandHandler();
  }

  /**
   * Start the Discord bot
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      const configResult = this.configRepo.get();
      if (!configResult.success || !configResult.config) {
        return { success: false, error: 'No bot configuration found' };
      }

      const config = configResult.config;

      if (!config.enabled) {
        return { success: false, error: 'Bot is disabled' };
      }

      if (!config.bot_token) {
        return { success: false, error: 'No bot token configured' };
      }

      // Create Discord client
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      // Event: Bot ready
      this.client.once('ready', () => {
        console.log(`[DiscordBot] Logged in as ${this.client?.user?.tag}`);
        this.isConnected = true;
      });

      // Event: Message received
      this.client.on('messageCreate', async (message: Message) => {
        await this.handleMessage(message, config.command_prefix);
      });

      // Event: Error
      this.client.on('error', (error) => {
        console.error('[DiscordBot] Error:', error);
      });

      // Login
      await this.client.login(config.bot_token);

      return { success: true };
    } catch (error: any) {
      console.error('[DiscordBot] Failed to start:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the Discord bot
   */
  async stop(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.client) {
        await this.client.destroy();
        this.client = null;
        this.isConnected = false;
        console.log('[DiscordBot] Stopped');
      }
      return { success: true };
    } catch (error: any) {
      console.error('[DiscordBot] Failed to stop:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message, commandPrefix: string) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if message starts with command prefix
    if (!message.content.startsWith(commandPrefix)) return;

    // Extract command and args
    const args = message.content.slice(commandPrefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    try {
      // Handle command
      const response = await this.commandHandler.handle(command, args, message.author.username);

      if (response) {
        await message.reply(response);
      }
    } catch (error: any) {
      console.error('[DiscordBot] Error handling command:', error);
      await message.reply('❌ An error occurred while processing your command.');
    }
  }

  /**
   * Get bot status
   */
  getStatus(): { connected: boolean; username?: string } {
    return {
      connected: this.isConnected,
      username: this.client?.user?.username
    };
  }
}
```

### 4. Discord Command Handler

**File:** `src/backend/services/discord-command-handler.ts`

```typescript
import { VoiceSearchService, VoiceSearchFilters } from './voice-search-service';
import { TTSAccessRepository } from '../database/repositories/tts-access';
import { ViewersRepository } from '../database/repositories/viewers';
import { ViewerVoicePreferencesRepository } from '../database/repositories/viewer-voice-preferences';

export class DiscordCommandHandler {
  private voiceSearchService = new VoiceSearchService();
  private ttsAccessRepo = new TTSAccessRepository();
  private viewersRepo = new ViewersRepository();
  private voicePrefsRepo = new ViewerVoicePreferencesRepository();

  /**
   * Handle command
   */
  async handle(command: string, args: string[], username: string): Promise<string | null> {
    switch (command) {
      case 'search':
        return this.handleSearch(args);
      
      case 'myvoice':
        return this.handleMyVoice(username);
      
      case 'access':
        return this.handleAccess();
      
      case 'lookup':
        return this.handleLookup(args);
      
      case 'help':
        return this.handleHelp();
      
      default:
        return `❓ Unknown command. Use \`!tts help\` for available commands.`;
    }
  }

  /**
   * Handle !tts search
   */
  private handleSearch(args: string[]): string {
    const filters: VoiceSearchFilters = {};
    let page = 1;
    const pageSize = 10;

    // Parse filters from args
    args.forEach(arg => {
      const [key, value] = arg.split(':');
      
      switch (key.toLowerCase()) {
        case 'language':
        case 'lang':
          filters.language = value;
          break;
        case 'gender':
          filters.gender = value.toLowerCase();
          break;
        case 'premium':
          filters.premium = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
          break;
        case 'provider':
          filters.provider = value.toLowerCase();
          break;
        case 'name':
          filters.name = value;
          break;
        case 'page':
          page = parseInt(value) || 1;
          break;
      }
    });

    const offset = (page - 1) * pageSize;
    const result = this.voiceSearchService.search(filters, pageSize, offset);

    if (!result.success || !result.results) {
      return `❌ ${result.error || 'Failed to search voices'}`;
    }

    if (result.results.length === 0) {
      return '🔍 No voices found matching your criteria.';
    }

    // Format response
    let response = `🔊 Found ${result.total} voice(s):\n\n`;

    // Group by language
    const grouped = new Map<string, typeof result.results>();
    result.results.forEach(r => {
      const lang = r.voice.language_name;
      if (!grouped.has(lang)) {
        grouped.set(lang, []);
      }
      grouped.get(lang)!.push(r);
    });

    grouped.forEach((voices, language) => {
      response += `**${language}:**\n`;
      voices.forEach(({ voice, commandText }) => {
        const isPremium = voice.provider === 'azure' || voice.provider === 'google';
        const premiumTag = isPremium ? ' 🌟' : '';
        const gender = voice.gender ? ` (${voice.gender})` : '';
        
        response += `• ${voice.name}${gender}${premiumTag}\n  Use: \`${commandText}\`\n`;
      });
      response += '\n';
    });

    if (result.total! > pageSize) {
      const totalPages = Math.ceil(result.total! / pageSize);
      response += `\n📄 Page ${page} of ${totalPages}`;
      if (page < totalPages) {
        response += `\nUse \`!tts search ${args.join(' ')} page:${page + 1}\` for more`;
      }
    }

    return response;
  }

  /**
   * Handle !tts myvoice
   */
  private handleMyVoice(username: string): string {
    try {
      // Get viewer by username
      const viewer = this.viewersRepo.getByUsername(username);
      if (!viewer) {
        return `❌ User ${username} not found in database. You may need to chat in Twitch first.`;
      }

      // Get voice preference
      const pref = this.voicePrefsRepo.getByViewerId(viewer.id);
      if (!pref) {
        return `🎤 You don't have a custom voice set.\n\nUse \`!voice <voice_id>\` in Twitch chat to set your voice.`;
      }

      // Get voice details
      const voiceResult = this.voiceSearchService.getByVoiceId(pref.voice_id);
      if (!voiceResult.success || !voiceResult.voice) {
        return `❌ Could not find voice details for ${pref.voice_id}`;
      }

      const voice = voiceResult.voice;
      const isPremium = voice.provider === 'azure' || voice.provider === 'google';
      const gender = voice.gender ? ` (${voice.gender})` : '';

      let response = `🎤 **Your Current TTS Voice:**\n\n`;
      response += `• Voice: ${voice.name}${gender}\n`;
      response += `• Provider: ${voice.provider}\n`;
      response += `• Language: ${voice.language_name}\n`;
      response += `• Type: ${isPremium ? 'Premium 🌟' : 'Standard'}\n`;

      if (pref.pitch !== 1.0 || pref.speed !== 1.0) {
        response += `\n**Custom Settings:**\n`;
        if (pref.pitch !== 1.0) response += `• Pitch: ${pref.pitch}x\n`;
        if (pref.speed !== 1.0) response += `• Speed: ${pref.speed}x\n`;
      }

      // Check access
      const hasAccess = this.checkVoiceAccess(viewer.id, isPremium);
      response += `\n${hasAccess ? '✅' : '❌'} You ${hasAccess ? 'have' : 'do NOT have'} access to this voice.`;

      return response;
    } catch (error: any) {
      console.error('[DiscordBot] Error in myvoice:', error);
      return '❌ An error occurred while fetching your voice.';
    }
  }

  /**
   * Handle !tts access
   */
  private handleAccess(): string {
    try {
      const config = this.ttsAccessRepo.getConfig();
      if (!config) {
        return '❌ Could not retrieve TTS access configuration.';
      }

      let response = `🔒 **Current TTS Access Restrictions:**\n\n`;
      response += `**Access Mode:** ${this.formatAccessMode(config.access_mode)}\n\n`;

      if (config.access_mode === 'limited_access') {
        response += `**Limited Access Rules:**\n`;
        response += `${config.limited_allow_subscribers ? '✅' : '❌'} Subscribers can use TTS\n`;
        response += `${config.limited_deny_gifted_subs ? '❌' : '✅'} Gifted subs ${config.limited_deny_gifted_subs ? 'CANNOT' : 'CAN'} use TTS\n`;
        response += `${config.limited_allow_vip ? '✅' : '❌'} VIPs can use TTS\n`;
        response += `${config.limited_allow_mod ? '✅' : '❌'} Moderators can use TTS\n`;

        if (config.limited_redeem_name) {
          response += `\n💎 Channel Point Redeem: "${config.limited_redeem_name}"\n`;
          response += `Duration: ${config.limited_redeem_duration_mins} minutes\n`;
        }
      }

      if (config.access_mode === 'premium_voice_access') {
        response += `**Premium Voice Access Rules:**\n`;
        response += `${config.premium_allow_subscribers ? '✅' : '❌'} Subscribers can use Premium voices\n`;
        response += `${config.premium_deny_gifted_subs ? '❌' : '✅'} Gifted subs ${config.premium_deny_gifted_subs ? 'CANNOT' : 'CAN'} use Premium voices\n`;
        response += `${config.premium_allow_vip ? '✅' : '❌'} VIPs can use Premium voices\n`;
        response += `${config.premium_allow_mod ? '✅' : '❌'} Moderators can use Premium voices\n`;

        if (config.premium_redeem_name) {
          response += `\n💎 Channel Point Redeem: "${config.premium_redeem_name}"\n`;
          response += `Duration: ${config.premium_redeem_duration_mins} minutes\n`;
        }
      }

      response += `\n\nUse \`!tts search\` to browse available voices.`;

      return response;
    } catch (error: any) {
      console.error('[DiscordBot] Error in access:', error);
      return '❌ An error occurred while fetching access rules.';
    }
  }

  /**
   * Handle !tts lookup <voice_id>
   */
  private handleLookup(args: string[]): string {
    if (args.length === 0) {
      return '❌ Usage: `!tts lookup <voice_id>`';
    }

    const voiceId = args[0];
    const result = this.voiceSearchService.getByVoiceId(voiceId);

    if (!result.success || !result.voice) {
      return `❌ Voice "${voiceId}" not found.`;
    }

    const voice = result.voice;
    const isPremium = voice.provider === 'azure' || voice.provider === 'google';
    const gender = voice.gender ? ` (${voice.gender})` : '';

    let response = `🔊 **Voice Details:**\n\n`;
    response += `• Name: ${voice.name}${gender}\n`;
    response += `• Voice ID: \`${voice.voice_id}\`\n`;
    response += `• Provider: ${voice.provider}\n`;
    response += `• Language: ${voice.language_name}\n`;
    response += `• Type: ${isPremium ? 'Premium 🌟' : 'Standard'}\n`;
    response += `\n**To use this voice in Twitch chat:**\n`;
    response += `\`!voice ${voice.voice_id}\``;

    return response;
  }

  /**
   * Handle !tts help
   */
  private handleHelp(): string {
    return `🤖 **Discord TTS Bot Commands:**

**!tts search [filters]**
Search for voices with optional filters:
• \`language:British\` - Filter by language
• \`gender:female\` - Filter by gender (male/female)
• \`premium:yes\` - Filter by premium status
• \`provider:azure\` - Filter by provider
• \`name:Jenny\` - Search by voice name
• \`page:2\` - Pagination

**!tts myvoice**
Show your current TTS voice and settings.

**!tts access**
Display current TTS access restrictions.

**!tts lookup <voice_id>**
Get details about a specific voice.

**!tts help**
Show this help message.

**Examples:**
\`!tts search language:Spanish gender:female\`
\`!tts search premium:yes\`
\`!tts lookup en-US-JennyNeural\``;
  }

  /**
   * Check if viewer has access to voice type
   */
  private checkVoiceAccess(viewerId: string, isPremium: boolean): boolean {
    // This would integrate with TTSAccessControlService
    // For now, simplified check
    const config = this.ttsAccessRepo.getConfig();
    if (!config) return false;

    if (config.access_mode === 'access_all') {
      return true;
    }

    // Check viewer roles, subscriptions, etc.
    // This is a simplified version
    return true;
  }

  /**
   * Format access mode for display
   */
  private formatAccessMode(mode: string): string {
    switch (mode) {
      case 'access_all':
        return 'Everyone has access';
      case 'limited_access':
        return 'Limited Access (specific groups only)';
      case 'premium_voice_access':
        return 'Premium Voice Access (standard voices for all, premium restricted)';
      default:
        return mode;
    }
  }
}
```

---

## Frontend Implementation

### Discord Bot Configuration Screen

**File:** `src/frontend/screens/discord-bot/discord-bot.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import './discord-bot.css';

const { ipcRenderer } = window.require('electron');

interface DiscordBotConfig {
  bot_token: string;
  guild_id?: string;
  command_prefix: string;
  enabled: boolean;
}

interface BotStatus {
  connected: boolean;
  username?: string;
}

export const DiscordBotScreen: React.FC = () => {
  const [config, setConfig] = useState<DiscordBotConfig>({
    bot_token: '',
    guild_id: '',
    command_prefix: '!tts',
    enabled: false
  });

  const [status, setStatus] = useState<BotStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadStatus();
    
    // Poll status every 5 seconds
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const response = await ipcRenderer.invoke('discord-bot:get-config');
      if (response.success && response.config) {
        setConfig(response.config);
      }
    } catch (err: any) {
      console.error('Failed to load config:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await ipcRenderer.invoke('discord-bot:get-status');
      if (response.success) {
        setStatus(response.status);
      }
    } catch (err: any) {
      console.error('Failed to load status:', err);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke('discord-bot:save-config', config);
      
      if (response.success) {
        setSuccess('Configuration saved!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startBot = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke('discord-bot:start');
      
      if (response.success) {
        setSuccess('Bot started successfully!');
        setTimeout(() => setSuccess(null), 3000);
        loadStatus();
      } else {
        setError(response.error || 'Failed to start bot');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ipcRenderer.invoke('discord-bot:stop');
      
      if (response.success) {
        setSuccess('Bot stopped');
        setTimeout(() => setSuccess(null), 3000);
        loadStatus();
      } else {
        setError(response.error || 'Failed to stop bot');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discord-bot-screen">
      <h1>Discord TTS Bot</h1>

      {/* Status Card */}
      <div className="status-card">
        <h2>Bot Status</h2>
        <div className="status-indicator">
          <span className={status.connected ? 'status-connected' : 'status-disconnected'}>
            {status.connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {status.username && <span className="bot-username">as {status.username}</span>}
        </div>

        <div className="status-actions">
          {status.connected ? (
            <button
              className="btn-danger"
              onClick={stopBot}
              disabled={loading}
            >
              Stop Bot
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={startBot}
              disabled={loading || !config.bot_token}
            >
              Start Bot
            </button>
          )}
        </div>
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

      {/* Configuration */}
      <div className="config-section">
        <h2>Bot Configuration</h2>

        <div className="form-group">
          <label>Bot Token *</label>
          <input
            type="password"
            value={config.bot_token}
            onChange={(e) => setConfig({ ...config, bot_token: e.target.value })}
            placeholder="Your Discord bot token"
          />
          <small>
            Get your bot token from{' '}
            <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">
              Discord Developer Portal
            </a>
          </small>
        </div>

        <div className="form-group">
          <label>Guild ID (Optional)</label>
          <input
            type="text"
            value={config.guild_id || ''}
            onChange={(e) => setConfig({ ...config, guild_id: e.target.value })}
            placeholder="Leave blank for all servers"
          />
          <small>Restrict bot to a specific Discord server (recommended)</small>
        </div>

        <div className="form-group">
          <label>Command Prefix</label>
          <input
            type="text"
            value={config.command_prefix}
            onChange={(e) => setConfig({ ...config, command_prefix: e.target.value })}
            placeholder="!tts"
          />
          <small>Commands will start with this prefix (e.g., !tts search)</small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <span>Enable Bot</span>
          </label>
        </div>

        <button
          className="btn-primary"
          onClick={saveConfig}
          disabled={loading || !config.bot_token}
        >
          💾 Save Configuration
        </button>
      </div>

      {/* Setup Instructions */}
      <div className="instructions-section">
        <h2>Setup Instructions</h2>

        <ol>
          <li>
            Create a Discord bot application at{' '}
            <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">
              Discord Developer Portal
            </a>
          </li>
          <li>Go to "Bot" section and click "Reset Token" to get your bot token</li>
          <li>Enable "MESSAGE CONTENT INTENT" in Privileged Gateway Intents</li>
          <li>
            Invite the bot to your server using OAuth2 URL with these permissions:
            <ul>
              <li>Read Messages/View Channels</li>
              <li>Send Messages</li>
              <li>Read Message History</li>
            </ul>
          </li>
          <li>Paste the bot token above and save configuration</li>
          <li>Click "Start Bot" to activate</li>
        </ol>
      </div>

      {/* Available Commands */}
      <div className="commands-section">
        <h2>Available Commands</h2>

        <div className="command-list">
          <div className="command-item">
            <code>!tts search [filters]</code>
            <p>Search for voices with optional filters</p>
          </div>

          <div className="command-item">
            <code>!tts myvoice</code>
            <p>Show your current TTS voice and settings</p>
          </div>

          <div className="command-item">
            <code>!tts access</code>
            <p>Display current TTS access restrictions</p>
          </div>

          <div className="command-item">
            <code>!tts lookup &lt;voice_id&gt;</code>
            <p>Get details about a specific voice</p>
          </div>

          <div className="command-item">
            <code>!tts help</code>
            <p>Show help message with all commands</p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## IPC Handlers

**File:** `src/backend/core/ipc-handlers/discord-bot.ts`

```typescript
import { ipcMain } from 'electron';
import { DiscordBotService } from '../../services/discord-bot-service';
import { DiscordBotConfigRepository } from '../../database/repositories/discord-bot-config';

let botService: DiscordBotService | null = null;

export function registerDiscordBotHandlers() {
  const configRepo = new DiscordBotConfigRepository();

  // Get config
  ipcMain.handle('discord-bot:get-config', async () => {
    return configRepo.get();
  });

  // Save config
  ipcMain.handle('discord-bot:save-config', async (_, config) => {
    return configRepo.save(config);
  });

  // Start bot
  ipcMain.handle('discord-bot:start', async () => {
    if (!botService) {
      botService = new DiscordBotService();
    }
    return botService.start();
  });

  // Stop bot
  ipcMain.handle('discord-bot:stop', async () => {
    if (botService) {
      const result = await botService.stop();
      botService = null;
      return result;
    }
    return { success: true };
  });

  // Get status
  ipcMain.handle('discord-bot:get-status', async () => {
    if (botService) {
      return {
        success: true,
        status: botService.getStatus()
      };
    }
    return {
      success: true,
      status: { connected: false }
    };
  });

  console.log('[IPC] Discord bot handlers registered');
}
```

---

## Migration

Add to `src/backend/database/migrations.ts`:

```typescript
// Create discord_bot_config table
db.exec(`
  CREATE TABLE IF NOT EXISTS discord_bot_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bot_token TEXT NOT NULL,
    guild_id TEXT,
    command_prefix TEXT NOT NULL DEFAULT '!tts',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (id = 1)
  )
`);
```

---

## Package Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "discord.js": "^14.14.1"
  }
}
```

---

## Implementation Steps

1. **Install discord.js** - `npm install discord.js`
2. **Add Migration** - Create `discord_bot_config` table
3. **Create Repository** - `discord-bot-config.ts`
4. **Create Services** - `voice-search-service.ts`, `discord-bot-service.ts`, `discord-command-handler.ts`
5. **Create IPC Handlers** - `discord-bot.ts`
6. **Create Frontend Screen** - `discord-bot.tsx`
7. **Update Menu** - Add "Discord TTS Bot" navigation
8. **Testing** - Test all commands in Discord

---

## Testing Checklist

- [ ] Bot connects successfully with valid token
- [ ] `!tts search` returns filtered voice results
- [ ] `!tts myvoice` shows correct user voice
- [ ] `!tts access` displays current restrictions
- [ ] `!tts lookup` shows voice details
- [ ] `!tts help` displays command list
- [ ] Pagination works for large result sets
- [ ] Error handling for invalid commands
- [ ] Bot reconnects after disconnect
- [ ] Configuration saves correctly

---

## Summary

| Aspect | Details |
|--------|---------|
| **Files Created** | 4 backend + 1 frontend |
| **Database Tables** | 1 table (bot config) |
| **IPC Handlers** | 5 handlers |
| **Dependencies** | discord.js |
| **Commands** | 5 bot commands |
| **Estimated Time** | 12-16 hours |
| **Risk Level** | Medium |

---

**Status:** 📋 Documentation Complete  
**Next Step:** Install dependencies, then implement  
**Priority:** Medium  
**Dependencies:** Discord.js library

---

**Last Updated:** October 2025  
**Author:** AI Code Analysis  
**Version:** 1.0
