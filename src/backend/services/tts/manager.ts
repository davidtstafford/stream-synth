import { TTSProvider, TTSVoice, TTSSettings, TTSOptions } from './base';
import { TTSRepository } from '../../database/repositories/tts';
import Database from 'better-sqlite3';

export class TTSManager {
  private providers: Map<string, TTSProvider>;
  private currentProvider: TTSProvider | null = null;
  private repository: TTSRepository;
  private settings: TTSSettings | null = null;

  constructor(db: Database.Database) {
    this.repository = new TTSRepository(db);
    this.providers = new Map();
    
    // Note: Web Speech API runs in renderer process
    // Azure and Google providers will be initialized here
    // TODO: Initialize Azure and Google providers when implemented
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
      googleApiKey: dbSettings.google_api_key as string || ''
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
}
