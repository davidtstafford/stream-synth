import { VoicesRepository } from '../../database/repositories/voices';
import { VoiceParser } from './voice-parser';
import { generateNumericVoiceId, VoiceProvider } from './voice-id-generator';
import { LanguageService } from './language-service';

export class VoiceSyncService {
  constructor(private voicesRepo: VoicesRepository) {}
  
  // Sync Web Speech voices - called only on app startup if not already synced
  async syncWebSpeechVoices(voices: any[]): Promise<number> {
    console.log(`[Voice Sync] Syncing ${voices.length} Web Speech voices`);
    
    if (!voices || voices.length === 0) {
      console.log('[Voice Sync] No Web Speech voices available');
      this.voicesRepo.updateProviderStatus('webspeech', true, 0);
      return 0;
    }
      // Purge existing voices for this provider (clean slate)
    this.voicesRepo.purgeProvider('webspeech');
    
    const voiceIds: string[] = [];
    // Upsert all voices with deterministic numeric IDs
    voices.forEach((voice, index) => {
      const parsed = VoiceParser.parseWebSpeechVoice(voice, index);
        // Determine language and country using language service
      const voiceLanguageInfo = LanguageService.normalizeVoiceLanguage(parsed);
      const languageName = voiceLanguageInfo?.languageName || parsed.language_name || 'Unknown';
      // Store full country name for UI display (e.g., "United States" not "US")
      const region = voiceLanguageInfo?.countryName || voiceLanguageInfo?.countryCode || parsed.region || null;
      
      // Enhance metadata with language info
      const enhancedMetadata = {
        ...JSON.parse(parsed.metadata || '{}'),
        languageCode: voiceLanguageInfo?.languageCode,
        countryCode: voiceLanguageInfo?.countryCode,
        countryName: voiceLanguageInfo?.countryName
      };
      
      this.voicesRepo.upsertVoice({
        voice_id: parsed.voice_id,
        provider: parsed.provider,
        name: parsed.name,
        language_name: languageName,
        region: region,
        gender: parsed.gender,
        metadata: JSON.stringify(enhancedMetadata)
      });
      voiceIds.push(parsed.voice_id);
    });

    // Update provider status
    this.voicesRepo.updateProviderStatus('webspeech', true, voiceIds.length);

    console.log(`[Voice Sync] Synced ${voiceIds.length} Web Speech voices`);
    return voiceIds.length;
  }

  // Sync Azure voices - called only on app startup if not already synced
  async syncAzureVoices(voices: any[]): Promise<number> {
    console.log(`[Voice Sync] Syncing ${voices.length} Azure voices`);
    
    if (!voices || voices.length === 0) {
      console.log('[Voice Sync] No Azure voices available');
      this.voicesRepo.updateProviderStatus('azure', true, 0);
      return 0;
    }
      // Purge existing voices for this provider (clean slate)
    this.voicesRepo.purgeProvider('azure');
    
    const voiceIds: string[] = [];
    
    // Upsert all voices with deterministic numeric IDs
    voices.forEach(voice => {      // Determine language and country using language service
      const voiceLanguageInfo = LanguageService.normalizeVoiceLanguage({
        languageName: voice.languageName,
        language: voice.language
      });
      const languageName = voiceLanguageInfo?.languageName || voice.languageName || 'Unknown';
      // Store full country name for UI display (e.g., "United States" not "US")
      const region = voiceLanguageInfo?.countryName || voiceLanguageInfo?.countryCode || null;
      
      // Enhance metadata with language info
      const enhancedMetadata = {
        styles: voice.styles || [],
        shortName: voice.shortName,
        languageCode: voiceLanguageInfo?.languageCode,
        countryCode: voiceLanguageInfo?.countryCode,
        countryName: voiceLanguageInfo?.countryName
      };
      
      // TTSVoice uses 'id' property, already has azure_ prefix from provider
      this.voicesRepo.upsertVoice({
        voice_id: voice.id,
        provider: 'azure',
        name: voice.name,
        language_name: languageName,
        region: region,
        gender: voice.gender,
        metadata: JSON.stringify(enhancedMetadata)
      });
      voiceIds.push(voice.id);
    });

    // Update provider status
    this.voicesRepo.updateProviderStatus('azure', true, voiceIds.length);
    
    console.log(`[Voice Sync] Synced ${voiceIds.length} Azure voices`);
    return voiceIds.length;
  }
  // Rescan provider voices immediately (fetch fresh voices and update UI now)
  async rescanProviderImmediate(provider: string, currentVoices: any[]): Promise<number> {
    console.log(`[Voice Sync] Immediate rescan for ${provider} with ${currentVoices.length} voices`);
    
    if (!currentVoices || currentVoices.length === 0) {
      console.log(`[Voice Sync] No ${provider} voices to sync`);
      return 0;
    }
    
    // Determine which sync method to use (each will purge + sync)
    if (provider === 'webspeech') {
      return this.syncWebSpeechVoices(currentVoices);
    } else if (provider === 'azure') {
      return this.syncAzureVoices(currentVoices);
    } else if (provider === 'google') {
      return this.syncGoogleVoices(currentVoices);
    }
    
    return 0;
  }

  // Check if a provider needs syncing (not yet synced in this session)
  needsSync(provider: string): boolean {
    const status = this.voicesRepo.getProviderStatus(provider);
    
    if (!status) {
      console.log(`[Voice Sync] ${provider} never synced before`);
      return true;
    }
    
    if (!status.last_synced_at) {
      console.log(`[Voice Sync] ${provider} sync pending`);
      return true;
    }
    
    if (!status.is_enabled) {
      console.log(`[Voice Sync] ${provider} is disabled, skipping`);
      return false;
    }
    
    console.log(`[Voice Sync] ${provider} already synced at ${status.last_synced_at}`);
    return false;
  }

  // Generic sync method that routes to appropriate provider
  async syncVoices(voices: any[]): Promise<number> {
    if (!voices || voices.length === 0) {
      console.log('[Voice Sync] No voices to sync');
      return 0;
    }
    
    // Determine provider from first voice's id (TTSVoice uses 'id' not 'voiceId')
    const firstVoiceId = voices[0].id || '';
    
    console.log(`[Voice Sync] First voice ID: ${firstVoiceId}`);
    
    if (firstVoiceId.startsWith('azure_')) {
      return this.syncAzureVoices(voices);
    } else if (firstVoiceId.startsWith('google_')) {
      return this.syncGoogleVoices(voices);
    } else {
      return this.syncWebSpeechVoices(voices);
    }
  }
  // Future: Sync Google voices
  async syncGoogleVoices(voices: any[]): Promise<number> {
    console.log(`[Voice Sync] Syncing ${voices.length} Google voices`);
    
    if (!voices || voices.length === 0) {
      console.log('[Voice Sync] No Google voices available');
      this.voicesRepo.updateProviderStatus('google', true, 0);
      return 0;
    }
      // Purge existing voices for this provider (clean slate)
    this.voicesRepo.purgeProvider('google');
    
    const voiceIds: string[] = [];
    
    // Upsert all voices with deterministic numeric IDs
    voices.forEach(voice => {      // Determine language and country using language service
      const voiceLanguageInfo = LanguageService.normalizeVoiceLanguage({
        language: voice.language,
        languageName: voice.languageName
      });
      const languageName = voiceLanguageInfo?.languageName || voice.languageName || voice.language || 'Unknown';
      // Store full country name for UI display (e.g., "United States" not "US")
      const region = voiceLanguageInfo?.countryName || voiceLanguageInfo?.countryCode || null;
      
      // Enhance metadata with language info
      const enhancedMetadata = {
        shortName: voice.shortName,
        sampleRateHertz: voice.sampleRateHertz,
        languageCode: voiceLanguageInfo?.languageCode,
        countryCode: voiceLanguageInfo?.countryCode,
        countryName: voiceLanguageInfo?.countryName
      };
      
      // TTSVoice uses 'id' property, already has google_ prefix from provider
      this.voicesRepo.upsertVoice({
        voice_id: voice.id,
        provider: 'google',
        name: voice.name,
        language_name: languageName,
        region: region,
        gender: voice.gender,
        metadata: JSON.stringify(enhancedMetadata)
      });
      voiceIds.push(voice.id);
    });

    // Update provider status
    this.voicesRepo.updateProviderStatus('google', true, voiceIds.length);
    
    console.log(`[Voice Sync] Synced ${voiceIds.length} Google voices`);
    return voiceIds.length;
  }

  // Get stats
  getStats() {
    return this.voicesRepo.getStats();
  }
}
