/**
 * Viewer Entrance Sounds IPC Service
 * 
 * Frontend service for managing viewer entrance sounds via IPC
 */

const { ipcRenderer } = window.require('electron');

export interface ViewerEntranceSound {
  id: number;
  viewer_id: string;
  viewer_username: string;
  sound_file_path: string;
  volume: number; // 0-100
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all entrance sounds
 */
export async function getAllEntranceSounds(): Promise<ViewerEntranceSound[]> {
  try {
    const result = await ipcRenderer.invoke('viewer-entrance-sounds:get-all');
    // Ensure we always return an array
    if (!result || !Array.isArray(result)) {
      console.warn('[EntranceSounds] Invalid response from IPC, returning empty array:', result);
      return [];
    }
    return result;
  } catch (error: any) {
    console.error('[EntranceSounds] Error getting all sounds:', error);
    // Return empty array on error instead of throwing
    return [];
  }
}

/**
 * Get entrance sound for a specific viewer
 */
export async function getEntranceSound(viewerId: string): Promise<ViewerEntranceSound | null> {
  try {
    return await ipcRenderer.invoke('viewer-entrance-sounds:get', viewerId);
  } catch (error: any) {
    console.error('[EntranceSounds] Error getting sound:', error);
    throw new Error(error.message || 'Failed to load entrance sound');
  }
}

/**
 * Create or update entrance sound for a viewer
 */
export async function upsertEntranceSound(
  sound: Omit<ViewerEntranceSound, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  try {
    await ipcRenderer.invoke('viewer-entrance-sounds:upsert', sound);
  } catch (error: any) {
    console.error('[EntranceSounds] Error upserting sound:', error);
    throw new Error(error.message || 'Failed to save entrance sound');
  }
}

/**
 * Set enabled status for a viewer's entrance sound
 */
export async function setEntranceSoundEnabled(viewerId: string, enabled: boolean): Promise<void> {
  try {
    await ipcRenderer.invoke('viewer-entrance-sounds:set-enabled', { viewerId, enabled });
  } catch (error: any) {
    console.error('[EntranceSounds] Error setting enabled status:', error);
    throw new Error(error.message || 'Failed to update entrance sound');
  }
}

/**
 * Set volume for a viewer's entrance sound
 */
export async function setEntranceSoundVolume(viewerId: string, volume: number): Promise<void> {
  try {
    await ipcRenderer.invoke('viewer-entrance-sounds:set-volume', { viewerId, volume });
  } catch (error: any) {
    console.error('[EntranceSounds] Error setting volume:', error);
    throw new Error(error.message || 'Failed to update volume');
  }
}

/**
 * Delete entrance sound for a viewer
 */
export async function deleteEntranceSound(viewerId: string): Promise<void> {
  try {
    await ipcRenderer.invoke('viewer-entrance-sounds:delete', viewerId);
  } catch (error: any) {
    console.error('[EntranceSounds] Error deleting sound:', error);
    throw new Error(error.message || 'Failed to delete entrance sound');
  }
}

/**
 * Get count of entrance sounds
 */
export async function getEntranceSoundCount(): Promise<{ total: number; enabled: number }> {
  try {
    const result = await ipcRenderer.invoke('viewer-entrance-sounds:get-count');
    // Ensure we have valid counts
    if (!result || typeof result.total !== 'number') {
      console.warn('[EntranceSounds] Invalid count response, returning zeros:', result);
      return { total: 0, enabled: 0 };
    }
    return result;
  } catch (error: any) {
    console.error('[EntranceSounds] Error getting count:', error);
    // Return zeros on error instead of throwing
    return { total: 0, enabled: 0 };
  }
}

/**
 * Open file picker dialog for audio files
 */
export async function pickAudioFile(): Promise<string | null> {
  try {
    const { dialog } = window.require('@electron/remote');
    const result = await dialog.showOpenDialog({
      title: 'Select Audio File',
      filters: [
        { 
          name: 'Audio Files', 
          extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] 
        }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error: any) {
    console.error('[EntranceSounds] Error picking file:', error);
    throw new Error(error.message || 'Failed to open file picker');
  }
}
