import { TTSProvider, TTSVoice, TTSSettings, TTSOptions } from './base';
import { TTSRepository } from '../../database/repositories/tts';
import Database from 'better-sqlite3';

interface TTSQueueItem {
  username: string;
  message: string;
  voiceId?: string;
  timestamp: string;
}

export class TTSManager {
  private providers: Map<string, TTSProvider>;
  private currentProvider: TTSProvider | null = null;
  private repository: TTSRepository;
  private settings: TTSSettings | null = null;
  private messageQueue: TTSQueueItem[] = [];
  private isProcessing: boolean = false;
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor(db: Database.Database) {
    this.repository = new TTSRepository(db);
    this.providers = new Map();
    
    // Note: Web Speech API runs in renderer process
    // Azure and Google providers will be initialized here
    // TODO: Initialize Azure and Google providers when implemented
  }

  /**
   * Set the main window for sending messages to renderer
   */
  setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Initialize the TTS manager and load settings
   */
  async initialize(): Promise<void> {
    await this.loadSettings();
    
    // Only initialize provider if it's not webspeech (handled in renderer)
    if (this.settings!.provider !== 'webspeech') {
      await this.setProvider(this.settings!.provider);
    }
  }

  /**
   * Load settings from database
   */
  private async loadSettings(): Promise<void> {
    const dbSettings = this.repository.getSettings();
    
    this.settings = {
      enabled: dbSettings.tts_enabled as boolean,
      provider: (dbSettings.tts_provider as string) as 'webspeech' | 'azure' | 'google',
      voiceId: dbSettings.tts_voice_id as string,
      volume: dbSettings.tts_volume as number,
      rate: dbSettings.tts_rate as number,
      pitch: dbSettings.tts_pitch as number,
      azureApiKey: dbSettings.azure_api_key as string || '',
      azureRegion: dbSettings.azure_region as string || '',
      googleApiKey: dbSettings.google_api_key as string || '',
      filterCommands: dbSettings.filter_commands !== undefined ? dbSettings.filter_commands as boolean : true,
      filterBots: dbSettings.filter_bots !== undefined ? dbSettings.filter_bots as boolean : true,
      filterUrls: dbSettings.filter_urls !== undefined ? dbSettings.filter_urls as boolean : true,
      announceUsername: dbSettings.announce_username !== undefined ? dbSettings.announce_username as boolean : true,
      minMessageLength: dbSettings.min_message_length !== undefined ? dbSettings.min_message_length as number : 0,
      maxMessageLength: dbSettings.max_message_length !== undefined ? dbSettings.max_message_length as number : 500,
    };
  }

  /**
   * Set the active provider
   */
  async setProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    this.currentProvider = provider;
    
    // Initialize provider with API keys if needed
    const initOptions: any = {};
    if (providerName === 'azure' && this.settings) {
      initOptions.apiKey = this.settings.azureApiKey;
      initOptions.region = this.settings.azureRegion;
    } else if (providerName === 'google' && this.settings) {
      initOptions.apiKey = this.settings.googleApiKey;
    }
    
    await this.currentProvider.initialize(initOptions);
  }

  /**
   * Get voices from the current provider
   */
  async getVoices(): Promise<TTSVoice[]> {
    // Web Speech is handled in renderer
    if (this.settings?.provider === 'webspeech') {
      return [];
    }
    
    if (!this.currentProvider) {
      throw new Error('No TTS provider selected');
    }

    return await this.currentProvider.getVoices();
  }

  /**
   * Speak text using current settings
   */
  async speak(text: string, options?: Partial<TTSOptions>): Promise<void> {
    // Web Speech is handled in renderer
    if (this.settings?.provider === 'webspeech') {
      return;
    }
    
    if (!this.currentProvider || !this.settings) {
      throw new Error('TTS not initialized');
    }

    if (!this.settings.enabled) {
      console.log('[TTS] TTS is disabled, not speaking');
      return;
    }

    const ttsOptions: TTSOptions = {
      volume: options?.volume ?? this.settings.volume,
      rate: options?.rate ?? this.settings.rate,
      pitch: options?.pitch ?? this.settings.pitch
    };

    await this.currentProvider.speak(text, this.settings.voiceId, ttsOptions);
  }

  /**
   * Stop current speech
   */
  stop(): void {
    // Web Speech is handled in renderer
    if (this.settings?.provider === 'webspeech') {
      return;
    }
    
    if (this.currentProvider) {
      this.currentProvider.stop();
    }
  }

  /**
   * Test a specific voice
   */
  async testVoice(voiceId: string, options?: Partial<TTSOptions>): Promise<void> {
    // Web Speech is handled in renderer
    if (this.settings?.provider === 'webspeech') {
      return;
    }
    
    if (!this.currentProvider || !this.settings) {
      throw new Error('TTS not initialized');
    }

    const ttsOptions: TTSOptions = {
      volume: options?.volume ?? this.settings.volume,
      rate: options?.rate ?? this.settings.rate,
      pitch: options?.pitch ?? this.settings.pitch
    };

    await this.currentProvider.test(voiceId, ttsOptions);
  }

  /**
   * Save settings to database
   */
  async saveSettings(settings: Partial<TTSSettings>): Promise<void> {
    const dbSettings: Record<string, any> = {};
    
    if (settings.enabled !== undefined) dbSettings.tts_enabled = settings.enabled;
    if (settings.provider !== undefined) dbSettings.tts_provider = settings.provider;
    if (settings.voiceId !== undefined) dbSettings.tts_voice_id = settings.voiceId;
    if (settings.volume !== undefined) dbSettings.tts_volume = settings.volume;
    if (settings.rate !== undefined) dbSettings.tts_rate = settings.rate;
    if (settings.pitch !== undefined) dbSettings.tts_pitch = settings.pitch;
    if (settings.azureApiKey !== undefined) dbSettings.azure_api_key = settings.azureApiKey;
    if (settings.azureRegion !== undefined) dbSettings.azure_region = settings.azureRegion;
    if (settings.googleApiKey !== undefined) dbSettings.google_api_key = settings.googleApiKey;
    if (settings.filterCommands !== undefined) dbSettings.filter_commands = settings.filterCommands;
    if (settings.filterBots !== undefined) dbSettings.filter_bots = settings.filterBots;
    if (settings.filterUrls !== undefined) dbSettings.filter_urls = settings.filterUrls;
    if (settings.announceUsername !== undefined) dbSettings.announce_username = settings.announceUsername;
    if (settings.minMessageLength !== undefined) dbSettings.min_message_length = settings.minMessageLength;
    if (settings.maxMessageLength !== undefined) dbSettings.max_message_length = settings.maxMessageLength;

    this.repository.saveSettings(dbSettings);
    
    // Reload settings
    await this.loadSettings();
    
    // If provider changed and it's not webspeech, reinitialize
    if (settings.provider && settings.provider !== 'webspeech' && settings.provider !== this.settings!.provider) {
      await this.setProvider(settings.provider);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): TTSSettings | null {
    return this.settings;
  }

  /**
   * Get available provider names
   */
  getProviderNames(): string[] {
    // Always include webspeech since it's handled in renderer
    const backendProviders = Array.from(this.providers.keys());
    return ['webspeech', ...backendProviders];
  }

  /**
   * Handle incoming chat message for TTS
   */
  async handleChatMessage(username: string, message: string, userId?: string): Promise<void> {
    if (!this.settings || !this.settings.enabled) {
      return; // TTS disabled
    }

    // Check if bot (if filter enabled)
    if (this.settings.filterBots && this.isBot(username)) {
      console.log('[TTS] Skipping bot:', username);
      return;
    }

    // Filter the message
    const filteredMessage = this.filterMessage(message);
    if (!filteredMessage) {
      return; // Message filtered out
    }

    // Get viewer's custom voice if they have one
    // TODO: Look up viewer voice from database when per-viewer voices are implemented
    const voiceId = this.settings.voiceId;

    // Add to queue
    this.messageQueue.push({
      username,
      message: filteredMessage,
      voiceId,
      timestamp: new Date().toISOString()
    });

    // Process queue
    this.processQueue();
  }

  /**
   * Filter and clean message before speaking
   */
  private filterMessage(message: string): string | null {
    // Skip empty messages
    if (!message || message.trim().length === 0) {
      return null;
    }

    // Skip commands (starting with ! or ~) if filter enabled
    if (this.settings?.filterCommands && (message.startsWith('!') || message.startsWith('~'))) {
      console.log('[TTS] Skipping command:', message);
      return null;
    }

    let filtered = message.trim();

    // Remove URLs if filter enabled
    if (this.settings?.filterUrls) {
      filtered = filtered.replace(/https?:\/\/\S+/gi, '');
    }

    // Check message length limits
    if (this.settings?.minMessageLength && filtered.length < this.settings.minMessageLength) {
      console.log('[TTS] Message too short:', filtered.length, 'chars');
      return null;
    }

    // Truncate if over max length
    if (this.settings?.maxMessageLength && filtered.length > this.settings.maxMessageLength) {
      console.log('[TTS] Truncating message from', filtered.length, 'to', this.settings.maxMessageLength);
      filtered = filtered.substring(0, this.settings.maxMessageLength);
    }

    // Skip if empty after filtering
    if (filtered.trim().length === 0) {
      return null;
    }

    return filtered.trim();
  }

  /**
   * Check if username is a bot
   */
  private isBot(username: string): boolean {
    const botNames = ['nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot', 'wizebot'];
    return botNames.includes(username.toLowerCase());
  }

  /**
   * Process the message queue
   */
  private async processQueue(): Promise<void> {
    // Already processing
    if (this.isProcessing) {
      return;
    }

    // Queue empty
    if (this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift()!;

      // Format the message with username (if enabled)
      const textToSpeak = this.settings?.announceUsername 
        ? `${item.username} says: ${item.message}`
        : item.message;

      try {
        console.log('[TTS] Speaking:', textToSpeak);

        if (this.settings?.provider === 'webspeech') {
          // Send to renderer process for Web Speech API
          if (this.mainWindow) {
            this.mainWindow.webContents.send('tts:speak', {
              text: textToSpeak,
              voiceId: item.voiceId || this.settings.voiceId,
              volume: this.settings.volume,
              rate: this.settings.rate,
              pitch: this.settings.pitch
            });
          }
          
          // Wait a bit before next message (estimate speaking time)
          const wordsPerMinute = 150 * (this.settings.rate || 1.0);
          const words = textToSpeak.split(' ').length;
          const estimatedMs = (words / wordsPerMinute) * 60 * 1000;
          await new Promise(resolve => setTimeout(resolve, Math.max(estimatedMs, 1000)));
        } else {
          // Use backend provider (Azure/Google)
          await this.speak(textToSpeak, { volume: this.settings?.volume });
        }
      } catch (error) {
        console.error('[TTS] Error speaking message:', error);
      }

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isProcessing = false;
  }

  /**
   * Clear the message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.stop();
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { length: number; isProcessing: boolean } {
    return {
      length: this.messageQueue.length,
      isProcessing: this.isProcessing
    };
  }
}
