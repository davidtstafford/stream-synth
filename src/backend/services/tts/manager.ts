import { TTSProvider, TTSVoice, TTSSettings, TTSOptions } from './base';
import { AzureTTSProvider } from './azure-provider';
import { GoogleTTSProvider } from './google-provider';
import { TTSRepository } from '../../database/repositories/tts';
import { VoicesRepository } from '../../database/repositories/voices';
import { SettingsMapper } from './settings-mapper';
import Database from 'better-sqlite3';

interface TTSQueueItem {
  username: string;
  message: string;
  voiceId?: string;
  pitch?: number;
  rate?: number;
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
  private voicesRepo: VoicesRepository;
  private settings: TTSSettings | null = null;
  private messageQueue: TTSQueueItem[] = [];
  private isProcessing: boolean = false;
  private mainWindow: Electron.BrowserWindow | null = null;
  private audioFinishedResolver: (() => void) | null = null;
  
  // Spam prevention tracking
  private messageHistory: MessageHistory[] = [];
  private userCooldowns: Map<string, UserCooldown> = new Map();
  private lastGlobalSpeak: number = 0;
  private copypastaList: Set<string> = new Set([
    'kappa123',
    'pogchamp',
  ]);
  constructor(db: Database.Database) {
    this.repository = new TTSRepository(db);
    this.voicesRepo = new VoicesRepository();
    this.providers = new Map();
    
    // Register Azure provider
    this.providers.set('azure', new AzureTTSProvider());
    
    // Register Google provider
    this.providers.set('google', new GoogleTTSProvider());
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
    
    // Initialize all enabled providers (hybrid architecture)
    // We no longer rely on the global settings.provider - voices determine the provider
    if (this.settings!.azureEnabled && this.settings!.azureApiKey) {
      console.log('[TTS] Initializing Azure provider (enabled and has API key)');
      await this.setProvider('azure');
    }
    
    if (this.settings!.googleEnabled && this.settings!.googleApiKey) {
      console.log('[TTS] Initializing Google provider (enabled and has API key)');
      await this.setProvider('google');
    }
    
    console.log('[TTS] Manager initialized. Providers ready:', Array.from(this.providers.keys()).join(', '));
  }

    /**
   * Load settings from database
   */
  private async loadSettings(): Promise<void> {
    const dbSettings = this.repository.getSettings();
    this.settings = SettingsMapper.fromDatabase(dbSettings);
  }

  /**
   * Set the active provider
   */
  async setProvider(providerName: string): Promise<void> {
    // Web Speech is handled in renderer, no backend provider needed
    if (providerName === 'webspeech') {
      this.currentProvider = null;
      return;
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      // Provider not implemented yet (e.g., Azure, Google in Phase 0)
      console.warn(`[TTS] Provider ${providerName} not yet implemented, falling back to webspeech`);
      this.currentProvider = null;
      // Don't throw error, just log warning and continue with webspeech
      return;
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
   * Resolve voice ID to actual provider voice name
   * For Azure voices, looks up the shortName from database metadata
   */
  private resolveVoiceId(voiceId: string): string {
    // For Azure voices, look up the shortName from the database
    if (voiceId?.startsWith('azure_')) {
      const voiceRecord = this.voicesRepo.getVoiceById(voiceId);
      if (voiceRecord?.metadata) {
        try {
          const metadata = JSON.parse(voiceRecord.metadata);
          if (metadata.shortName) {
            // Use the full Azure voice name (e.g., "en-US-AriaNeural")
            console.log(`[TTS] Resolved ${voiceId} -> ${metadata.shortName}`);
            return metadata.shortName;
          }
        } catch (err) {
          console.error('[TTS] Error parsing voice metadata:', err);
        }
      }
    }
    
    return voiceId;
  }

  /**
   * Send audio data to renderer for playback (for Azure/Google voices)
   * Helper method to eliminate code duplication
   */
  private sendAudioToRenderer(providerName: string, options: TTSOptions): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.error(`[TTS] ${providerName} provider not found`);
      return;
    }

    const audioData = (provider as any).getLastAudioData();
    if (audioData && this.mainWindow) {
      console.log(`[TTS] Sending ${providerName} audio to renderer (${audioData.length} bytes)`);
      this.mainWindow.webContents.send('tts:play-audio', {
        audioData: audioData.toString('base64'),
        volume: options.volume,
        rate: options.rate,
        pitch: options.pitch
      });
    } else if (!audioData) {
      console.warn(`[TTS] No audio data available from ${providerName}`);
    }
  }

  /**
   * Get provider name from voice ID prefix
   * Helper method to centralize routing logic
   */
  private getProviderFromVoiceId(voiceId: string): 'webspeech' | 'azure' | 'google' {
    if (voiceId?.startsWith('webspeech_')) return 'webspeech';
    if (voiceId?.startsWith('azure_')) return 'azure';
    if (voiceId?.startsWith('google_')) return 'google';
    // Fallback to settings provider
    return this.settings?.provider || 'webspeech';
  }
  /**
   * Speak text using current settings
   * Uses voice ID to determine provider (not global currentProvider)
   */
  async speak(text: string, options?: Partial<TTSOptions>): Promise<void> {
    if (!this.settings) {
      throw new Error('TTS not initialized');
    }

    if (!this.settings.enabled) {
      console.log('[TTS] TTS is disabled, not speaking');
      return;
    }

    const voiceId = options?.voiceId ?? this.settings.voiceId;
    
    // Web Speech is handled in renderer
    if (voiceId?.startsWith('webspeech_')) {
      return;
    }

    // Determine which provider to use based on voice ID prefix
    const provider = this.getProviderFromVoiceId(voiceId);
    const providerInstance = this.providers.get(provider);
    
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not available for voice: ${voiceId}`);
    }

    const resolvedVoiceId = this.resolveVoiceId(voiceId);
    
    const ttsOptions: TTSOptions = {
      volume: options?.volume ?? this.settings.volume,
      rate: options?.rate ?? this.settings.rate,
      pitch: options?.pitch ?? this.settings.pitch
    };

    await providerInstance.speak(text, resolvedVoiceId, ttsOptions);
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
  }  /**
   * Test a specific voice
   */
  async testVoice(voiceId: string, options?: Partial<TTSOptions>, message?: string): Promise<void> {
    console.log('[TTS Manager] testVoice() called with voiceId:', voiceId, 'message:', message);
    
    // Web Speech voices are handled in renderer (check voiceId prefix, not global provider)
    if (voiceId.startsWith('webspeech_')) {
      console.log('[TTS Manager] testVoice() - Web Speech voice, returning');
      return;
    }
    
    if (!this.settings) {
      throw new Error('TTS not initialized');
    }

    // Determine which provider to use based on voice ID prefix
    const provider = this.getProviderFromVoiceId(voiceId);
    const providerInstance = this.providers.get(provider);
    
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not available for voice: ${voiceId}`);
    }

    const actualVoiceId = this.resolveVoiceId(voiceId);
    console.log('[TTS Manager] testVoice() - Resolved voiceId:', actualVoiceId, 'using provider:', provider);

    const ttsOptions: TTSOptions = {
      volume: options?.volume ?? this.settings.volume,
      rate: options?.rate ?? this.settings.rate,
      pitch: options?.pitch ?? this.settings.pitch
    };
    
    console.log('[TTS Manager] testVoice() - Calling', provider, 'provider.test()');
    await providerInstance.test(actualVoiceId, ttsOptions, message);
    console.log('[TTS Manager] testVoice() - Provider test completed');
    
    // For Azure voices, retrieve audio data and send to renderer
    if (provider === 'azure') {
      this.sendAudioToRenderer('azure', ttsOptions);
    }

    // For Google voices, retrieve audio data and send to renderer
    if (provider === 'google') {
      this.sendAudioToRenderer('google', ttsOptions);
    }
  }
  /**
   * Save settings to database
   */
  async saveSettings(settings: Partial<TTSSettings>): Promise<void> {
    // Use centralized mapper to convert settings to database format
    const dbSettings = SettingsMapper.toDatabase(settings);
    this.repository.saveSettings(dbSettings);
    
    // Reload settings
    await this.loadSettings();
    
    // Re-initialize providers based on enabled flags and credentials
    // Azure provider
    if (settings.azureEnabled !== undefined || settings.azureApiKey !== undefined || settings.azureRegion !== undefined) {
      if (this.settings!.azureEnabled && this.settings!.azureApiKey) {
        console.log('[TTS] Azure enabled with API key - initializing');
        await this.setProvider('azure');
      } else {
        console.log('[TTS] Azure disabled or no API key - disposing provider');
        const azureProvider = this.providers.get('azure');
        if (azureProvider && (azureProvider as any).dispose) {
          (azureProvider as any).dispose();
        }
        // Set currentProvider to null if it was Azure
        if (this.currentProvider === azureProvider) {
          this.currentProvider = null;
        }
      }
    }
    
    // Google provider
    if (settings.googleEnabled !== undefined || settings.googleApiKey !== undefined) {
      if (this.settings!.googleEnabled && this.settings!.googleApiKey) {
        console.log('[TTS] Google enabled with API key - initializing');
        await this.setProvider('google');
      } else {
        console.log('[TTS] Google disabled or no API key - disposing provider');
        const googleProvider = this.providers.get('google');
        if (googleProvider && (googleProvider as any).dispose) {
          (googleProvider as any).dispose();
        }
        // Set currentProvider to null if it was Google
        if (this.currentProvider === googleProvider) {
          this.currentProvider = null;
        }
      }
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
    // Include azure and google as planned providers (Phase 1+)
    const backendProviders = Array.from(this.providers.keys());
    const plannedProviders = ['azure', 'google'].filter(p => !backendProviders.includes(p));
    return ['webspeech', ...backendProviders, ...plannedProviders];
  }

  /**
   * Determine provider from voice ID prefix (public wrapper for IPC handlers)
   * Provides centralized routing logic across all TTS operations
   */
  determineProviderFromVoiceId(voiceId: string): 'webspeech' | 'azure' | 'google' {
    return this.getProviderFromVoiceId(voiceId);
  }

  /**
   * Handle incoming chat message for TTS
   */
  async handleChatMessage(username: string, message: string, userId?: string): Promise<void> {
    if (!this.settings || !this.settings.enabled) {
      return; // TTS disabled
    }    // Check if bot (if filter enabled)
    if (this.settings.filterBots && this.isBot(username)) {
      console.log('[TTS] Skipping bot:', username);
      return;
    }    // Check user cooldown
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
    }    // Get global voice settings
    let voiceId = this.settings.voiceId;
    let pitch = this.settings.pitch;
    let rate = this.settings.rate;

    // Add to queue
    this.messageQueue.push({
      username,
      message: filteredMessage,
      voiceId,
      pitch,
      rate,
      timestamp: new Date().toISOString()
    });

    // Process queue
    this.processQueue();
  }

  /**
   * Filter and clean message before speaking
   */  private filterMessage(message: string): string | null {
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

    // Remove blocked words
    if (this.settings?.blockedWords && this.settings.blockedWords.length > 0) {
      filtered = this.removeBlockedWords(filtered);
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
   * Remove blocked words from message
   */
  private removeBlockedWords(message: string): string {
    if (!this.settings?.blockedWords || this.settings.blockedWords.length === 0) {
      return message;
    }

    let filtered = message;

    // Remove each blocked word (case-insensitive, as whole words)
    for (const blockedWord of this.settings.blockedWords) {
      if (!blockedWord.trim()) continue;
      
      // Create a regex that matches the word as a whole word (with word boundaries)
      // Use case-insensitive flag
      const regex = new RegExp(`\\b${blockedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      filtered = filtered.replace(regex, '');
    }

    // Clean up extra whitespace
    filtered = filtered.replace(/\s+/g, ' ').trim();

    return filtered;
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
        // Keep only the allowed number of emojis, remove the rest
        let emojiCount = 0;
        filtered = message.replace(emojiRegex, (match) => {
          emojiCount++;
          // Keep emojis within the limit, remove the rest
          return emojiCount <= this.settings!.maxEmojisPerMessage! ? match : '';
        });
        console.log('[TTS] Stripped excessive emojis (kept first', this.settings.maxEmojisPerMessage, ')');
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
   * Limit repeated characters (e.g., "woooooow" -> "wooow", "lolllll" -> "lolll")
   * Limits consecutive identical characters, NOT patterns like "haha"
   * BUT skip this filter for pure numbers to preserve values like "1000000"
   */
  private limitRepeatedCharacters(message: string): string {
    // Don't apply to pure numbers
    if (/^\d+$/.test(message.trim())) {
      return message;
    }

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
   * @param username - The username to check
   * @param cooldownSeconds - Optional custom cooldown in seconds (defaults to settings.userCooldownSeconds)
   */
  private checkUserCooldown(username: string, cooldownSeconds?: number): boolean {
    const cooldown = this.userCooldowns.get(username);
    if (!cooldown) return true;

    const now = Date.now();
    const seconds = cooldownSeconds ?? this.settings?.userCooldownSeconds ?? 30;
    const cooldownMs = seconds * 1000;
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

        // Determine provider from voice_id prefix (hybrid routing)
        const voiceId = item.voiceId || this.settings?.voiceId || '';
        const resolvedVoiceId = this.resolveVoiceId(voiceId);
        
        if (voiceId.startsWith('webspeech_')) {
          // Send to renderer process for Web Speech API
          if (this.mainWindow) {
            this.mainWindow.webContents.send('tts:speak', {
              text: textToSpeak,
              voiceId: voiceId,
              volume: this.settings?.volume,
              rate: item.rate ?? this.settings?.rate,
              pitch: item.pitch ?? this.settings?.pitch
            });
            
            // Wait for frontend to confirm Web Speech playback is complete
            console.log('[TTS] Waiting for Web Speech utterance to finish...');
            await this.waitForAudioFinished();
          }
        } else if (voiceId.startsWith('azure_')) {
          // Use Azure provider
          const azureProvider = this.providers.get('azure');
          if (azureProvider) {
            await azureProvider.speak(textToSpeak, resolvedVoiceId, {
              volume: this.settings?.volume,
              rate: item.rate ?? this.settings?.rate,
              pitch: item.pitch ?? this.settings?.pitch
            });
            
            // Get audio data and send to renderer for playback (OBS-compatible)
            this.sendAudioToRenderer('azure', {
              volume: this.settings?.volume,
              rate: item.rate ?? this.settings?.rate,
              pitch: item.pitch ?? this.settings?.pitch
            });
            
            // Wait for frontend to confirm audio playback is complete
            console.log('[TTS] Waiting for Azure audio playback to finish...');
            await this.waitForAudioFinished();
          } else {
            console.error('[TTS] Azure provider not available for voice:', voiceId);
          }        } else if (voiceId.startsWith('google_')) {
          // Use Google provider
          const googleProvider = this.providers.get('google');
          if (googleProvider) {
            await googleProvider.speak(textToSpeak, voiceId, {
              volume: this.settings?.volume,
              rate: item.rate ?? this.settings?.rate,
              pitch: item.pitch ?? this.settings?.pitch
            });
            
            // Get audio data and send to renderer for playback (OBS-compatible)
            this.sendAudioToRenderer('google', {
              volume: this.settings?.volume,
              rate: item.rate ?? this.settings?.rate,
              pitch: this.settings?.pitch
            });
            
            // Wait for frontend to confirm audio playback is complete
            console.log('[TTS] Waiting for Google audio playback to finish...');
            await this.waitForAudioFinished();
          } else {
            console.error('[TTS] Google provider not available for voice:', voiceId);
          }
        } else {
          console.error('[TTS] Unknown voice provider for voice_id:', voiceId);
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

  /**
   * Called when frontend notifies that audio playback has finished
   */
  onAudioFinished(): void {
    console.log('[TTS] Audio playback finished (confirmed by frontend)');
    if (this.audioFinishedResolver) {
      this.audioFinishedResolver();
      this.audioFinishedResolver = null;
    }
  }

  /**
   * Wait for frontend to confirm audio playback is complete
   */
  private waitForAudioFinished(): Promise<void> {
    return new Promise((resolve) => {
      this.audioFinishedResolver = resolve;
    });
  }
}
