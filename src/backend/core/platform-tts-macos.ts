/**
 * macOS-specific TTS Web Speech API handler
 * Handles AVSpeechSynthesizer voices and macOS-specific initialization
 * 
 * macOS voices are available through:
 * - System Preferences > Accessibility > Speech
 * - The Web Speech API accesses these through the browser sandbox
 * 
 * Key differences from Windows:
 * - macOS uses AVFoundation for voice synthesis
 * - Voices include Siri voices (premium) and system voices
 * - Voice initialization timing may differ from Windows
 * - Some enhanced voices may require additional permissions
 */

import { BrowserWindow } from 'electron';
import { PlatformTTSHandler } from './platform-tts-base';

export class MacOSTTSHandler implements PlatformTTSHandler {
  private voiceInitAttempts = 0;
  private maxInitAttempts = 20; // Maximum attempts to get voices (4 seconds at 200ms intervals)
  private initTimeout: NodeJS.Timeout | null = null;

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    console.log('[macOS TTS] Initializing Web Speech API for macOS AVFoundation voices...');

    // macOS requires special handling for voice initialization
    // Voices may not be immediately available after page load
    mainWindow.webContents.on('did-finish-load', async () => {
      await this.initializeMacOSVoices(mainWindow);
    });

    console.log('[macOS TTS] macOS TTS handler initialized');
  }

  private async initializeMacOSVoices(mainWindow: BrowserWindow): Promise<void> {
    console.log('[macOS TTS] Starting voice initialization polling...');
    this.voiceInitAttempts = 0;

    const pollVoices = async () => {
      try {
        const result = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            if (!window.speechSynthesis) {
              return { success: false, count: 0, reason: 'speechSynthesis not available' };
            }

            const voices = window.speechSynthesis.getVoices();
            
            if (voices && voices.length > 0) {
              console.log('[macOS] Web Speech API initialized with', voices.length, 'voices');
              
              // Log some voice details for debugging
              const voiceSummary = voices.slice(0, 3).map(v => ({
                name: v.name,
                lang: v.lang,
                localService: v.localService,
                default: v.default
              }));
              console.log('[macOS] First 3 voices:', voiceSummary);
              
              // Dispatch custom event for voice system to detect voice changes
              const event = new CustomEvent('tts:voices-loaded', {
                detail: { count: voices.length, platform: 'macos' }
              });
              window.dispatchEvent(event);
              
              return { success: true, count: voices.length };
            } else {
              return { success: false, count: 0, reason: 'no voices returned' };
            }
          })()
        `) as { success: boolean; count: number; reason?: string };

        if (result.success) {
          console.log('[macOS TTS] Voice polling successful:', result.count, 'voices');
          return;
        }

        this.voiceInitAttempts++;
        if (this.voiceInitAttempts < this.maxInitAttempts) {
          console.log(
            `[macOS TTS] Retrying voice initialization (${this.voiceInitAttempts}/${this.maxInitAttempts})...`
          );
          this.initTimeout = setTimeout(pollVoices, 200);
        } else {
          console.warn(
            '[macOS TTS] Max voice initialization attempts reached. Voices may not be available.'
          );
        }
      } catch (error) {
        console.error('[macOS TTS] Error during voice initialization:', error);
        this.voiceInitAttempts++;
        if (this.voiceInitAttempts < this.maxInitAttempts) {
          this.initTimeout = setTimeout(pollVoices, 200);
        }
      }
    };

    // Start polling
    await pollVoices();
  }

  async onVoicesChanged(mainWindow: BrowserWindow): Promise<void> {
    // Set up listener for voice changes on macOS
    // The voices-changed event fires when system voices are added/removed
    await mainWindow.webContents.executeJavaScript(`
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = window.speechSynthesis.getVoices();
          console.log('[macOS] Voices changed event fired with', voices.length, 'voices');
          
          const event = new CustomEvent('tts:voices-changed', {
            detail: { count: voices.length, platform: 'macos' }
          });
          window.dispatchEvent(event);
        };
        
        console.log('[macOS] Voice change listener registered');
      }
    `);
  }

  getPlatform(): 'windows' | 'darwin' | 'linux' {
    return 'darwin';
  }

  async cleanup(): Promise<void> {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
      this.initTimeout = null;
    }
    console.log('[macOS TTS] Cleaning up macOS TTS handler');
  }
}
