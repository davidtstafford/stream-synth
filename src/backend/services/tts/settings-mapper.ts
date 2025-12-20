/**
 * Settings Mapper - Bidirectional mapping between database and TTS settings formats
 * 
 * Eliminates duplicate field mapping logic in loadSettings() and saveSettings()
 */

import { TTSSettings } from './base';

export class SettingsMapper {
  /**
   * Map database settings to TTSSettings interface
   */
  static fromDatabase(dbSettings: Record<string, any>): TTSSettings {
    return {
      enabled: dbSettings.tts_enabled ?? true,
      provider: (dbSettings.tts_provider ?? 'webspeech') as 'webspeech' | 'azure' | 'google' | 'aws',
      voiceId: dbSettings.tts_voice_id ?? '',
      volume: dbSettings.tts_volume ?? 80,
      rate: dbSettings.tts_rate ?? 1.0,
      pitch: dbSettings.tts_pitch ?? 1.0,
      // Provider enable flags (default: webspeech on, others off)
      webspeechEnabled: dbSettings.webspeech_enabled !== undefined ? dbSettings.webspeech_enabled as boolean : true,
      azureEnabled: dbSettings.azure_enabled !== undefined ? dbSettings.azure_enabled as boolean : false,
      googleEnabled: dbSettings.google_enabled !== undefined ? dbSettings.google_enabled as boolean : false,
      awsEnabled: dbSettings.aws_enabled !== undefined ? dbSettings.aws_enabled as boolean : false,
      // Provider credentials
      azureApiKey: dbSettings.azure_api_key ?? '',
      azureRegion: dbSettings.azure_region ?? '',
      googleApiKey: dbSettings.google_api_key ?? '',
      awsAccessKeyId: dbSettings.aws_access_key_id ?? '',
      awsSecretAccessKey: dbSettings.aws_secret_access_key ?? '',
      awsRegion: dbSettings.aws_region ?? '',
      awsIncludeNeuralVoices: dbSettings.aws_include_neural_voices !== undefined ? dbSettings.aws_include_neural_voices as boolean : true,
      // Basic TTS Rules
      filterCommands: dbSettings.filter_commands ?? true,
      filterBots: dbSettings.filter_bots ?? true,
      filterUrls: dbSettings.filter_urls ?? true,
      announceUsername: dbSettings.announce_username ?? false,
      minMessageLength: dbSettings.min_message_length ?? 0,
      maxMessageLength: dbSettings.max_message_length ?? 500,
      // Duplicate Detection
      skipDuplicateMessages: dbSettings.skip_duplicate_messages ?? true,
      duplicateMessageWindow: dbSettings.duplicate_message_window ?? 300,
      // Rate Limiting
      userCooldownEnabled: dbSettings.user_cooldown_enabled ?? false,
      userCooldownSeconds: dbSettings.user_cooldown_seconds ?? 30,
      globalCooldownEnabled: dbSettings.global_cooldown_enabled ?? false,
      globalCooldownSeconds: dbSettings.global_cooldown_seconds ?? 5,
      maxQueueSize: dbSettings.max_queue_size ?? 50,
      // Emote/Emoji Limits
      maxEmotesPerMessage: dbSettings.max_emotes_per_message ?? 10,
      maxEmojisPerMessage: dbSettings.max_emojis_per_message ?? 5,
      stripExcessiveEmotes: dbSettings.strip_excessive_emotes ?? true,
      // Character Repetition
      maxRepeatedChars: dbSettings.max_repeated_chars ?? 3,
      maxRepeatedWords: dbSettings.max_repeated_words ?? 2,      // Content Filters
      copypastaFilterEnabled: dbSettings.copypasta_filter_enabled ?? false,
      blockedWords: dbSettings.blocked_words 
        ? JSON.parse(dbSettings.blocked_words as string)
        : [],
      // Browser Source Output
      browserSourceEnabled: dbSettings.browser_source_enabled ?? false,
      browserSourceMuteApp: dbSettings.browser_source_mute_app ?? false
    };
  }

  /**
   * Map TTSSettings to database format (only fields that are defined)
   */
  static toDatabase(settings: Partial<TTSSettings>): Record<string, any> {
    const dbSettings: Record<string, any> = {};
    
    if (settings.enabled !== undefined) dbSettings.tts_enabled = settings.enabled;
    if (settings.provider !== undefined) dbSettings.tts_provider = settings.provider;
    if (settings.voiceId !== undefined) dbSettings.tts_voice_id = settings.voiceId;
    if (settings.volume !== undefined) dbSettings.tts_volume = settings.volume;
    if (settings.rate !== undefined) dbSettings.tts_rate = settings.rate;
    if (settings.pitch !== undefined) dbSettings.tts_pitch = settings.pitch;
    // Provider enable flags
    if (settings.webspeechEnabled !== undefined) dbSettings.webspeech_enabled = settings.webspeechEnabled;
    if (settings.azureEnabled !== undefined) dbSettings.azure_enabled = settings.azureEnabled;
    if (settings.googleEnabled !== undefined) dbSettings.google_enabled = settings.googleEnabled;
    if (settings.awsEnabled !== undefined) dbSettings.aws_enabled = settings.awsEnabled;
    // Provider credentials
    if (settings.azureApiKey !== undefined) dbSettings.azure_api_key = settings.azureApiKey;
    if (settings.azureRegion !== undefined) dbSettings.azure_region = settings.azureRegion;
    if (settings.googleApiKey !== undefined) dbSettings.google_api_key = settings.googleApiKey;
    if (settings.awsAccessKeyId !== undefined) dbSettings.aws_access_key_id = settings.awsAccessKeyId;
    if (settings.awsSecretAccessKey !== undefined) dbSettings.aws_secret_access_key = settings.awsSecretAccessKey;
    if (settings.awsRegion !== undefined) dbSettings.aws_region = settings.awsRegion;
    if (settings.awsIncludeNeuralVoices !== undefined) dbSettings.aws_include_neural_voices = settings.awsIncludeNeuralVoices;
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
    if (settings.maxRepeatedWords !== undefined) dbSettings.max_repeated_words = settings.maxRepeatedWords;    // Content filters
    if (settings.copypastaFilterEnabled !== undefined) dbSettings.copypasta_filter_enabled = settings.copypastaFilterEnabled;
    if (settings.blockedWords !== undefined) dbSettings.blocked_words = JSON.stringify(settings.blockedWords);
    // Browser Source Output
    if (settings.browserSourceEnabled !== undefined) dbSettings.browser_source_enabled = settings.browserSourceEnabled;
    if (settings.browserSourceMuteApp !== undefined) dbSettings.browser_source_mute_app = settings.browserSourceMuteApp;

    return dbSettings;
  }
}
