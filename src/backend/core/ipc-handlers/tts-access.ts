import { ipcRegistry } from '../ipc/ipc-framework';
import { TTSAccessRepository, TTSAccessConfig } from '../../database/repositories/tts-access';
import { ViewerRulesRepository, ViewerVoicePreference } from '../../database/repositories/viewer-rules';
import { ViewersRepository } from '../../database/repositories/viewers';

export function setupTTSAccessHandlers(): void {
  const accessRepo = new TTSAccessRepository();
  const rulesRepo = new ViewerRulesRepository();
  const viewersRepo = new ViewersRepository();

  // ===== TTS Access Config Handlers =====

  // Get TTS Access Config
  ipcRegistry.register<void, TTSAccessConfig>(
    'tts-access:get-config',
    {
      execute: async () => {
        return accessRepo.getConfig();
      }
    }
  );

  // Save TTS Access Config
  ipcRegistry.register<Partial<TTSAccessConfig>, { success: boolean }>(
    'tts-access:save-config',
    {
      validate: (input) => {
        const error = accessRepo.validateConfig(input);
        return error;
      },
      execute: async (input) => {
        accessRepo.saveConfig(input);
        return { success: true };
      }
    }
  );

  // Validate config (for UI validation)
  ipcRegistry.register<Partial<TTSAccessConfig>, { valid: boolean; error?: string }>(
    'tts-access:validate-config',
    {
      execute: async (input) => {
        const error = accessRepo.validateConfig(input);
        return {
          valid: !error,
          error: error || undefined
        };
      }
    }
  );

  // Reset config to defaults
  ipcRegistry.register<void, { success: boolean }>(
    'tts-access:reset-config',
    {
      execute: async () => {
        accessRepo.resetToDefaults();
        return { success: true };
      }
    }
  );

  // ===== Viewer Rules Handlers =====

  // List all viewer rules
  ipcRegistry.register<void, any[]>(
    'viewer-rules:list',
    {
      execute: async () => {
        return rulesRepo.getAllWithViewerInfo();
      }
    }
  );

  // Get viewer rule
  ipcRegistry.register<{ viewerId: string }, ViewerVoicePreference | null>(
    'viewer-rules:get',
    {
      validate: (input) => input.viewerId ? null : 'Viewer ID required',
      execute: async (input) => {
        return rulesRepo.getByViewerId(input.viewerId);
      }
    }
  );

  // Save viewer rule
  ipcRegistry.register<
    Omit<ViewerVoicePreference, 'id' | 'created_at' | 'updated_at'>,
    { success: boolean }
  >(
    'viewer-rules:save',
    {
      validate: (input) => {
        if (!input.viewer_id) return 'Viewer ID required';
        if (!input.voice_id) return 'Voice ID required';
        if (!input.provider) return 'Provider required';
        if (input.pitch < 0.5 || input.pitch > 2.0) return 'Pitch must be between 0.5 and 2.0';
        if (input.speed < 0.5 || input.speed > 2.0) return 'Speed must be between 0.5 and 2.0';
        return null;
      },
      execute: async (input) => {
        rulesRepo.upsert(input);
        return { success: true };
      }
    }
  );

  // Delete viewer rule
  ipcRegistry.register<{ viewerId: string }, { success: boolean }>(
    'viewer-rules:delete',
    {
      validate: (input) => input.viewerId ? null : 'Viewer ID required',
      execute: async (input) => {
        rulesRepo.deleteByViewerId(input.viewerId);
        return { success: true };
      }
    }
  );

  // Search viewers (for autocomplete)
  ipcRegistry.register<{ query: string }, any[]>(
    'viewer-rules:search-viewers',
    {
      validate: (input) => input.query ? null : 'Search query required',
      execute: async (input) => {
        // Search all viewers, not just those with rules
        const viewers = viewersRepo.search(input.query, 50);
        
        // Add rule status to each viewer
        return viewers.map(viewer => {
          const hasRule = rulesRepo.hasPreference(viewer.id);
          return {
            ...viewer,
            hasRule
          };
        });
      }
    }
  );

  // Get viewer rule count
  ipcRegistry.register<void, { count: number }>(
    'viewer-rules:count',
    {
      execute: async () => {
        return { count: rulesRepo.count() };
      }
    }
  );

  // Check if viewer has a custom voice preference
  ipcRegistry.register<{ viewerId: string }, { hasPreference: boolean }>(
    'viewer-rules:has-preference',
    {
      validate: (input) => input.viewerId ? null : 'Viewer ID required',
      execute: async (input) => {
        return { hasPreference: rulesRepo.hasPreference(input.viewerId) };
      }
    }
  );
}
