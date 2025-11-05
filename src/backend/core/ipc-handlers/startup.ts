import { BrowserWindow } from 'electron';
import { SettingsRepository } from '../../database/repositories/settings';
import { VoicesRepository } from '../../database/repositories/voices';
import { SessionsRepository } from '../../database/repositories/sessions';
import { ChannelPointGrantsRepository } from '../../database/repositories/channel-point-grants';
import { initializeTTS } from './tts';
import { VoiceSyncService } from '../../services/tts/voice-sync';
import { TwitchRoleSyncService } from '../../services/twitch-role-sync';
import { DynamicPollingManager } from '../../services/dynamic-polling-manager';
import { initializeEventSubIntegration } from '../../services/eventsub-integration';

const settingsRepo = new SettingsRepository();
const voicesRepo = new VoicesRepository();
const sessionsRepo = new SessionsRepository();
const channelPointGrantsRepo = new ChannelPointGrantsRepository();
const roleSyncService = new TwitchRoleSyncService();

// Global polling manager instance
let pollingManager: DynamicPollingManager | null = null;

export async function runStartupTasks(mainWindow?: BrowserWindow | null): Promise<void> {
  try {
    console.log('[Startup] Running startup tasks...');
    
    // Initialize EventSub integration if mainWindow is available
    if (mainWindow) {
      console.log('[Startup] Initializing EventSub integration...');
      initializeEventSubIntegration(mainWindow);
    }

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
    }    // Schedule periodic cleanup every 5 minutes
    setInterval(() => {
      try {
        const deletedCount = channelPointGrantsRepo.cleanupExpiredGrants(7);
        if (deletedCount > 0) {
          console.log(`[Background] Cleaned up ${deletedCount} expired channel point grants`);
        }
      } catch (err: any) {
        console.error('[Background] Error cleaning up expired grants:', err);
      }    }, 5 * 60 * 1000); // 5 minutes

    // Initialize dynamic polling manager for Twitch API requests
    console.log('[Startup] Initializing dynamic polling manager...');
    pollingManager = new DynamicPollingManager();
    await pollingManager.initialize();

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
    }    // Sync Twitch data (subscriptions, VIPs, moderators)
    console.log('[Startup] Syncing Twitch subscriptions, VIPs, and moderators...');
    try {
      const currentSession = sessionsRepo.getCurrentSession();
      if (currentSession) {
        const result = await roleSyncService.syncAllRoles(
          currentSession.channel_id,
          currentSession.user_id,
          'startup'
        );

        if (result.success) {
          console.log(
            `[Startup] ✓ Synced all roles: ${result.subCount} subs, ` +
            `${result.vipCount} VIPs, ${result.modCount} mods`
          );
        } else {
          console.warn('[Startup] Role sync completed with errors:', result.errors);
        }
      } else {
        console.log('[Startup] No active session found, skipping Twitch data sync');
      }
    } catch (err: any) {
      console.error('[Startup] Error syncing Twitch data:', err);
    }

    console.log('[Startup] All startup tasks completed successfully');
  } catch (error: any) {
    console.error('[Startup] Error in startup tasks:', error);
  }
}

/**
 * Get the global polling manager instance
 */
export function getPollingManager(): DynamicPollingManager | null {
  return pollingManager;
}
