/**
 * TTS Base Types and Interfaces
 * 
 * Shared types for all TTS providers
 */

export interface TTSVoice {
  id: string;                    // Unique identifier for the voice
  name: string;                  // Display name (e.g., "David")
  language: string;              // Language code (e.g., "en-US")
  languageName: string;          // Human-readable language (e.g., "English (US)")
  gender: 'male' | 'female' | 'neutral';
  provider: 'webspeech' | 'azure' | 'google';
  styles?: string[];             // Voice styles (Azure only)
  sampleRateHertz?: number;      // Sample rate (Google only)
}

export interface TTSOptions {
  volume?: number;     // 0-100
  rate?: number;       // 0.5-2.0 (speech speed)
  pitch?: number;      // 0.5-2.0 (voice pitch)
}

export interface TTSSettings {
  enabled: boolean;
  provider: 'webspeech' | 'azure' | 'google';
  voiceId: string;
  volume: number;
  rate: number;
  pitch: number;
  azureApiKey?: string;
  azureRegion?: string;
  googleApiKey?: string;
  // Basic TTS Rules
  filterCommands?: boolean;
  filterBots?: boolean;
  filterUrls?: boolean;
  announceUsername?: boolean;
  minMessageLength?: number;
  maxMessageLength?: number;
  // Duplicate Detection
  skipDuplicateMessages?: boolean;
  duplicateMessageWindow?: number; // seconds
  // Rate Limiting
  userCooldownEnabled?: boolean;
  userCooldownSeconds?: number;
  globalCooldownEnabled?: boolean;
  globalCooldownSeconds?: number;
  maxQueueSize?: number;
  // Emote/Emoji Limits
  maxEmotesPerMessage?: number;
  maxEmojisPerMessage?: number;
  stripExcessiveEmotes?: boolean;
  // Character Repetition
  maxRepeatedChars?: number;
  maxRepeatedWords?: number;
  // Content Filters
  copypastaFilterEnabled?: boolean;
}

export interface TTSProvider {
  name: string;
  needsApiKey: boolean;
  
  /**
   * Initialize the provider with credentials if needed
   */
  initialize(credentials?: { apiKey?: string; region?: string }): Promise<void>;
  
  /**
   * Get list of available voices
   */
  getVoices(): Promise<TTSVoice[]>;
  
  /**
   * Speak text using specified voice
   */
  speak(text: string, voiceId: string, options?: TTSOptions): Promise<void>;
  
  /**
   * Stop speaking
   */
  stop(): void;
  
  /**
   * Test a voice with a sample message
   */
  test(voiceId: string, options?: TTSOptions): Promise<void>;
}

export interface TTSUsageStats {
  provider: string;
  charactersUsed: number;
  charactersLimit: number;
  isUnlimited: boolean;
  resetDate?: string;
}
