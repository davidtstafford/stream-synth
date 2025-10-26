/**
 * TTS IPC Handlers
 * 
 * Handles Text-to-Speech operations via IPC:
 * - Voice testing and speaking
 * - Voice management and sync
 * - Provider configuration
 * - Settings management
 */

import { ipcMain, BrowserWindow } from 'electron';
import { getDatabase } from '../../database/connection';
import { VoicesRepository } from '../../database/repositories/voices';
import { TTSManager } from '../../services/tts/manager';
import { VoiceSyncService } from '../../services/tts/voice-sync';

let mainWindow: BrowserWindow | null = null;
let ttsManager: TTSManager | null = null;
let voiceSyncService: VoiceSyncService | null = null;

const voicesRepo = new VoicesRepository();

export function setMainWindowForTTS(window: BrowserWindow | null): void {
  mainWindow = window;
  if (ttsManager && window) {
    ttsManager.setMainWindow(window);
  }
}

async function initializeTTS() {
  if (!ttsManager) {
    const db = getDatabase();
    ttsManager = new TTSManager(db);
    await ttsManager.initialize();

    if (mainWindow) {
      ttsManager.setMainWindow(mainWindow);
    }
  }
  if (!voiceSyncService) {
    voiceSyncService = new VoiceSyncService(voicesRepo);
  }
  return ttsManager;
}

export function setupTTSHandlers(): void {
  // TTS: Test Voice
  ipcMain.handle('tts:test-voice', async (event, voiceId: string, options?: any, message?: string) => {
    try {
      console.log('[IPC] tts:test-voice called with voiceId:', voiceId, 'options:', options, 'message:', message);
      const manager = await initializeTTS();

      // Check voice ID prefix to determine provider (not the global settings.provider)
      if (voiceId.startsWith('webspeech_')) {
        console.log('[IPC] tts:test-voice - Web Speech voice, handled in renderer');
        return { success: true };
      }

      console.log('[IPC] tts:test-voice - Calling manager.testVoice() for Azure/Google voice');
      await manager.testVoice(voiceId, options, message);
      console.log('[IPC] tts:test-voice - Completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error testing voice:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Audio Finished
  ipcMain.handle('tts:audio-finished', async () => {
    try {
      const manager = await initializeTTS();
      manager.onAudioFinished();
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error handling audio-finished:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Get Voice Metadata
  ipcMain.handle('tts:get-voice-metadata', async (event, voiceId: string) => {
    try {
      console.log('[IPC] tts:get-voice-metadata called with voiceId:', voiceId);
      const voice = voicesRepo.getVoiceById(voiceId);

      if (!voice) {
        console.warn('[IPC] tts:get-voice-metadata - Voice not found:', voiceId);
        return { success: false, error: 'Voice not found' };
      }

      // Parse metadata to get voiceURI
      let voiceURI = voice.name;
      try {
        if (voice.metadata) {
          const meta = JSON.parse(voice.metadata);
          console.log('[IPC] tts:get-voice-metadata - Parsed metadata:', { voiceURI: meta.voiceURI, originalName: meta.originalName });
          voiceURI = meta.voiceURI || voice.name;
        } else {
          console.warn('[IPC] tts:get-voice-metadata - No metadata stored for voice');
        }
      } catch (e) {
        console.warn('[IPC] Failed to parse voice metadata:', e);
      }

      console.log('[IPC] tts:get-voice-metadata - Returning voiceURI:', voiceURI);
      return {
        success: true,
        voiceURI: voiceURI,
        name: voice.name,
        language: voice.language_code
      };
    } catch (error: any) {
      console.error('[IPC] Error getting voice metadata:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Speak
  ipcMain.handle('tts:speak', async (event, text: string, options?: any) => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();

      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true };
      }

      await manager.speak(text, options);
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error speaking:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Stop
  ipcMain.handle('tts:stop', async () => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();

      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true };
      }

      manager.stop();
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error stopping:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Get Settings
  ipcMain.handle('tts:get-settings', async () => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      return { success: true, settings };
    } catch (error: any) {
      console.error('[TTS] Error getting settings:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Save Settings
  ipcMain.handle('tts:save-settings', async (event, settings: any) => {
    try {
      const manager = await initializeTTS();
      await manager.saveSettings(settings);
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Get Providers
  ipcMain.handle('tts:get-providers', async () => {
    try {
      const manager = await initializeTTS();
      const providers = manager.getProviderNames();
      return { success: true, providers };
    } catch (error: any) {
      console.error('[TTS] Error getting providers:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Sync Voices
  ipcMain.handle('tts:sync-voices', async (event, provider: string, voices: any[]) => {
    try {
      await initializeTTS();
      console.log(`[TTS] Syncing voices for provider: ${provider}, count: ${voices.length}`);
      let count = 0;

      if (provider === 'webspeech' && voiceSyncService) {
        count = await voiceSyncService.syncWebSpeechVoices(voices);
      }

      const stats = voiceSyncService?.getStats();
      console.log(`[TTS] Voice sync complete. Stats:`, stats);

      return { success: true, count, stats };
    } catch (error: any) {
      console.error('[TTS] Error syncing voices:', error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Rescan Provider Immediately
  ipcMain.handle('provider:rescan-immediate', async (event, provider: string, voices: any[]) => {
    try {
      console.log(`[Provider] Immediate rescan for ${provider}...`);
      await initializeTTS();

      if (!voiceSyncService) {
        return { success: false, error: 'Voice sync service not initialized' };
      }

      const count = await voiceSyncService.rescanProviderImmediate(provider, voices);
      const stats = voiceSyncService.getStats();

      return {
        success: true,
        count,
        message: `${provider} voices rescanned: ${count} voices found`,
        stats
      };
    } catch (error: any) {
      console.error(`[Provider] Error rescanning ${provider}:`, error);
      return { success: false, error: error.message };
    }
  });

  // TTS: Check Sync Needed
  ipcMain.handle('provider:check-sync-needed', async (event, provider: string) => {
    try {
      await initializeTTS();

      if (!voiceSyncService) {
        return false;
      }

      const needsSync = voiceSyncService.needsSync(provider);
      console.log(`[Provider] ${provider} needs sync: ${needsSync}`);
      return needsSync;
    } catch (error: any) {
      console.error(`[Provider] Error checking sync status for ${provider}:`, error);
      return false;
    }
  });

  // TTS: Get Voices
  ipcMain.handle('tts:get-voices', async () => {
    try {
      const voices = voicesRepo.getAvailableVoices();
      return { success: true, voices };
    } catch (error: any) {
      console.error('[TTS] Error getting voices:', error);
      return { success: false, error: error.message, voices: [] };
    }
  });

  // TTS: Get Grouped Voices
  ipcMain.handle('tts:get-grouped-voices', async () => {
    try {
      const grouped = voicesRepo.getGroupedVoices();
      const result: Record<string, any[]> = {};

      grouped.forEach((voices, key) => {
        result[key] = voices;
      });

      return { success: true, grouped: result };
    } catch (error: any) {
      console.error('[TTS] Error getting grouped voices:', error);
      return { success: false, error: error.message, grouped: {} };
    }
  });

  // TTS: Get Voice Stats
  ipcMain.handle('tts:get-voice-stats', async () => {
    try {
      const stats = voicesRepo.getStats();
      return { success: true, stats };
    } catch (error: any) {
      console.error('[TTS] Error getting voice stats:', error);
      return { success: false, error: error.message, stats: null };
    }
  });

  // TTS: Get Voice by ID
  ipcMain.handle('tts:get-voice-by-id', async (event, numericId: number) => {
    try {
      const voice = voicesRepo.getVoiceByNumericId(numericId);
      return { success: true, voice };
    } catch (error: any) {
      console.error('[TTS] Error getting voice by ID:', error);
      return { success: false, error: error.message, voice: null };
    }
  });

  // TTS: Azure - Test Connection
  ipcMain.handle('azure:test-connection', async (event, credentials: { apiKey: string; region: string }) => {
    try {
      console.log('[Azure] Testing connection to region:', credentials.region);

      const { apiKey, region } = credentials;

      // Basic validation
      if (!apiKey || apiKey.trim().length < 32) {
        return {
          success: false,
          error: 'Invalid API key. Key should be at least 32 characters.'
        };
      }

      if (!region || region.trim().length === 0) {
        return {
          success: false,
          error: 'Region is required.'
        };
      }

      // Validate region against known Azure regions
      const validRegions = [
        'eastus', 'eastus2', 'westus', 'westus2', 'westus3',
        'centralus', 'northcentralus', 'southcentralus',
        'canadacentral', 'canadaeast', 'brazilsouth',
        'northeurope', 'westeurope', 'uksouth', 'ukwest',
        'francecentral', 'germanywestcentral', 'norwayeast',
        'switzerlandnorth', 'swedencentral', 'southeastasia',
        'eastasia', 'australiaeast', 'australiasoutheast',
        'japaneast', 'japanwest', 'koreacentral', 'koreasouth',
        'southafricanorth', 'southindia', 'centralindia',
        'westindia', 'uaenorth'
      ];

      if (!validRegions.includes(region.toLowerCase())) {
        return {
          success: false,
          error: `Invalid region: ${region}. Please select a valid Azure region.`
        };
      }

      // Initialize Azure provider and test connection
      const manager = await initializeTTS();
      const azureProvider = manager['providers'].get('azure');

      if (!azureProvider) {
        return {
          success: false,
          error: 'Azure provider not available'
        };
      }

      // Initialize provider with credentials
      await azureProvider.initialize({ apiKey, region });

      // Get voices to verify connection
      const voices = await azureProvider.getVoices();

      // Get preview voices (first 10)
      const previewVoices = voices.slice(0, 10).map((v: any) => ({
        name: v.name,
        language: v.languageName,
        gender: v.gender
      }));

      console.log('[Azure] Connection test successful, found', voices.length, 'voices');

      return {
        success: true,
        voiceCount: voices.length,
        previewVoices
      };
    } catch (error: any) {
      console.error('[Azure] Error testing connection:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to Azure Speech Services'
      };
    }
  });

  // TTS: Azure - Sync Voices
  ipcMain.handle('azure:sync-voices', async (event, credentials: { apiKey: string; region: string }) => {
    try {
      console.log('[Azure] Syncing voices to database...');

      const { apiKey, region } = credentials;

      // Initialize Azure provider and fetch voices
      const manager = await initializeTTS();
      const azureProvider = manager['providers'].get('azure');

      if (!azureProvider) {
        return {
          success: false,
          error: 'Azure provider not available'
        };
      }

      // Initialize provider with credentials
      await azureProvider.initialize({ apiKey, region });

      // Get voices from Azure
      const voices = await azureProvider.getVoices();

      console.log(`[Azure] Fetched ${voices.length} voices from Azure`);

      // Sync to database
      if (voiceSyncService) {
        await voiceSyncService.syncVoices(voices);
      }

      console.log('[Azure] Voice sync complete');

      return {
        success: true,
        voiceCount: voices.length
      };
    } catch (error: any) {
      console.error('[Azure] Error syncing voices:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync Azure voices'
      };
    }
  });

  // TTS: Provider - Toggle
  ipcMain.handle('provider:toggle', async (event, payload: { provider: string; enabled: boolean }) => {
    try {
      const { provider, enabled } = payload;
      console.log(`[Provider] ${enabled ? 'Enabling' : 'Disabling'} ${provider}`);

      await initializeTTS();

      // Update provider status in database
      const status = voicesRepo.getProviderStatus(provider);
      const voiceCount = status?.voice_count || 0;
      voicesRepo.updateProviderStatus(provider, enabled, voiceCount);

      if (enabled && !status?.last_synced_at) {
        console.log(`[Provider] ${provider} is enabled but not yet synced. Will sync on next startup.`);
      }

      return {
        success: true
      };
    } catch (error: any) {
      console.error('[Provider] Error toggling provider:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

export { initializeTTS };
