/**
 * IPC Handlers for Viewer Entrance Sounds
 * 
 * Handles communication between the frontend UI and the backend database
 * for managing viewer entrance sounds.
 */

import { ipcRegistry } from '../ipc/ipc-framework';
import { ViewerEntranceSoundsRepository, ViewerEntranceSound } from '../../database/repositories/viewer-entrance-sounds';
import * as fs from 'fs';
import * as path from 'path';

// Lazy initialization - repository will be created when first needed
let repoInstance: ViewerEntranceSoundsRepository | null = null;
const getRepo = () => {
  if (!repoInstance) {
    repoInstance = new ViewerEntranceSoundsRepository();
    repoInstance.ensureTable();
  }
  return repoInstance;
};

/**
 * Setup all viewer entrance sound IPC handlers
 */
export function setupViewerEntranceSoundHandlers(): void {

  /**
   * Get all entrance sounds
   */
  ipcRegistry.register<void, ViewerEntranceSound[]>(
    'viewer-entrance-sounds:get-all',
    {
      execute: async () => {
        console.log('[IPC] Getting all entrance sounds');
        const sounds = getRepo().getAll();
        console.log('[IPC] Returning sounds:', sounds, 'Type:', typeof sounds, 'IsArray:', Array.isArray(sounds));
        return sounds;
      }
    }
  );

  /**
   * Get entrance sound for a specific viewer
   */
  ipcRegistry.register<string, ViewerEntranceSound | null>(
    'viewer-entrance-sounds:get',
    {
      validate: (viewerId) => {
        if (!viewerId) return 'viewerId is required';
        return null;
      },
      execute: async (viewerId) => {
        console.log('[IPC] Getting entrance sound for viewer:', viewerId);
        return getRepo().getByViewerId(viewerId);
      }
    }
  );

  /**
   * Upsert (create or update) entrance sound for a viewer
   */
  ipcRegistry.register<Omit<ViewerEntranceSound, 'id' | 'created_at' | 'updated_at'>, void>(
    'viewer-entrance-sounds:upsert',
    {
      validate: (sound) => {
        if (!sound.viewer_id) return 'viewer_id is required';
        if (!sound.viewer_username) return 'viewer_username is required';
        if (!sound.sound_file_path) return 'sound_file_path is required';
        
        // Validate sound file exists
        if (!fs.existsSync(sound.sound_file_path)) {
          return `Sound file not found: ${sound.sound_file_path}`;
        }

        // Validate sound file is an audio file
        const ext = path.extname(sound.sound_file_path).toLowerCase();
        const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        if (!validExtensions.includes(ext)) {
          return `Invalid audio file type: ${ext}. Supported types: ${validExtensions.join(', ')}`;
        }

        // Validate volume is within range
        if (sound.volume < 0 || sound.volume > 100) {
          return 'Volume must be between 0 and 100';
        }

        return null;
      },
      execute: async (sound) => {
        console.log('[IPC] Upserting entrance sound for viewer:', sound.viewer_username);
        getRepo().upsert(sound);
      }
    }
  );

  /**
   * Set enabled status for a viewer's entrance sound
   */
  ipcRegistry.register<{ viewerId: string; enabled: boolean }, void>(
    'viewer-entrance-sounds:set-enabled',
    {
      validate: (input) => {
        if (!input.viewerId) return 'viewerId is required';
        if (typeof input.enabled !== 'boolean') return 'enabled must be a boolean';
        return null;
      },
      execute: async (input) => {
        console.log('[IPC] Setting entrance sound enabled status:', input.viewerId, input.enabled);
        getRepo().setEnabled(input.viewerId, input.enabled);
      }
    }
  );

  /**
   * Set volume for a viewer's entrance sound
   */
  ipcRegistry.register<{ viewerId: string; volume: number }, void>(
    'viewer-entrance-sounds:set-volume',
    {
      validate: (input) => {
        if (!input.viewerId) return 'viewerId is required';
        if (typeof input.volume !== 'number') return 'volume must be a number';
        if (input.volume < 0 || input.volume > 100) {
          return 'Volume must be between 0 and 100';
        }
        return null;
      },
      execute: async (input) => {
        console.log('[IPC] Setting entrance sound volume:', input.viewerId, input.volume);
        getRepo().setVolume(input.viewerId, input.volume);
      }
    }
  );

  /**
   * Delete entrance sound for a viewer
   */
  ipcRegistry.register<string, void>(
    'viewer-entrance-sounds:delete',
    {
      validate: (viewerId) => {
        if (!viewerId) return 'viewerId is required';
        return null;
      },
      execute: async (viewerId) => {
        console.log('[IPC] Deleting entrance sound for viewer:', viewerId);
        getRepo().deleteByViewerId(viewerId);
      }
    }
  );

  /**
   * Get count of entrance sounds
   */
  ipcRegistry.register<void, { total: number; enabled: number }>(
    'viewer-entrance-sounds:get-count',
    {
      execute: async () => {
        console.log('[IPC] Getting entrance sound counts');
        const count = getRepo().getCount();
        const enabledCount = getRepo().getEnabledCount();
        return { total: count, enabled: enabledCount };
      }
    }
  );

  console.log('[IPC] Viewer entrance sounds handlers registered');
}
