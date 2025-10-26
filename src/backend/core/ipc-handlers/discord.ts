/**
 * Discord IPC Handlers
 * 
 * Handles Discord webhook operations via IPC:
 * - Test webhook connection
 * - Post voice catalogue
 * - Delete messages
 * - Auto-update catalogue
 */

import { ipcMain } from 'electron';
import { SettingsRepository } from '../../database/repositories/settings';
import { VoicesRepository } from '../../database/repositories/voices';

const settingsRepo = new SettingsRepository();
const voicesRepo = new VoicesRepository();

export function setupDiscordHandlers(): void {
  // Discord: Test Webhook
  ipcMain.handle('discord:test-webhook', async (event, webhookUrl: string) => {
    try {
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

      return { success: true };
    } catch (error: any) {
      console.error('[Discord] Error testing webhook:', error);
      return { success: false, error: error.message };
    }
  });

  // Discord: Generate Voice Catalogue
  ipcMain.handle('discord:generate-voice-catalogue', async () => {
    try {
      const grouped = voicesRepo.getGroupedVoices();
      const stats = voicesRepo.getStats();

      let catalogue = `**🎤 TTS Voice Catalogue** (${stats.available} voices available)\n\n`;
      catalogue += `Use the command: \`~setmyvoice <ID>\` to select your voice\n`;
      catalogue += `Example: \`~setmyvoice 22\` for Eddy\n\n`;

      // Sort group keys for consistent ordering
      const groupKeys = Array.from(grouped.keys()).sort();

      for (const groupKey of groupKeys) {
        const voices = grouped.get(groupKey);
        if (!voices || voices.length === 0) continue;

        catalogue += `**${groupKey}**\n`;

        // Sort voices by numeric ID
        const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);

        for (const voice of sortedVoices) {
          const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
          const idStr = String(voice.numeric_id).padStart(3, '0');
          catalogue += `\`${idStr}\` │ ${voice.name} ${gender}\n`;
        }

        catalogue += '\n';
      }

      return { success: true, catalogue };
    } catch (error: any) {
      console.error('[Discord] Error generating voice catalogue:', error);
      return { success: false, error: error.message, catalogue: '' };
    }
  });

  // Discord: Post Voice Catalogue
  ipcMain.handle('discord:post-voice-catalogue', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Starting voice catalogue post to:', webhookUrl);

      const grouped = voicesRepo.getGroupedVoices();
      const stats = voicesRepo.getStats();

      console.log('[Discord] Got', stats.total, 'voices in', grouped.size, 'groups');

      // Create embed fields for each language group
      const fields: any[] = [];
      const groupKeys = Array.from(grouped.keys()).sort();

      for (const groupKey of groupKeys) {
        const voices = grouped.get(groupKey);
        if (!voices || voices.length === 0) continue;

        console.log('[Discord] Processing group:', groupKey);

        let value = '';
        const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);

        for (const voice of sortedVoices) {
          const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
          const idStr = String(voice.numeric_id).padStart(3, '0');
          const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;

          // Discord field value limit is 1024 characters
          if (value.length + line.length > 1020) {
            // If this field is getting too long, add what we have and start a new field
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

        // Discord has a 25 field limit per embed
        if (fields.length >= 25) {
          console.log('[Discord] Reached 25 field limit, stopping at', fields.length, 'fields');
          break;
        }
      }

      console.log('[Discord] Created', fields.length, 'embed fields');

      const embed = {
        title: '🎤 TTS Voice Catalogue',
        description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
        color: 0x5865F2, // Discord blurple
        fields: fields,
        footer: {
          text: 'Stream Synth • Voice IDs are permanent'
        },
        timestamp: new Date().toISOString()
      };

      console.log('[Discord] Posting to webhook...');

      // Add ?wait=true to get the message data in response
      const webhookUrlWithWait = webhookUrl + '?wait=true';

      const response = await fetch(webhookUrlWithWait, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] })
      });

      console.log('[Discord] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Discord] Error response:', errorText);
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      // Get the message ID from the response and save it
      const messageData = await response.json();
      console.log('[Discord] Successfully posted voice catalogue, message ID:', messageData.id);

      // Save the message ID in settings for future deletion
      const discordSettingsStr = settingsRepo.get('discord_settings');
      if (discordSettingsStr) {
        const discordSettings = JSON.parse(discordSettingsStr);
        discordSettings.lastMessageId = messageData.id;
        settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
        console.log('[Discord] Saved message ID for future deletion');
      }

      return { success: true, messageId: messageData.id };
    } catch (error: any) {
      console.error('[Discord] Error posting voice catalogue:', error);
      return { success: false, error: error.message };
    }
  });

  // Discord: Delete Webhook Messages
  ipcMain.handle('discord:delete-webhook-messages', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Deleting previous webhook messages...');

      // Extract webhook ID and token from URL
      // Format: https://discord.com/api/webhooks/{webhook.id}/{webhook.token}
      const urlMatch = webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
      if (!urlMatch) {
        throw new Error('Invalid webhook URL format');
      }

      const [, webhookId, webhookToken] = urlMatch;

      // Get all messages from this webhook (limited to last 100)
      const messagesUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages`;
      const messagesResponse = await fetch(messagesUrl);

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error('[Discord] Error fetching messages:', errorText);
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
      }

      const messages = await messagesResponse.json();
      console.log('[Discord] Found', messages.length, 'messages to delete');

      // Delete each message
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
          } else {
            console.error('[Discord] Failed to delete message', message.id, ':', deleteResponse.status);
          }

          // Rate limiting: wait a bit between deletions
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error('[Discord] Error deleting message', message.id, ':', err.message);
        }
      }

      console.log('[Discord] Deleted', deletedCount, 'of', messages.length, 'messages');
      return { success: true, deletedCount, totalMessages: messages.length };
    } catch (error: any) {
      console.error('[Discord] Error deleting webhook messages:', error);
      return { success: false, error: error.message };
    }
  });

  // Discord: Auto-Update Catalogue
  ipcMain.handle('discord:auto-update-catalogue', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Auto-updating voice catalogue...');

      // Step 1: Delete previous messages
      const deleteResult = await ipcMain.emit('discord:delete-webhook-messages', event, webhookUrl);
      console.log('[Discord] Deletion step completed');

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

      const response = await fetch(webhookUrl, {
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

      console.log('[Discord] Auto-update completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[Discord] Error auto-updating catalogue:', error);
      return { success: false, error: error.message };
    }
  });
}
