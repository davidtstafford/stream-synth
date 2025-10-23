import { TTSProvider, TTSVoice, TTSSettings, TTSOptions } from './base';
import { TTSRepository } from '../../database/repositories/tts';
import Database from 'better-sqlite3';

interface TTSQueueItem {
  username: string;
  message: string;
  voiceId?: string;
  timestamp: string;
}

interface MessageHistory {
  message: string;
  timestamp: number;
}

interface UserCooldown {
  lastSpoke: number;
}

export class TTSManager {
  private providers: Map<string, TTSProvider>;
  private currentProvider: TTSProvider | null = null;
  private repository: TTSRepository;
  private settings: TTSSettings | null = null;
  private messageQueue: TTSQueueItem[] = [];
  private isProcessing: boolean = false;
  private mainWindow: Electron.BrowserWindow | null = null;
  
  // Spam prevention tracking
  private messageHistory: MessageHistory[] = [];
  private userCooldowns: Map<string, UserCooldown> = new Map();
  private lastGlobalSpeak: number = 0;
  private copypastaList: Set<string> = new Set([
    'kappa123',
    'pogchamp',
    // Add common copypastas here
  ]);

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
      // Basic filters
      filterCommands: dbSettings.filter_commands !== undefined ? dbSettings.filter_commands as boolean : true,
      filterBots: dbSettings.filter_bots !== undefined ? dbSettings.filter_bots as boolean : true,
      filterUrls: dbSettings.filter_urls !== undefined ? dbSettings.filter_urls as boolean : true,
      announceUsername: dbSettings.announce_username !== undefined ? dbSettings.announce_username as boolean : true,
      minMessageLength: dbSettings.min_message_length !== undefined ? dbSettings.min_message_length as number : 0,
      maxMessageLength: dbSettings.max_message_length !== undefined ? dbSettings.max_message_length as number : 500,
      // Duplicate detection
      skipDuplicateMessages: dbSettings.skip_duplicate_messages !== undefined ? dbSettings.skip_duplicate_messages as boolean : true,
      duplicateMessageWindow: dbSettings.duplicate_message_window !== undefined ? dbSettings.duplicate_message_window as number : 300,
      // Rate limiting
      userCooldownEnabled: dbSettings.user_cooldown_enabled !== undefined ? dbSettings.user_cooldown_enabled as boolean : true,
      userCooldownSeconds: dbSettings.user_cooldown_seconds !== undefined ? dbSettings.user_cooldown_seconds as number : 30,
      globalCooldownEnabled: dbSettings.global_cooldown_enabled !== undefined ? dbSettings.global_cooldown_enabled as boolean : false,
      globalCooldownSeconds: dbSettings.global_cooldown_seconds !== undefined ? dbSettings.global_cooldown_seconds as number : 5,
      maxQueueSize: dbSettings.max_queue_size !== undefined ? dbSettings.max_queue_size as number : 20,
      // Emote/Emoji limits
      maxEmotesPerMessage: dbSettings.max_emotes_per_message !== undefined ? dbSettings.max_emotes_per_message as number : 5,
      maxEmojisPerMessage: dbSettings.max_emojis_per_message !== undefined ? dbSettings.max_emojis_per_message as number : 3,
      stripExcessiveEmotes: dbSettings.strip_excessive_emotes !== undefined ? dbSettings.strip_excessive_emotes as boolean : true,
      // Character repetition
      maxRepeatedChars: dbSettings.max_repeated_chars !== undefined ? dbSettings.max_repeated_chars as number : 3,
      maxRepeatedWords: dbSettings.max_repeated_words !== undefined ? dbSettings.max_repeated_words as number : 2,
      // Content filters
      copypastaFilterEnabled: dbSettings.copypasta_filter_enabled !== undefined ? dbSettings.copypasta_filter_enabled as boolean : false,
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
    // Basic filters
    if (settings.filterCommands !== undefined) dbSettings.filter_commands = settings.filterCommands;
    if (settings.filterBots !== undefined) dbSettings.filter_bots = settings.filterBots;
    if (settings.filterUrls !== undefined) dbSettings.filter_urls = settings.filterUrls;
    if (settings.announceUsername !== undefined) dbSettings.announce_username = settings.announceUsername;
    if (settings.minMessageLength !== undefined) dbSettings.min_message_length = settings.minMessageLength;
    if (settings.maxMessageLength !== undefined) dbSettings.max_message_length = settings.maxMessageLength;
    // Duplicate detection
    if (settings.skipDuplicateMessages !== undefined) dbSettings.skip_duplicate_messages = settings.skipDuplicateMessages;
    if (settings.duplicateMessageWindow !== undefined) dbSettings.duplicate_message_window = settings.duplicateMessageWindow;
    // Rate limiting
    if (settings.userCooldownEnabled !== undefined) dbSettings.user_cooldown_enabled = settings.userCooldownEnabled;
    if (settings.userCooldownSeconds !== undefined) dbSettings.user_cooldown_seconds = settings.userCooldownSeconds;
    if (settings.globalCooldownEnabled !== undefined) dbSettings.global_cooldown_enabled = settings.globalCooldownEnabled;
    if (settings.globalCooldownSeconds !== undefined) dbSettings.global_cooldown_seconds = settings.globalCooldownSeconds;
    if (settings.maxQueueSize !== undefined) dbSettings.max_queue_size = settings.maxQueueSize;
    // Emote/Emoji limits
    if (settings.maxEmotesPerMessage !== undefined) dbSettings.max_emotes_per_message = settings.maxEmotesPerMessage;
    if (settings.maxEmojisPerMessage !== undefined) dbSettings.max_emojis_per_message = settings.maxEmojisPerMessage;
    if (settings.stripExcessiveEmotes !== undefined) dbSettings.strip_excessive_emotes = settings.stripExcessiveEmotes;
    // Character repetition
    if (settings.maxRepeatedChars !== undefined) dbSettings.max_repeated_chars = settings.maxRepeatedChars;
    if (settings.maxRepeatedWords !== undefined) dbSettings.max_repeated_words = settings.maxRepeatedWords;
    // Content filters
    if (settings.copypastaFilterEnabled !== undefined) dbSettings.copypasta_filter_enabled = settings.copypastaFilterEnabled;


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

    // Check user cooldown
    if (this.settings.userCooldownEnabled && !this.checkUserCooldown(username)) {
      console.log('[TTS] User on cooldown:', username);
      return;
    }

    // Check global cooldown
    if (this.settings.globalCooldownEnabled && !this.checkGlobalCooldown()) {
      console.log('[TTS] Global cooldown active');
      return;
    }

    // Check queue size limit
    if (this.settings.maxQueueSize && this.messageQueue.length >= this.settings.maxQueueSize) {
      console.log('[TTS] Queue full, dropping message');
      return;
    }

    // Filter the message
    let filteredMessage = this.filterMessage(message);
    if (!filteredMessage) {
      return; // Message filtered out
    }

    // Apply spam filters
    filteredMessage = this.applySpamFilters(filteredMessage);
    if (!filteredMessage) {
      return; // Message filtered out by spam filters
    }

    // Check for duplicate messages
    if (this.settings.skipDuplicateMessages && this.isDuplicate(filteredMessage)) {
      console.log('[TTS] Skipping duplicate message');
      return;
    }

    // Record this message in history
    this.recordMessage(filteredMessage);

    // Update user cooldown
    if (this.settings.userCooldownEnabled) {
      this.updateUserCooldown(username);
    }

    // Update global cooldown
    if (this.settings.globalCooldownEnabled) {
      this.updateGlobalCooldown();
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
   * Apply spam filters to message
   */
  private applySpamFilters(message: string): string | null {
    let filtered: string | null = message;

    // Strip excessive emotes/emojis
    filtered = this.filterEmotesAndEmojis(filtered);
    if (!filtered) return null;

    // Limit repeated characters
    if (this.settings?.maxRepeatedChars) {
      filtered = this.limitRepeatedCharacters(filtered);
    }

    // Limit repeated words
    if (this.settings?.maxRepeatedWords) {
      filtered = this.limitRepeatedWords(filtered);
    }

    // Check against copypasta list
    if (this.settings?.copypastaFilterEnabled && this.isCopypasta(filtered)) {
      console.log('[TTS] Skipping copypasta');
      return null;
    }

    // Skip if empty after filtering
    if (filtered.trim().length === 0) {
      return null;
    }

    return filtered;
  }

  /**
   * Filter emotes and emojis from message
   */
  private filterEmotesAndEmojis(message: string): string | null {
    if (!this.settings?.maxEmotesPerMessage && !this.settings?.maxEmojisPerMessage) {
      return message;
    }

    // Count and handle emojis (Unicode emojis)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojis = message.match(emojiRegex) || [];
    
    // Count words (approximate emote count - Twitch emotes look like words)
    const words = message.split(/\s+/);
    // Potential emotes: words that contain non-standard chars BUT exclude pure numbers
    const potentialEmotes = words.filter(w => {
      if (w.length === 0) return false;
      // Skip pure numbers (e.g., "1000", "123")
      if (/^\d+$/.test(w)) return false;
      // Skip common words/punctuation (letters, numbers, spaces, basic punctuation)
      if (/^[a-z0-9\s,.!?'"]+$/i.test(w)) return false;
      return true;
    });

    let filtered = message;

    // Handle emojis
    if (this.settings?.maxEmojisPerMessage && emojis.length > this.settings.maxEmojisPerMessage) {
      if (this.settings.stripExcessiveEmotes) {
        // Remove excess emojis
        filtered = message;
        emojis.forEach((emoji, i) => {
          if (i >= this.settings!.maxEmojisPerMessage!) {
            filtered = filtered.replace(emoji, '');
          }
        });
        console.log('[TTS] Stripped excessive emojis');
      } else {
        console.log('[TTS] Too many emojis:', emojis.length);
        return null;
      }
    }

    // Simple emote check (this is approximate - real Twitch emote detection would need the emote list)
    if (this.settings?.maxEmotesPerMessage && potentialEmotes.length > this.settings.maxEmotesPerMessage) {
      if (this.settings.stripExcessiveEmotes) {
        console.log('[TTS] Message has excessive potential emotes, may be truncated');
      } else {
        console.log('[TTS] Too many potential emotes:', potentialEmotes.length);
        return null;
      }
    }

    return filtered.trim() || null;
  }

  /**
   * Limit repeated characters (e.g., "hahahaha" -> "haha")
   */
  private limitRepeatedCharacters(message: string): string {
    const maxRepeats = this.settings?.maxRepeatedChars || 3;
    // Match character repeated more than maxRepeats times
    // e.g., if maxRepeats=3, match 4+ repeats: (.)\\1{3,} means char + 3 more = 4 total
    const regex = new RegExp(`(.)\\1{${maxRepeats},}`, 'gi');
    return message.replace(regex, (match, char) => char.repeat(maxRepeats));
  }

  /**
   * Limit repeated words (e.g., "really really really" -> "really really")
   */
  private limitRepeatedWords(message: string): string {
    const maxRepeats = this.settings?.maxRepeatedWords || 2;
    const words = message.split(/\s+/);
    const result: string[] = [];
    let lastWord = '';
    let repeatCount = 0;

    for (const word of words) {
      const normalized = word.toLowerCase();
      if (normalized === lastWord) {
        repeatCount++;
        if (repeatCount < maxRepeats) {
          result.push(word);
        }
      } else {
        result.push(word);
        lastWord = normalized;
        repeatCount = 0;
      }
    }

    return result.join(' ');
  }

  /**
   * Check if message is a known copypasta
   */
  private isCopypasta(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return this.copypastaList.has(normalized);
  }

  /**
   * Check if user is on cooldown
   */
  private checkUserCooldown(username: string): boolean {
    const cooldown = this.userCooldowns.get(username);
    if (!cooldown) return true;

    const now = Date.now();
    const cooldownMs = (this.settings?.userCooldownSeconds || 30) * 1000;
    return now - cooldown.lastSpoke >= cooldownMs;
  }

  /**
   * Update user cooldown timestamp
   */
  private updateUserCooldown(username: string): void {
    this.userCooldowns.set(username, { lastSpoke: Date.now() });
  }

  /**
   * Check if global cooldown is active
   */
  private checkGlobalCooldown(): boolean {
    const now = Date.now();
    const cooldownMs = (this.settings?.globalCooldownSeconds || 5) * 1000;
    return now - this.lastGlobalSpeak >= cooldownMs;
  }

  /**
   * Update global cooldown timestamp
   */
  private updateGlobalCooldown(): void {
    this.lastGlobalSpeak = Date.now();
  }

  /**
   * Check if message is a duplicate
   */
  private isDuplicate(message: string): boolean {
    const now = Date.now();
    const windowMs = (this.settings?.duplicateMessageWindow || 300) * 1000;
    
    // Clean old messages from history
    this.messageHistory = this.messageHistory.filter(m => now - m.timestamp < windowMs);
    
    // Check if this message exists in recent history
    const normalized = message.toLowerCase().trim();
    return this.messageHistory.some(m => m.message.toLowerCase().trim() === normalized);
  }

  /**
   * Record message in history for duplicate detection
   */
  private recordMessage(message: string): void {
    this.messageHistory.push({
      message: message,
      timestamp: Date.now()
    });

    // Keep history manageable (max 100 messages)
    if (this.messageHistory.length > 100) {
      this.messageHistory.shift();
    }
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
