/**
 * IPC Handlers for Chat Commands System
 * Phase 5: Chat Commands
 */

import { IPCRegistry, ipcRegistry } from '../ipc/ipc-framework';
import { twitchIRCService } from '../../services/twitch-irc';

export function setupChatCommandHandlers(): void {
  const commandHandler = twitchIRCService.getCommandHandler();

  /**
   * Get all command configurations
   */
  ipcRegistry.register<void, any[]>(
    'chat-commands:get-all',
    {
      execute: async () => {
        return commandHandler.getAllCommands();
      }
    }
  );

  /**
   * Update command configuration
   */
  ipcRegistry.register<{ commandName: string; updates: any }, void>(
    'chat-commands:update',
    {
      validate: (input) => {
        if (!input.commandName) return 'Command name is required';
        if (!input.updates) return 'Updates are required';
        return null;
      },
      execute: async (input) => {
        commandHandler.updateCommand(input.commandName, input.updates);
      }
    }
  );

  /**
   * Get usage statistics for commands
   */
  ipcRegistry.register<{ commandName?: string; limit?: number }, any[]>(
    'chat-commands:get-usage-stats',
    {
      execute: async (input) => {
        return commandHandler.getUsageStats(input?.commandName, input?.limit);
      }
    }
  );

  console.log('[IPC] Chat command handlers registered');
}
