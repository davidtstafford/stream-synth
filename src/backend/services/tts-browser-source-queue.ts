/**
 * TTS Browser Source Queue Service
 * 
 * Manages sequential audio playback for browser sources (OBS, etc.)
 * Handles three provider types differently:
 * - Azure/Google: Send actual audio file data
 * - WebSpeech: Send voice ID + text for client-side synthesis
 * 
 * Features:
 * - Sequential playback (one at a time)
 * - Queue management (purge old items)
 * - WebSocket communication to browser source
 */

import { EventEmitter } from 'events';

export interface TTSQueueItem {
  id: string;
  provider: 'azure' | 'google' | 'webspeech';
  timestamp: number;
  
  // For Azure/Google
  audioData?: Buffer;
  audioFormat?: 'mp3' | 'wav';
  
  // For WebSpeech
  text?: string;
  voiceId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class TTSBrowserSourceQueue extends EventEmitter {
  private queue: TTSQueueItem[] = [];
  private isPlaying: boolean = false;
  private maxQueueSize: number = 10;
  private enabled: boolean = false;
  private currentItem: TTSQueueItem | null = null;

  constructor() {
    super();
  }

  /**
   * Enable or disable browser source output
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[TTS Browser Source] ${enabled ? 'Enabled' : 'Disabled'}`);
    
    if (!enabled) {
      // Clear queue when disabled
      this.queue = [];
      this.isPlaying = false;
      this.currentItem = null;
    }
  }

  /**
   * Check if browser source output is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Add item to queue
   */
  add(item: TTSQueueItem): void {
    if (!this.enabled) {
      console.log('[TTS Browser Source] Skipping - disabled');
      return;
    }

    // Purge oldest items if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      const removed = this.queue.shift();
      console.log(`[TTS Browser Source] Queue full, removed oldest item:`, removed?.id);
    }

    this.queue.push(item);
    console.log(`[TTS Browser Source] Added to queue: ${item.id} (provider: ${item.provider}, queue size: ${this.queue.length})`);

    // Start processing if not already playing
    if (!this.isPlaying) {
      this.processNext();
    }
  }

  /**
   * Process next item in queue
   */
  private async processNext(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.currentItem = this.queue.shift()!;

    console.log(`[TTS Browser Source] Playing: ${this.currentItem.id} (${this.currentItem.provider})`);

    try {
      // Send to browser source
      this.emit('play-audio', this.currentItem);

      // Wait for audio to finish
      // Browser source will send 'audio-finished' event
      await this.waitForAudioFinished();

      console.log(`[TTS Browser Source] Finished: ${this.currentItem.id}`);
    } catch (error) {
      console.error(`[TTS Browser Source] Error playing ${this.currentItem.id}:`, error);
    } finally {
      this.isPlaying = false;
      this.currentItem = null;

      // Process next item
      if (this.queue.length > 0) {
        // Small delay between items
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  /**
   * Wait for audio to finish playing
   */
  private waitForAudioFinished(): Promise<void> {
    return new Promise((resolve) => {
      // Set a timeout in case browser source doesn't respond
      const timeout = setTimeout(() => {
        console.log('[TTS Browser Source] Audio timeout, moving to next');
        resolve();
      }, 30000); // 30 second timeout

      // Listen for finish event (will be triggered externally)
      const finishHandler = () => {
        clearTimeout(timeout);
        this.off('audio-finished', finishHandler);
        resolve();
      };

      this.once('audio-finished', finishHandler);
    });
  }

  /**
   * Notify that audio has finished (called externally)
   */
  notifyAudioFinished(): void {
    this.emit('audio-finished');
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    console.log('[TTS Browser Source] Queue cleared');
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get current playing item
   */
  getCurrentItem(): TTSQueueItem | null {
    return this.currentItem;
  }
}
