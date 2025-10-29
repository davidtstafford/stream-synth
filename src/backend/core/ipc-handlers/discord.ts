/**
 * Discord IPC Handlers
 * 
 * Handles Discord webhook operations via IPC using centralized IPC Framework:
 * - Test webhook connection
 * - Post voice catalogue
 * - Delete messages
 * - Auto-update catalogue
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { ipcRegistry } from '../ipc/ipc-framework';
import { SettingsRepository } from '../../database/repositories/settings';
import { VoicesRepository } from '../../database/repositories/voices';

const settingsRepo = new SettingsRepository();
const voicesRepo = new VoicesRepository();

export function setupDiscordHandlers(): void {
  // ===== Discord: Connection & Testing =====
  ipcRegistry.register<string, void>(
    'discord:test-webhook',
    {
      validate: (webhookUrl) => webhookUrl ? null : 'Webhook URL is required',
      execute: async (webhookUrl) => {
        console.log('[Discord] Testing webhook connection...');
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: '✅ **Stream Synth Test** - Webhook connection successful!'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Discord API error: ${response.status} ${errorText}`);
        }
      }
    }
  );
  // ===== Discord: Voice Catalogue =====
  ipcRegistry.register<void, { catalogue: string }>(
    'discord:generate-voice-catalogue',
    {
      execute: async () => {
        console.log('[Discord] Generating voice catalogue...');
        const grouped = voicesRepo.getGroupedVoices();
        const stats = voicesRepo.getStats();

        let catalogue = `**🎤 TTS Voice Catalogue** (${stats.available} voices available)\n\n`;
        catalogue += `Use the command: \`~setmyvoice <ID>\` to select your voice\n`;
        catalogue += `Example: \`~setmyvoice 22\` for Eddy\n\n`;

        const groupKeys = Array.from(grouped.keys()).sort();

        for (const groupKey of groupKeys) {
          const voices = grouped.get(groupKey);
          if (!voices || voices.length === 0) continue;

          catalogue += `**${groupKey}**\n`;
          const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);

          for (const voice of sortedVoices) {
            const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
            const idStr = String(voice.numeric_id).padStart(3, '0');
            catalogue += `\`${idStr}\` │ ${voice.name} ${gender}\n`;
          }

          catalogue += '\n';
        }

        return { catalogue };
      }
    }
  );

  // Discord: Post Voice Catalogue
  ipcRegistry.register<string, { messageId: string }>(
    'discord:post-voice-catalogue',
    {
      validate: (webhookUrl) => webhookUrl ? null : 'Webhook URL is required',
      execute: async (webhookUrl) => {
        console.log('[Discord] Starting voice catalogue post...');

        const grouped = voicesRepo.getGroupedVoices();
        const stats = voicesRepo.getStats();

        const fields: any[] = [];
        const groupKeys = Array.from(grouped.keys()).sort();

        for (const groupKey of groupKeys) {
          const voices = grouped.get(groupKey);
          if (!voices || voices.length === 0) continue;

          let value = '';
          const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);

          for (const voice of sortedVoices) {
            const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
            const idStr = String(voice.numeric_id).padStart(3, '0');
            const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;

            if (value.length + line.length > 1020) {
              if (value.length > 0) {
                const existingParts = fields.filter((f: any) => f.name.startsWith(groupKey));
                const partNum = existingParts.length + 1;
                fields.push({
                  name: `${groupKey} (Part ${partNum})`,
                  value: value.trim(),
                  inline: false
                });
                value = '';
              }
            }

            value += line;
          }

          if (value.length > 0) {
            const existingParts = fields.filter((f: any) => f.name.startsWith(groupKey));
            const fieldName = existingParts.length > 0 ? `${groupKey} (Part ${existingParts.length + 1})` : groupKey;
            fields.push({
              name: fieldName,
              value: value.trim(),
              inline: false
            });
          }

          if (fields.length >= 25) break;
        }

        const embed = {
          title: '🎤 TTS Voice Catalogue',
          description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
          color: 0x5865F2,
          fields: fields,
          footer: {
            text: 'Stream Synth • Voice IDs are permanent'
          },
          timestamp: new Date().toISOString()
        };

        const webhookUrlWithWait = webhookUrl + '?wait=true';
        const response = await fetch(webhookUrlWithWait, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed] })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Discord API error: ${response.status} ${errorText}`);
        }

        const messageData = await response.json();
        console.log('[Discord] Successfully posted voice catalogue, message ID:', messageData.id);

        const discordSettingsStr = settingsRepo.get('discord_settings');
        if (discordSettingsStr) {
          const discordSettings = JSON.parse(discordSettingsStr);
          discordSettings.lastMessageId = messageData.id;
          settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
        }

        return { messageId: messageData.id };
      }
    }
  );
  // Discord: Delete Webhook Messages
  ipcRegistry.register<string, { deletedCount: number; totalMessages: number }>(
    'discord:delete-webhook-messages',
    {
      validate: (webhookUrl) => webhookUrl ? null : 'Webhook URL is required',
      execute: async (webhookUrl) => {
        console.log('[Discord] Deleting previous webhook messages...');

        const urlMatch = webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
        if (!urlMatch) {
          throw new Error('Invalid webhook URL format');
        }

        const [, webhookId, webhookToken] = urlMatch;

        const messagesUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages`;
        const messagesResponse = await fetch(messagesUrl);

        if (!messagesResponse.ok) {
          const errorText = await messagesResponse.text();
          throw new Error(`Failed to fetch messages: ${messagesResponse.status} ${errorText}`);
        }

        const messages = await messagesResponse.json();
        console.log('[Discord] Found', messages.length, 'messages to delete');

        let deletedCount = 0;
        for (const message of messages) {
          try {
            const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${message.id}`;
            const deleteResponse = await fetch(deleteUrl, {
              method: 'DELETE'
            });

            if (deleteResponse.ok || deleteResponse.status === 404) {
              deletedCount++;
              console.log('[Discord] Deleted message', message.id);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err: any) {
            console.error('[Discord] Error deleting message', message.id, ':', err.message);
          }
        }

        console.log('[Discord] Deleted', deletedCount, 'of', messages.length, 'messages');
        return { deletedCount, totalMessages: messages.length };
      }
    }
  );
  // Discord: Auto-Update Catalogue (Delete + Post in one operation)
  ipcRegistry.register<string, { deletedCount: number; messageId: string }>(
    'discord:auto-update-catalogue',
    {
      validate: (webhookUrl) => webhookUrl ? null : 'Webhook URL is required',
      execute: async (webhookUrl) => {
        console.log('[Discord] Auto-updating voice catalogue...');

        // Step 1: Delete previous messages
        const urlMatch = webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
        if (!urlMatch) {
          throw new Error('Invalid webhook URL format');
        }

        const [, webhookId, webhookToken] = urlMatch;
        const messagesUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages`;
        const messagesResponse = await fetch(messagesUrl);

        if (!messagesResponse.ok) {
          const errorText = await messagesResponse.text();
          throw new Error(`Failed to fetch messages: ${messagesResponse.status} ${errorText}`);
        }

        const messages = await messagesResponse.json();
        let deletedCount = 0;

        for (const message of messages) {
          try {
            const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${message.id}`;
            const deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });

            if (deleteResponse.ok || deleteResponse.status === 404) {
              deletedCount++;
              console.log('[Discord] Deleted message', message.id);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err: any) {
            console.error('[Discord] Error deleting message', message.id, ':', err.message);
          }
        }

        console.log('[Discord] Deleted', deletedCount, 'messages');

        // Wait a moment for Discord API
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Post new catalogue
        console.log('[Discord] Posting updated catalogue...');
        const grouped = voicesRepo.getGroupedVoices();
        const stats = voicesRepo.getStats();

        const fields: any[] = [];
        const groupKeys = Array.from(grouped.keys()).sort();

        for (const groupKey of groupKeys) {
          const voices = grouped.get(groupKey);
          if (!voices || voices.length === 0) continue;

          let value = '';
          const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);

          for (const voice of sortedVoices) {
            const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
            const idStr = String(voice.numeric_id).padStart(3, '0');
            const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;

            if (value.length + line.length > 1020) {
              if (value.length > 0) {
                const existingParts = fields.filter(f => f.name.startsWith(groupKey));
                const partNum = existingParts.length + 1;
                fields.push({
                  name: `${groupKey} (Part ${partNum})`,
                  value: value.trim(),
                  inline: false
                });
                value = '';
              }
            }

            value += line;
          }

          if (value.length > 0) {
            const existingParts = fields.filter(f => f.name.startsWith(groupKey));
            const fieldName = existingParts.length > 0 ? `${groupKey} (Part ${existingParts.length + 1})` : groupKey;
            fields.push({
              name: fieldName,
              value: value.trim(),
              inline: false
            });
          }

          if (fields.length >= 25) break;
        }

        const embed = {
          title: '🎤 TTS Voice Catalogue',
          description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
          color: 0x5865F2,
          fields: fields,
          footer: {
            text: 'Stream Synth • Voice IDs are permanent • Auto-updated'
          },
          timestamp: new Date().toISOString()
        };

        const webhookUrlWithWait = webhookUrl + '?wait=true';
        const response = await fetch(webhookUrlWithWait, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ embeds: [embed] })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Discord API error: ${response.status} ${errorText}`);
        }

        const messageData = await response.json();
        console.log('[Discord] Auto-update completed, new message ID:', messageData.id);

        // Save message ID for future deletion
        const discordSettingsStr = settingsRepo.get('discord_settings');
        if (discordSettingsStr) {
          const discordSettings = JSON.parse(discordSettingsStr);
          discordSettings.lastMessageId = messageData.id;
          settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
        }

        return { deletedCount, messageId: messageData.id };
      }
    }
  );
}
