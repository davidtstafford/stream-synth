/**
 * TTS IPC Handlers
 * 
 * Handles Text-to-Speech operations via IPC using centralized IPC Framework:
 * - Voice testing and speaking
 * - Voice management and sync
 * - Provider configuration
 * - Settings management
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { ipcMain, BrowserWindow } from 'electron';
import { ipcRegistry } from '../ipc/ipc-framework';
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

/**
 * Reload TTS settings from database (called after chat commands change settings)
 */
export async function reloadTTSSettings(): Promise<void> {
  if (ttsManager) {
    await ttsManager.loadSettings();
    console.log('[TTS] Settings reloaded from database');
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

export function setupTTSHandlers(): void {  // ===== TTS: Core Operations =====
  ipcRegistry.register<{ voiceId: string; options?: any; message?: string }, void>(
    'tts:test-voice',
    {
      validate: (input) => input.voiceId ? null : 'Voice ID is required',
      execute: async (input) => {
        console.log('[IPC] tts:test-voice called with voiceId:', input.voiceId, 'options:', input.options, 'message:', input.message);
        const manager = await initializeTTS();

        // Use centralized provider routing logic
        const provider = manager.determineProviderFromVoiceId(input.voiceId);
        if (provider === 'webspeech') {
          console.log('[IPC] tts:test-voice - Web Speech voice, handled in renderer');
          return;
        }

        console.log('[IPC] tts:test-voice - Calling manager.testVoice() for', provider, 'voice');
        await manager.testVoice(input.voiceId, input.options, input.message);
        console.log('[IPC] tts:test-voice - Completed successfully');
      }
    }
  );
  ipcRegistry.register<void, void>(
    'tts:audio-finished',
    {
      execute: async () => {
        const manager = await initializeTTS();
        manager.onAudioFinished();
      }
    }
  );
  ipcRegistry.register<string, { voiceURI: string; name: string; language: string }>(
    'tts:get-voice-metadata',
    {
      validate: (voiceId) => voiceId ? null : 'Voice ID is required',
      execute: async (voiceId) => {
        console.log('[IPC] tts:get-voice-metadata called with voiceId:', voiceId);
        const voice = voicesRepo.getVoiceById(voiceId);

        if (!voice) {
          console.warn('[IPC] tts:get-voice-metadata - Voice not found:', voiceId);
          throw new Error('Voice not found');
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
          voiceURI: voiceURI,
          name: voice.name,
          language: voice.language_name
        };
      }
    }
  );
  ipcRegistry.register<{ text: string; options?: any }, void>(
    'tts:speak',
    {
      validate: (input) => input.text ? null : 'Text is required',
      execute: async (input) => {
        const manager = await initializeTTS();
        const settings = manager.getSettings();

        // Web Speech API is handled in renderer process
        if (settings?.provider === 'webspeech') {
          return;
        }

        await manager.speak(input.text, input.options);
      }
    }
  );

  ipcRegistry.register<void, void>(
    'tts:stop',
    {
      execute: async () => {
        const manager = await initializeTTS();
        const settings = manager.getSettings();

        // Web Speech API is handled in renderer process
        if (settings?.provider === 'webspeech') {
          return;
        }

        manager.stop();
      }
    }
  );

  // ===== TTS: Settings & Configuration =====
  ipcRegistry.register<void, any>(
    'tts:get-settings',
    {
      execute: async () => {
        const manager = await initializeTTS();
        return manager.getSettings();
      }
    }
  );

  ipcRegistry.register<any, void>(
    'tts:save-settings',
    {
      validate: (settings) => settings ? null : 'Settings are required',
      execute: async (settings) => {
        const manager = await initializeTTS();
        await manager.saveSettings(settings);
      }
    }
  );

  ipcRegistry.register<void, string[]>(
    'tts:get-providers',
    {
      execute: async () => {
        const manager = await initializeTTS();
        return manager.getProviderNames();
      }
    }
  );
  // ===== TTS: Voice Management =====
  ipcRegistry.register<{ provider: string; voices: any[] }, { count: number; stats?: any }>(
    'tts:sync-voices',
    {
      validate: (input) => {
        if (!input.provider) return 'Provider is required';
        if (!input.voices) return 'Voices array is required';
        return null;
      },
      execute: async (input) => {
        await initializeTTS();
        console.log(`[TTS] Syncing voices for provider: ${input.provider}, count: ${input.voices.length}`);
        let count = 0;

        if (voiceSyncService) {
          if (input.provider === 'webspeech') {
            count = await voiceSyncService.syncWebSpeechVoices(input.voices);
          } else if (input.provider === 'azure') {
            count = await voiceSyncService.syncAzureVoices(input.voices);
          } else if (input.provider === 'google') {
            count = await voiceSyncService.syncGoogleVoices(input.voices);
          } else {
            throw new Error(`Unknown provider: ${input.provider}`);
          }
        }

        const stats = voiceSyncService?.getStats();
        console.log(`[TTS] Voice sync complete. Stats:`, stats);

        return { count, stats };
      }
    }
  );

  ipcRegistry.register<{ provider: string; voices: any[] }, { count: number; message: string; stats?: any }>(
    'provider:rescan-immediate',
    {
      validate: (input) => {
        if (!input.provider) return 'Provider is required';
        if (!input.voices) return 'Voices array is required';
        return null;
      },
      execute: async (input) => {
        console.log(`[Provider] Immediate rescan for ${input.provider}...`);
        await initializeTTS();

        if (!voiceSyncService) {
          throw new Error('Voice sync service not initialized');
        }

        const count = await voiceSyncService.rescanProviderImmediate(input.provider, input.voices);
        const stats = voiceSyncService.getStats();

        return {
          count,
          message: `${input.provider} voices rescanned: ${count} voices found`,
          stats
        };
      }
    }
  );

  ipcRegistry.register<string, boolean>(
    'provider:check-sync-needed',
    {
      validate: (provider) => provider ? null : 'Provider is required',
      execute: async (provider) => {
        await initializeTTS();

        if (!voiceSyncService) {
          return false;
        }

        const needsSync = voiceSyncService.needsSync(provider);
        console.log(`[Provider] ${provider} needs sync: ${needsSync}`);
        return needsSync;
      }
    }
  );
  ipcRegistry.register<void, any[]>(
    'tts:get-voices',
    {
      execute: async () => {
        const voices = voicesRepo.getAvailableVoices();
        // Map numeric_id to id for frontend compatibility
        return voices.map(v => ({
          ...v,
          id: v.numeric_id
        }));
      }
    }
  );

  ipcRegistry.register<void, Record<string, any[]>>(
    'tts:get-grouped-voices',
    {
      execute: async () => {
        const grouped = voicesRepo.getGroupedVoices();
        const result: Record<string, any[]> = {};

        grouped.forEach((voices, key) => {
          // Map numeric_id to id for frontend compatibility
          result[key] = voices.map(v => ({
            ...v,
            id: v.numeric_id
          }));
        });

        return result;
      }
    }
  );

  ipcRegistry.register<void, any>(
    'tts:get-voice-stats',
    {
      execute: async () => {
        return voicesRepo.getStats();
      }
    }
  );
  ipcRegistry.register<number, any | null>(
    'tts:get-voice-by-id',
    {
      validate: (numericId) => numericId ? null : 'Voice ID is required',
      execute: async (numericId) => {
        const voice = voicesRepo.getVoiceByNumericId(numericId);
        // Map numeric_id to id for frontend compatibility
        return voice ? { ...voice, id: voice.numeric_id } : null;
      }
    }
  );
  // ===== Azure Provider =====
  ipcRegistry.register<{ apiKey: string; region: string }, { voiceCount?: number; previewVoices?: any[] }>(
    'azure:test-connection',
    {
      validate: (credentials) => {
        if (!credentials.apiKey || credentials.apiKey.trim().length < 32) {
          return 'Invalid API key. Key should be at least 32 characters.';
        }
        if (!credentials.region || credentials.region.trim().length === 0) {
          return 'Region is required.';
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

        if (!validRegions.includes(credentials.region.toLowerCase())) {
          return `Invalid region: ${credentials.region}. Please select a valid Azure region.`;
        }

        return null;
      },
      execute: async (credentials) => {
        const { apiKey, region } = credentials;
        console.log('[Azure] Testing connection to region:', region);
        console.log('[Azure] Starting connection test with apiKey length:', apiKey.length, 'region:', region);

        console.log('[Azure] [1/5] Initializing TTS manager...');
        const manager = await initializeTTS();
        console.log('[Azure] [2/5] Getting Azure provider from manager...');
        const azureProvider = manager['providers'].get('azure');

        if (!azureProvider) {
          throw new Error('Azure provider not available');
        }

        console.log('[Azure] [3/5] Initializing Azure provider with credentials...');
        await azureProvider.initialize({ apiKey, region });
        console.log('[Azure] [4/5] Calling getVoices()...');

        const voices = await azureProvider.getVoices();
        console.log('[Azure] [5/5] Got voices, preparing preview...');

        // Get preview voices (first 10)
        const previewVoices = voices.slice(0, 10).map((v: any) => ({
          name: v.name,
          language: v.languageName,
          gender: v.gender
        }));

        console.log('[Azure] Connection test successful, found', voices.length, 'voices');
        console.log('[Azure] Test completed successfully, returning result to frontend');

        return {
          voiceCount: voices.length,
          previewVoices
        };
      }
    }
  );

  ipcRegistry.register<{ apiKey: string; region: string }, { voiceCount?: number }>(
    'azure:sync-voices',
    {
      validate: (credentials) => {
        if (!credentials.apiKey) return 'API key is required';
        if (!credentials.region) return 'Region is required';
        return null;
      },
      execute: async (credentials) => {
        console.log('[Azure] Syncing voices to database...');

        const { apiKey, region } = credentials;

        // Initialize Azure provider and fetch voices
        const manager = await initializeTTS();
        const azureProvider = manager['providers'].get('azure');

        if (!azureProvider) {
          throw new Error('Azure provider not available');
        }

        // Initialize provider with credentials
        await azureProvider.initialize({ apiKey, region });        // Get voices from Azure
        const voices = await azureProvider.getVoices();

        console.log(`[Azure] Fetched ${voices.length} voices from Azure`);

        // Sync to database
        if (voiceSyncService) {
          await voiceSyncService.syncVoices(voices);
        }

        console.log('[Azure] Voice sync complete');

        return {
          voiceCount: voices.length
        };
      }
    }
  );

  // ===== Google Provider =====
  ipcRegistry.register<{ apiKey: string }, { voiceCount?: number; previewVoices?: any[] }>(
    'google:test-connection',
    {
      validate: (credentials) => {
        if (!credentials.apiKey || credentials.apiKey.trim().length === 0) {
          return 'API key is required.';
        }
        return null;
      },
      execute: async (credentials) => {
        console.log('[Google] Testing connection with API key');
        const { apiKey } = credentials;
        console.log('[Google] Starting connection test with apiKey length:', apiKey.length);

        console.log('[Google] [1/5] Initializing TTS manager...');
        const manager = await initializeTTS();
        console.log('[Google] [2/5] Getting Google provider from manager...');
        const googleProvider = manager['providers'].get('google');

        if (!googleProvider) {
          throw new Error('Google provider not available');
        }

        console.log('[Google] [3/5] Initializing Google provider with credentials...');
        await googleProvider.initialize({ apiKey });
        console.log('[Google] [4/5] Calling getVoices()...');

        const voices = await googleProvider.getVoices();
        console.log('[Google] [5/5] Got voices, preparing preview...');

        // Get preview voices (first 10)
        const previewVoices = voices.slice(0, 10).map((v: any) => ({
          name: v.name,
          language: v.language,
          gender: v.gender
        }));        console.log('[Google] Connection test successful, found', voices.length, 'voices');
        console.log('[Google] Test completed successfully, returning result to frontend');

        return {
          voiceCount: voices.length,
          previewVoices
        };
      }
    }
  );

  ipcRegistry.register<{ apiKey: string }, { voiceCount?: number }>(
    'google:sync-voices',
    {
      validate: (credentials) => credentials.apiKey ? null : 'API key is required',
      execute: async (credentials) => {
        console.log('[Google] Syncing voices to database...');

        const { apiKey } = credentials;

        // Initialize Google provider and fetch voices
        const manager = await initializeTTS();
        const googleProvider = manager['providers'].get('google');

        if (!googleProvider) {
          throw new Error('Google provider not available');
        }

        // Initialize provider with credentials
        await googleProvider.initialize({ apiKey });

        // Get voices from Google
        const voices = await googleProvider.getVoices();

        console.log(`[Google] Fetched ${voices.length} voices from Google`);

        // Sync to database
        if (voiceSyncService) {
          await voiceSyncService.syncGoogleVoices(voices);
        }

        console.log('[Google] Voice sync complete');

        return {
          voiceCount: voices.length
        };
      }
    }
  );

  // ===== Provider Toggle =====
  ipcRegistry.register<{ provider: string; enabled: boolean }, void>(
    'provider:toggle',
    {
      validate: (payload) => {
        if (!payload.provider) return 'Provider is required';
        if (payload.enabled === undefined) return 'Enabled flag is required';
        return null;
      },
      execute: async (payload) => {
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
      }
    }
  );
}

export { initializeTTS };
