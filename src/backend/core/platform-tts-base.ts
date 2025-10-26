/**
 * Platform-agnostic TTS interface
 * Each OS (Windows, macOS, Linux) implements this interface
 * with OS-specific Web Speech API initialization and voice handling
 */

import { BrowserWindow } from 'electron';

export interface PlatformTTSHandler {
  /**
   * Initialize OS-specific Web Speech API setup
   * This includes any platform-specific voice loading, event handling, etc.
   */
  initialize(mainWindow: BrowserWindow): Promise<void>;

  /**
   * Handle voices-changed event
   * Triggered when system voices are added/removed/updated
   */
  onVoicesChanged(mainWindow: BrowserWindow): Promise<void>;

  /**
   * Get OS-specific platform identifier
   */
  getPlatform(): 'windows' | 'darwin' | 'linux';

  /**
   * Cleanup any OS-specific resources
   */
  cleanup(): Promise<void>;
}
