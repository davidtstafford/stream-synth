/**
 * Platform TTS Factory
 * Routes to the correct OS-specific TTS handler based on the current platform
 */

import { BrowserWindow } from 'electron';
import { PlatformTTSHandler } from './base.js';
import { WindowsTTSHandler } from './windows.js';
import { MacOSTTSHandler } from './macos.js';

export class PlatformTTSFactory {
  private static instance: PlatformTTSHandler | null = null;

  /**
   * Get the appropriate TTS handler for the current platform
   */
  static getHandler(): PlatformTTSHandler {
    if (this.instance) {
      return this.instance;
    }

    const platform = process.platform;
    console.log('[Platform TTS] Detecting platform:', platform);

    switch (platform) {
      case 'win32':
        console.log('[Platform TTS] Using Windows TTS handler');
        this.instance = new WindowsTTSHandler();
        break;
      case 'darwin':
        console.log('[Platform TTS] Using macOS TTS handler');
        this.instance = new MacOSTTSHandler();
        break;
      case 'linux':
        console.log('[Platform TTS] Linux platform detected. Using Windows handler as fallback.');
        // Linux support can be added later - for now use Windows handler as base
        this.instance = new WindowsTTSHandler();
        break;
      default:
        console.warn('[Platform TTS] Unknown platform:', platform, '. Using Windows handler as fallback.');
        this.instance = new WindowsTTSHandler();
    }

    return this.instance;
  }

  /**
   * Initialize the platform-specific TTS handler
   */
  static async initialize(mainWindow: BrowserWindow): Promise<void> {
    const handler = this.getHandler();
    await handler.initialize(mainWindow);
  }

  /**
   * Cleanup the platform-specific TTS handler
   */
  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.cleanup();
      this.instance = null;
    }
  }

  /**
   * Get the current platform identifier
   */
  static getPlatform(): string {
    return process.platform;
  }
}
