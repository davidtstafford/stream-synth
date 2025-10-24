import { VoicesRepository } from '../../database/repositories/voices';
import { VoiceParser } from './voice-parser';

export class VoiceSyncService {
  constructor(private voicesRepo: VoicesRepository) {}

  // Sync Web Speech voices
  async syncWebSpeechVoices(voices: any[]): Promise<number> {
    console.log(`[Voice Sync] Syncing ${voices.length} Web Speech voices`);
    
    const voiceIds: string[] = [];
    
    voices.forEach((voice, index) => {
      const parsed = VoiceParser.parseWebSpeechVoice(voice, index);
      this.voicesRepo.upsertVoice({ ...parsed, is_available: 1 });
      voiceIds.push(parsed.voice_id);
    });

    // Mark only Web Speech voices not in current list as unavailable (don't touch other providers)
    this.voicesRepo.markUnavailableExcept('webspeech', voiceIds);

    console.log(`[Voice Sync] Synced ${voiceIds.length} voices`);
    return voiceIds.length;
  }

  // Sync Azure voices
  async syncAzureVoices(voices: any[]): Promise<number> {
    console.log(`[Voice Sync] Syncing ${voices.length} Azure voices`);
    
    const voiceIds: string[] = [];
    
    voices.forEach(voice => {
      // TTSVoice uses 'id' property, already has azure_ prefix from provider
      this.voicesRepo.upsertVoice({
        voice_id: voice.id,
        provider: 'azure',
        source: 'Azure Neural',
        name: voice.name,
        language_code: voice.language,
        language_name: voice.languageName,
        region: voice.language, // Using language code as region
        gender: voice.gender,
        is_available: 1,
        display_order: null,
        metadata: JSON.stringify({ 
          styles: voice.styles || [],
          shortName: voice.shortName  // Store full Azure voice name (e.g., "en-US-AriaNeural")
        })
      });
      voiceIds.push(voice.id);
    });

    console.log(`[Voice Sync] Synced ${voiceIds.length} Azure voices`);
    return voiceIds.length;
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
    // TODO: Implement when adding Google
    return 0;
  }

  // Get stats
  getStats() {
    return this.voicesRepo.getStats();
  }
}
