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

    // Mark voices not in current list as unavailable
    this.voicesRepo.markUnavailable(voiceIds);

    console.log(`[Voice Sync] Synced ${voiceIds.length} voices`);
    return voiceIds.length;
  }

  // Future: Sync Azure voices
  async syncAzureVoices(voices: any[]): Promise<number> {
    // TODO: Implement when adding Azure
    return 0;
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
