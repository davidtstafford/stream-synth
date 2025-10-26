/**
 * Windows-specific TTS Web Speech API handler
 * Handles SAPI5 voices and Windows-specific initialization
 */

import { BrowserWindow } from 'electron';
import { PlatformTTSHandler } from './base.js';

export class WindowsTTSHandler implements PlatformTTSHandler {
  async initialize(mainWindow: BrowserWindow): Promise<void> {
    console.log('[Windows TTS] Initializing Web Speech API for Windows SAPI5 voices...');

    // Handle voices-changed event to ensure voices are properly loaded
    mainWindow.webContents.on('did-finish-load', async () => {
      await this.onVoicesChanged(mainWindow);
    });

    console.log('[Windows TTS] Windows TTS handler initialized');
  }

  async onVoicesChanged(mainWindow: BrowserWindow): Promise<void> {
    // Trigger Web Speech API voice loading on Windows
    // This ensures SAPI5 voices are properly initialized
    await mainWindow.webContents.executeJavaScript(`
      if (window.speechSynthesis) {
        // Request voices to trigger the voices-changed event
        const voices = window.speechSynthesis.getVoices();
        console.log('[Windows] Web Speech API initialized with', voices.length, 'voices');
        
        // Dispatch custom event for voice system to detect voice changes
        const event = new CustomEvent('tts:voices-loaded', {
          detail: { count: voices.length, platform: 'windows' }
        });
        window.dispatchEvent(event);
      }
    `);
  }

  getPlatform(): 'windows' | 'darwin' | 'linux' {
    return 'windows';
  }

  async cleanup(): Promise<void> {
    console.log('[Windows TTS] Cleaning up Windows TTS handler');
  }
}
