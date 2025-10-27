import { getDatabase } from '../connection';
import { 
  generateNumericVoiceId, 
  extractProviderFromId,
  VoiceProvider,
  getProviderName 
} from '../../services/tts/voice-id-generator';

export interface VoiceRecord {
  voice_id: string;
  numeric_id: number | null;
  name: string;
  language_name: string;
  region: string | null;
  gender: string | null;
  provider: string;
  metadata: string | null;
  created_at: string;
}

export interface VoiceWithNumericId extends VoiceRecord {
  numeric_id: number;
}

export interface ProviderStatus {
  provider: string;
  is_enabled: number;
  last_synced_at: string | null;
  voice_count: number;
  created_at: string;
  updated_at: string;
}

export class VoicesRepository {
  // Get provider table name from provider string
  private getTableName(provider: string): string {
    switch (provider) {
      case 'webspeech':
        return 'webspeech_voices';
      case 'azure':
        return 'azure_voices';
      case 'google':
        return 'google_voices';
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // Get VoiceProvider enum from provider string
  private getProviderEnum(provider: string): VoiceProvider {
    switch (provider) {
      case 'webspeech':
        return VoiceProvider.WEBSPEECH;
      case 'azure':
        return VoiceProvider.AZURE;
      case 'google':
        return VoiceProvider.GOOGLE;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // Create or update a voice in the provider-specific table
  upsertVoice(voice: Omit<VoiceRecord, 'created_at' | 'numeric_id'>): string {
    const db = getDatabase();
    const now = new Date().toISOString();
    const table = this.getTableName(voice.provider);
    
    // Generate deterministic numeric ID
    const numeric_id = generateNumericVoiceId(this.getProviderEnum(voice.provider), {
      name: voice.name,
      language: voice.name, // Use name as identifier for consistency
      languageName: voice.language_name,
      region: voice.region || undefined
    });
    
    const existing = db.prepare(
      `SELECT voice_id FROM ${table} WHERE voice_id = ?`
    ).get(voice.voice_id) as { voice_id: string } | undefined;

    if (existing) {
      // Update existing voice
      db.prepare(`
        UPDATE ${table}
        SET name = ?, language_name = ?, region = ?, gender = ?, 
            provider = ?, metadata = ?
        WHERE voice_id = ?
      `).run(
        voice.name,
        voice.language_name,
        voice.region,
        voice.gender,
        voice.provider,
        voice.metadata,
        voice.voice_id
      );
    } else {
      // Insert new voice with deterministic numeric ID
      db.prepare(`
        INSERT INTO ${table} (voice_id, numeric_id, name, language_name, region, gender, provider, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        voice.voice_id,
        numeric_id,
        voice.name,
        voice.language_name,
        voice.region,
        voice.gender,
        voice.provider,
        voice.metadata,
        now
      );
    }
    
    return voice.voice_id;
  }

  // Purge all voices for a provider (truncate provider-specific table)
  purgeProvider(provider: string): void {
    const db = getDatabase();
    const table = this.getTableName(provider);
    
    const result = db.prepare(`DELETE FROM ${table}`).run();
    
    console.log(`[Voices] Purged all ${provider} voices from ${table} (${result.changes} rows)`);
  }

  // Assign numeric IDs using deterministic hashing (no sequential IDs)
  // This is now a no-op since numeric IDs are assigned during upsertVoice
  assignNumericIds(provider: string): void {
    // With deterministic hashing, numeric IDs are already assigned during upsert
    // This method is kept for backward compatibility but does nothing
    console.log(`[Voices] Numeric IDs already assigned via hashing for ${provider}`);
  }
  // Get all voices for a provider
  getVoicesByProvider(provider: string): VoiceWithNumericId[] {
    const db = getDatabase();
    const table = this.getTableName(provider);
    
    return db.prepare(`
      SELECT * FROM ${table}
      ORDER BY numeric_id, name
    `).all() as VoiceWithNumericId[];
  }

  // Get all available voices across all providers with numeric IDs
  getAvailableVoices(): VoiceWithNumericId[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM all_voices
      ORDER BY provider, language_name, name
    `).all() as VoiceWithNumericId[];
  }

  // Get voice by numeric ID (searches across all provider tables)
  getVoiceByNumericId(numericId: number): VoiceWithNumericId | undefined {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM all_voices WHERE numeric_id = ?
    `).get(numericId) as VoiceWithNumericId | undefined;
  }

  // Get voice by voice_id (searches across all provider tables)
  getVoiceById(voiceId: string): VoiceWithNumericId | undefined {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM all_voices WHERE voice_id = ?
    `).get(voiceId) as VoiceWithNumericId | undefined;
  }

  // Get grouped voices for dropdown/display
  getGroupedVoices(): Map<string, VoiceWithNumericId[]> {
    const voices = this.getAvailableVoices();
    const grouped = new Map<string, VoiceWithNumericId[]>();

    voices.forEach(voice => {
      const key = this.getGroupKey(voice);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(voice);
    });

    return grouped;
  }

  private getGroupKey(voice: VoiceRecord): string {
    const parts = [voice.provider];
    parts.push(voice.language_name);
    if (voice.region) parts.push(voice.region);
    return parts.join(' - ');
  }
  // Provider status methods
  getProviderStatus(provider: string): ProviderStatus | undefined {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM tts_provider_status WHERE provider = ?'
    ).get(provider) as ProviderStatus | undefined;
  }

  updateProviderStatus(provider: string, isEnabled: boolean, voiceCount: number): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const existing = this.getProviderStatus(provider);
    
    if (existing) {
      db.prepare(`
        UPDATE tts_provider_status 
        SET is_enabled = ?, voice_count = ?, last_synced_at = ?, updated_at = ?
        WHERE provider = ?
      `).run(isEnabled ? 1 : 0, voiceCount, now, now, provider);
    } else {
      db.prepare(`
        INSERT INTO tts_provider_status (provider, is_enabled, voice_count, last_synced_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(provider, isEnabled ? 1 : 0, voiceCount, now, now, now);
    }
    
    console.log(`[Voices] Updated provider status: ${provider} (enabled=${isEnabled}, voices=${voiceCount})`);
  }

  clearProviderSyncStatus(provider: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE tts_provider_status 
      SET last_synced_at = NULL, updated_at = ?
      WHERE provider = ?
    `).run(now, provider);
    
    console.log(`[Voices] Cleared sync status for ${provider}`);
  }

  // Stats for display
  getStats(): { total: number; available: number; byProvider: Record<string, number> } {
    const db = getDatabase();
    const total = db.prepare('SELECT COUNT(*) as count FROM all_voices').get() as { count: number };
    const byProvider = db.prepare(`
      SELECT provider, COUNT(*) as count 
      FROM all_voices 
      GROUP BY provider
    `).all() as { provider: string; count: number }[];

    const providerCounts: Record<string, number> = {};
    byProvider.forEach(row => {
      providerCounts[row.provider] = row.count;
    });

    return {
      total: total.count,
      available: total.count,
      byProvider: providerCounts
    };
  }
}
