/**
 * Startup Tasks Module
 * 
 * Handles initialization on app startup:
 * - TTS service initialization
 * - Voice synchronization
 * - Discord voice catalogue posting
 */

import { SettingsRepository } from '../../database/repositories/settings';
import { VoicesRepository } from '../../database/repositories/voices';
import { SessionsRepository } from '../../database/repositories/sessions';
import { ChannelPointGrantsRepository } from '../../database/repositories/channel-point-grants';
import { initializeTTS } from './tts';
import { VoiceSyncService } from '../../services/tts/voice-sync';
import { TwitchSubscriptionsService } from '../../services/twitch-subscriptions';

const settingsRepo = new SettingsRepository();
const voicesRepo = new VoicesRepository();
const sessionsRepo = new SessionsRepository();
const channelPointGrantsRepo = new ChannelPointGrantsRepository();
const twitchSubsService = new TwitchSubscriptionsService();

export async function runStartupTasks(): Promise<void> {
  try {
    console.log('[Startup] Running startup tasks...');

    // Cleanup expired channel point grants (keep expired records for 7 days)
    console.log('[Startup] Cleaning up expired channel point grants...');
    try {
      const deletedCount = channelPointGrantsRepo.cleanupExpiredGrants(7);
      if (deletedCount > 0) {
        console.log(`[Startup] Cleaned up ${deletedCount} expired channel point grants`);
      } else {
        console.log('[Startup] No expired grants to clean up');
      }
    } catch (err: any) {
      console.error('[Startup] Error cleaning up expired grants:', err);
    }

    // Schedule periodic cleanup every 5 minutes
    setInterval(() => {
      try {
        const deletedCount = channelPointGrantsRepo.cleanupExpiredGrants(7);
        if (deletedCount > 0) {
          console.log(`[Background] Cleaned up ${deletedCount} expired channel point grants`);
        }
      } catch (err: any) {
        console.error('[Background] Error cleaning up expired grants:', err);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Initialize TTS services
    const ttsManager = await initializeTTS();

    // Create voice sync service
    const voiceSyncService = new VoiceSyncService(voicesRepo);

    // Sync WebSpeech voices if needed (enabled and not yet synced)
    console.log('[Startup] Checking WebSpeech voice sync status...');
    if (voiceSyncService.needsSync('webspeech')) {
      console.log('[Startup] WebSpeech voices need syncing, requesting from renderer...');
      // The renderer will send voices via IPC when available
    } else {
      console.log('[Startup] WebSpeech voices already synced');
    }

    // Sync Azure voices if enabled and needed
    console.log('[Startup] Checking Azure voice sync status...');
    if (voiceSyncService.needsSync('azure')) {
      console.log('[Startup] Azure voices need syncing (not implemented in this phase)');
      // Azure sync happens when user enables it and provides credentials
    } else {
      console.log('[Startup] Azure voices already synced or not enabled');
    }

    // Sync Twitch subscriptions
    console.log('[Startup] Syncing Twitch subscriptions...');
    try {
      const currentSession = sessionsRepo.getCurrentSession();
      if (currentSession) {
        const result = await twitchSubsService.syncSubscriptionsFromTwitch(
          currentSession.channel_id,
          currentSession.user_id
        );
        if (result.success) {
          console.log('[Startup] Synced', result.count, 'subscriptions from Twitch');
        } else {
          console.warn('[Startup] Failed to sync subscriptions:', result.error);
        }
      } else {
        console.log('[Startup] No active session found, skipping subscription sync');
      }
    } catch (err: any) {
      console.error('[Startup] Error syncing subscriptions:', err);
    }

    // Check if Discord auto-post is enabled
    const discordSettingsStr = settingsRepo.get('discord_settings');
    if (!discordSettingsStr) {
      console.log('[Startup] No Discord settings found, skipping auto-post');
      return;
    }

    const discordSettings = JSON.parse(discordSettingsStr);
    if (!discordSettings.autoPostOnStartup || !discordSettings.webhookUrl) {
      console.log('[Startup] Discord auto-post not enabled or no webhook URL');
      return;
    }

    console.log('[Startup] Discord auto-post enabled, updating voice catalogue...');

    // Wait a moment for everything to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract webhook ID and token from URL
    const urlMatch = discordSettings.webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
    if (!urlMatch) {
      console.error('[Startup] Invalid webhook URL format');
      return;
    }

    const [, webhookId, webhookToken] = urlMatch;
    console.log('[Startup] Webhook ID:', webhookId);

    // Delete old message if we have the ID stored
    if (discordSettings.lastMessageId) {
      try {
        console.log('[Startup] Deleting previous message:', discordSettings.lastMessageId);
        const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${discordSettings.lastMessageId}`;
        const deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });

        if (deleteResponse.ok || deleteResponse.status === 404) {
          console.log('[Startup] Successfully deleted previous message');
        } else {
          console.error('[Startup] Failed to delete message:', deleteResponse.status);
        }
      } catch (err: any) {
        console.error('[Startup] Error deleting previous message:', err.message);
      }

      // Wait a bit after deletion
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('[Startup] No previous message ID stored, skipping deletion');
    }

    // Wait before posting
    await new Promise(resolve => setTimeout(resolve, 300));

    // Post new catalogue
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
        text: 'Stream Synth • Voice IDs are permanent • Auto-updated on startup'
      },
      timestamp: new Date().toISOString()
    };

    // Add ?wait=true to get the message data in response
    const webhookUrlWithWait = discordSettings.webhookUrl + '?wait=true';

    const response = await fetch(webhookUrlWithWait, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (response.ok) {
      const messageData = await response.json();
      console.log('[Startup] Posted message ID:', messageData.id);

      // Save the message ID for future deletion
      discordSettings.lastMessageId = messageData.id;
      settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
      console.log('[Startup] Saved message ID for future deletion');
    } else {
      console.error('[Startup] Failed to post message:', response.status);
    }

    console.log('[Startup] Discord voice catalogue auto-posted successfully');
  } catch (error: any) {
    console.error('[Startup] Error in startup tasks:', error);
  }
}
