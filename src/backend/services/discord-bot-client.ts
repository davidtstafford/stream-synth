/**
 * Discord Bot Client Service
 * 
 * Manages the Discord bot lifecycle including:
 * - Bot initialization and login
 * - Connection state management
 * - Error handling and reconnection
 * - Command registration
 * - Event listener setup
 */

import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import { registerSlashCommands } from './discord-commands';
import { setupInteractionHandlers } from './discord-interactions';

export interface BotStatus {
  connected: boolean;
  guildId?: string;
  channelId?: string;
  botId?: string;
  latency?: number;
  uptime?: number;
}

let client: Client | null = null;
let botStatus: BotStatus = { connected: false };

/**
 * Initialize and start the Discord bot
 */
export async function initializeDiscordBot(botToken: string): Promise<BotStatus> {
  try {
    if (client?.isReady()) {
      console.log('[Discord Bot] Bot already connected, returning current status');
      // Make sure status reflects the actual connection state
      botStatus = {
        connected: true,
        botId: client.user?.id,
        latency: client.ws.ping
      };
      return botStatus;
    }

    console.log('[Discord Bot] Initializing Discord bot client...');

    // Create bot client with minimal intents
    // For slash commands, we only need Guilds intent
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds  // Only intent needed for slash commands
      ],
      failIfNotExists: false
    });

    // Setup event listeners
    setupBotEventListeners(client);

    // Setup interaction handlers
    setupInteractionHandlers(client);

    // Login to Discord
    console.log('[Discord Bot] Logging in to Discord...');
    await client.login(botToken);

    // Wait for bot to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bot login timeout after 15 seconds'));
      }, 15000);

      client!.once('ready', () => {
        clearTimeout(timeout);
        
        // Update status immediately when ready fires
        botStatus = {
          connected: true,
          botId: client!.user?.id,
          latency: client!.ws.ping
        };
        
        console.log('[Discord Bot] ✓ Bot status updated to connected');
        resolve();
      });
    });

    console.log('[Discord Bot] ✓ Bot connected successfully');
    console.log('[Discord Bot] Bot ID:', client.user?.id);
    console.log('[Discord Bot] Bot Tag:', client.user?.tag);

    return botStatus;
  } catch (err: any) {
    console.error('[Discord Bot] Error initializing bot:', err.message);
    botStatus = { connected: false };
    throw err;
  }
}

/**
 * Register slash commands for a specific guild
 */
export async function registerGuildCommands(guildId: string, botToken: string): Promise<void> {
  try {
    if (!client?.user) {
      throw new Error('Bot not connected');
    }

    console.log('[Discord Bot] Registering commands for guild:', guildId);

    const commands = registerSlashCommands();

    const rest = new REST({ version: '10' }).setToken(botToken);

    const result = await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: commands.map((cmd: any) => cmd.toJSON())
    });

    console.log('[Discord Bot] ✓ Registered', Array.isArray(result) ? result.length : 0, 'commands');

    botStatus.guildId = guildId;
  } catch (err: any) {
    console.error('[Discord Bot] Error registering commands:', err.message);
    throw err;
  }
}

/**
 * Register global slash commands
 */
export async function registerGlobalCommands(botToken: string): Promise<void> {
  try {
    if (!client?.user) {
      throw new Error('Bot not connected');
    }

    console.log('[Discord Bot] Registering global commands...');

    const commands = registerSlashCommands();

    const rest = new REST({ version: '10' }).setToken(botToken);

    const result = await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map((cmd: any) => cmd.toJSON())
    });

    console.log('[Discord Bot] ✓ Registered', Array.isArray(result) ? result.length : 0, 'global commands');
  } catch (err: any) {
    console.error('[Discord Bot] Error registering global commands:', err.message);
    throw err;
  }
}

/**
 * Setup bot event listeners
 */
function setupBotEventListeners(botClient: Client): void {
  botClient.on('ready', () => {
    console.log('[Discord Bot] Event: Bot ready');
    console.log('[Discord Bot] Logged in as:', botClient.user?.tag);
  });

  botClient.on('error', (error: Error) => {
    console.error('[Discord Bot] Error event:', error.message);
  });

  botClient.on('warn', (message: string) => {
    console.warn('[Discord Bot] Warning:', message);
  });

  botClient.on('disconnect', () => {
    console.log('[Discord Bot] Bot disconnected');
    botStatus.connected = false;
  });

  botClient.on('resumed', () => {
    console.log('[Discord Bot] Bot connection resumed');
    botStatus.connected = true;
  });

  // Update latency
  botClient.on('ping', () => {
    botStatus.latency = botClient.ws.ping;
  });
}

/**
 * Disconnect the bot
 */
export async function disconnectDiscordBot(): Promise<void> {
  try {
    if (client) {
      console.log('[Discord Bot] Disconnecting bot...');
      await client.destroy();
      client = null;
      botStatus = { connected: false };
      console.log('[Discord Bot] ✓ Bot disconnected');
    }
  } catch (err: any) {
    console.error('[Discord Bot] Error disconnecting bot:', err.message);
    throw err;
  }
}

/**
 * Get current bot status
 */
export function getBotStatus(): BotStatus {
  return {
    ...botStatus,
    latency: client?.ws.ping,
    uptime: client?.uptime ?? undefined
  };
}

/**
 * Get bot client instance
 */
export function getBotClient(): Client | null {
  return client;
}

/**
 * Test bot connection
 */
export async function testBotConnection(): Promise<{ success: boolean; message: string }> {
  try {
    if (!client?.isReady()) {
      return { success: false, message: 'Bot is not connected' };
    }

    const status = getBotStatus();
    return {
      success: true,
      message: `Bot connected as ${client.user?.tag} (latency: ${status.latency}ms)`
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
