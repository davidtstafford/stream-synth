/**
 * Discord Bot IPC Handlers
 * 
 * Provides IPC endpoints for the frontend to:
 * - Start/stop the Discord bot
 * - Test bot connection
 * - Get bot status
 * - Register commands
 */

import { ipcRegistry } from '../ipc/ipc-framework';
import {
  initializeDiscordBot,
  disconnectDiscordBot,
  getBotStatus,
  testBotConnection,
  registerGlobalCommands,
  registerGuildCommands
} from '../../services/discord-bot-client';
import { DiscordSettingsRepository } from '../../database/repositories/discord-settings';
import { encryptToken, decryptToken, isEncrypted, hashToken } from '../../services/crypto-utils';

const discordSettingsRepo = new DiscordSettingsRepository();

export function setupDiscordBotHandlers(): void {
  // ===== Discord Bot: Connection Management =====
  ipcRegistry.register<string, { success: boolean; message: string }>(
    'discord:start-bot',
    {
      validate: (botToken) => botToken ? null : 'Bot token is required',
      execute: async (botToken) => {
        console.log('[Discord Bot IPC] Starting bot...');
        try {
          const status = await initializeDiscordBot(botToken);

          // Encrypt and save token to database
          const encryptedToken = encryptToken(botToken);
          discordSettingsRepo.updateBotToken(encryptedToken);
          discordSettingsRepo.updateBotId(status.botId ?? null);
          discordSettingsRepo.updateBotStatus('connected');
          discordSettingsRepo.updateLastConnectedAt();

          console.log(`[Discord Bot IPC] Bot connected: ${hashToken(botToken)}`);

          // Register global commands
          await registerGlobalCommands(botToken);

          return {
            success: true,
            message: `✓ Bot connected as ${status.botId}`
          };
        } catch (err: any) {
          discordSettingsRepo.updateBotStatus('failed');
          return {
            success: false,
            message: `Failed to start bot: ${err.message}`
          };
        }
      }
    }
  );

  // ===== Discord Bot: Disconnection =====
  ipcRegistry.register<void, { success: boolean; message: string }>(
    'discord:stop-bot',
    {
      execute: async () => {
        console.log('[Discord Bot IPC] Stopping bot...');
        try {
          await disconnectDiscordBot();

          // Update database
          discordSettingsRepo.updateBotStatus('disconnected');
          discordSettingsRepo.updateLastDisconnectedAt();

          return {
            success: true,
            message: '✓ Bot disconnected successfully'
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Failed to stop bot: ${err.message}`
          };
        }
      }
    }
  );

  // ===== Discord Bot: Get Status =====
  ipcRegistry.register<void, any>(
    'discord:get-status',
    {
      execute: async () => {
        const status = getBotStatus();
        console.log('[Discord Bot IPC] Getting bot status:', status);
        return status;
      }
    }
  );

  // ===== Discord Bot: Test Connection =====
  ipcRegistry.register<void, { success: boolean; message: string }>(
    'discord:test-connection',
    {
      execute: async () => {
        console.log('[Discord Bot IPC] Testing bot connection...');
        return await testBotConnection();
      }
    }
  );

  // ===== Discord Bot: Register Commands for Guild =====
  ipcRegistry.register<{ guildId: string; botToken: string }, { success: boolean; message: string }>(
    'discord:register-guild-commands',
    {
      validate: (params) => {
        if (!params.guildId) return 'Guild ID is required';
        if (!params.botToken) return 'Bot token is required';
        return null;
      },
      execute: async (params) => {
        console.log('[Discord Bot IPC] Registering commands for guild:', params.guildId);
        try {
          await registerGuildCommands(params.guildId, params.botToken);
          return {
            success: true,
            message: `✓ Commands registered for guild ${params.guildId}`
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Failed to register commands: ${err.message}`
          };
        }
      }
    }
  );

  // ===== Discord Bot: Get Settings =====
  ipcRegistry.register<void, any>(
    'discord:get-settings',
    {
      execute: async () => {
        console.log('[Discord Bot IPC] Getting Discord settings...');
        try {
          const settings = discordSettingsRepo.getSettings();
          console.log('[Discord Bot IPC] Raw settings from DB:', settings);
          
          // Decrypt token if present
          let decryptedToken = '';
          if (settings.bot_token) {
            try {
              decryptedToken = decryptToken(settings.bot_token);
              console.log('[Discord Bot IPC] Token decrypted successfully');
            } catch (err) {
              console.warn('[Discord Bot IPC] Failed to decrypt token:', err);
              // Token might be corrupted or not encrypted, return empty
              decryptedToken = '';
            }
          } else {
            console.log('[Discord Bot IPC] No token in database');
          }
          
          const result = {
            bot_token: decryptedToken,
            bot_id: settings.bot_id ?? null,
            bot_status: settings.bot_status ?? 'disconnected',
            auto_start_enabled: settings.auto_start_enabled === 1,
            last_connected_at: settings.last_connected_at ?? null
          };
          
          console.log('[Discord Bot IPC] Returning settings:', {
            ...result,
            bot_token: result.bot_token ? '***REDACTED***' : ''
          });
          
          return result;
        } catch (err: any) {
          console.error('[Discord Bot IPC] Error getting settings:', err);
          return {
            bot_token: '',
            bot_status: 'error',
            auto_start_enabled: false,
            error: err.message
          };
        }
      }
    }
  );

  // ===== Discord Bot: Save Settings =====
  ipcRegistry.register<any, { success: boolean; message: string }>(
    'discord:save-settings',
    {
      validate: (settings) => {
        if (!settings) return 'Settings object is required';
        return null;
      },
      execute: async (settings) => {
        console.log('[Discord Bot IPC] Saving Discord settings...');
        try {
          // If token is provided, encrypt and save it
          if (settings.bot_token) {
            const encryptedToken = encryptToken(settings.bot_token);
            discordSettingsRepo.updateBotToken(encryptedToken);
            console.log(`[Discord Bot IPC] Token updated: ${hashToken(settings.bot_token)}`);
          }
          
          // Update other settings
          if (settings.auto_start_enabled !== undefined) {
            discordSettingsRepo.updateAutoStartEnabled(settings.auto_start_enabled);
          }

          return {
            success: true,
            message: '✓ Settings saved successfully'
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Failed to save settings: ${err.message}`
          };
        }
      }
    }
  );
}
