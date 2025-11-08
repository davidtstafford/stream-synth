/**
 * TTS Browser Source Bridge
 * 
 * MINIMAL APPROACH - Does NOT modify existing TTS system
 * Simply listens to IPC events and forwards to browser source
 * 
 * Following lessons learned from failed refactor:
 * - ✅ Minimal code (<100 lines)
 * - ✅ No touching working TTS code
 * - ✅ No new dependencies
 * - ✅ Can be disabled/removed easily
 */

import { BrowserWindow } from 'electron';
import { BrowserSourceServer } from './browser-source-server';
import { TTSBrowserSourceQueue, TTSQueueItem } from './tts-browser-source-queue';

export class TTSBrowserSourceBridge {
  private enabled: boolean = false;
  private muteAppTTS: boolean = false;
  private queue: TTSBrowserSourceQueue;
  private browserSourceServer: BrowserSourceServer | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.queue = new TTSBrowserSourceQueue();
    
    // Listen to queue events
    this.queue.on('play-audio', (item: TTSQueueItem) => {
      this.sendToBrowserSource(item);
    });
  }

  /**
   * Initialize with browser source server
   */
  initialize(server: BrowserSourceServer, mainWindow: BrowserWindow): void {
    this.browserSourceServer = server;
    this.mainWindow = mainWindow;
    console.log('[TTS Browser Bridge] Initialized');
  }

  /**
   * Enable/disable browser source output
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.queue.setEnabled(enabled);
    console.log(`[TTS Browser Bridge] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Enable/disable app TTS muting (to prevent echo)
   */
  setMuteAppTTS(mute: boolean): void {
    this.muteAppTTS = mute;
    console.log(`[TTS Browser Bridge] App TTS ${mute ? 'muted' : 'unmuted'}`);
  }

  /**
   * Update settings from TTS manager
   */
  updateSettings(settings: { browserSourceEnabled?: boolean; browserSourceMuteApp?: boolean }): void {
    if (settings.browserSourceEnabled !== undefined) {
      this.setEnabled(settings.browserSourceEnabled);
    }
    if (settings.browserSourceMuteApp !== undefined) {
      this.setMuteAppTTS(settings.browserSourceMuteApp);
    }
  }

  /**
   * Check if app TTS should be muted
   */
  shouldMuteAppTTS(): boolean {
    return this.enabled && this.muteAppTTS;
  }

  /**
   * Add TTS audio to queue (called by TTS IPC handlers)
   */
  addToQueue(
    provider: 'azure' | 'google' | 'webspeech',
    data: {
      audioData?: Buffer;
      text?: string;
      voiceId?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
    }
  ): void {
    if (!this.enabled) {
      return;
    }

    const item: TTSQueueItem = {
      id: `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider,
      timestamp: Date.now(),
      ...data
    };

    this.queue.add(item);
  }

  /**
   * Send TTS data to browser source via Socket.IO
   */
  private sendToBrowserSource(item: TTSQueueItem): void {
    if (!this.browserSourceServer?.io) {
      console.warn('[TTS Browser Bridge] No browser source server available');
      this.queue.notifyAudioFinished(); // Skip this item
      return;
    }

    console.log(`[TTS Browser Bridge] Sending to browser source: ${item.id} (${item.provider})`);

    // Emit to browser source
    this.browserSourceServer.io.emit('tts-audio', {
      id: item.id,
      provider: item.provider,
      // For Azure/Google: send base64 audio
      audioData: item.audioData ? item.audioData.toString('base64') : undefined,
      audioFormat: item.audioFormat || 'mp3',
      // For WebSpeech: send text + voice settings
      text: item.text,
      voiceId: item.voiceId,
      rate: item.rate,
      pitch: item.pitch,
      volume: item.volume
    });

    // Browser source will emit 'tts-finished' when done
    // We'll listen for it in the Socket.IO handlers
  }

  /**
   * Called when browser source finishes playing audio
   */
  notifyFinished(): void {
    this.queue.notifyAudioFinished();
  }

  /**
   * Get queue status
   */
  getStatus(): { enabled: boolean; queueSize: number; muteAppTTS: boolean } {
    return {
      enabled: this.enabled,
      queueSize: this.queue.getQueueSize(),
      muteAppTTS: this.muteAppTTS
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.clear();
  }
}
