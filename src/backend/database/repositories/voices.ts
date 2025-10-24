import { getDatabase } from '../connection';

export interface VoiceRecord {
  id: number;
  voice_id: string;
  provider: string;
  source: string | null;
  name: string;
  language_code: string;
  language_name: string;
  region: string | null;
  gender: string | null;
  is_available: number;
  display_order: number | null;
  last_seen_at: string | null;
  created_at: string;
  metadata: string | null;
}

export interface VoiceWithNumericId extends VoiceRecord {
  numeric_id: number;
}

export class VoicesRepository {
  // Create or update a voice
  upsertVoice(voice: Omit<VoiceRecord, 'id' | 'created_at' | 'last_seen_at'>): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const existing = db.prepare(
      'SELECT id FROM tts_voices WHERE voice_id = ?'
    ).get(voice.voice_id) as { id: number } | undefined;

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE tts_voices 
        SET provider = ?, source = ?, name = ?, language_code = ?,
            language_name = ?, region = ?, gender = ?, is_available = 1,
            display_order = ?, last_seen_at = ?, metadata = ?
        WHERE voice_id = ?
      `).run(
        voice.provider,
        voice.source,
        voice.name,
        voice.language_code,
        voice.language_name,
        voice.region,
        voice.gender,
        voice.display_order,
        now,
        voice.metadata,
        voice.voice_id
      );
      return existing.id;
    } else {
      // Insert new
      const result = db.prepare(`
        INSERT INTO tts_voices (
          voice_id, provider, source, name, language_code, language_name,
          region, gender, is_available, display_order, last_seen_at, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        voice.voice_id,
        voice.provider,
        voice.source,
        voice.name,
        voice.language_code,
        voice.language_name,
        voice.region,
        voice.gender,
        voice.display_order,
        now,
        now,
        voice.metadata
      );
      
      // Assign numeric ID
      db.prepare(`
        INSERT INTO tts_voice_ids (voice_id) VALUES (?)
      `).run(voice.voice_id);
      
      return result.lastInsertRowid as number;
    }
  }

  // Mark voices as unavailable if not in current list (provider-specific)
  markUnavailableExcept(provider: string, currentVoiceIds: string[]): void {
    const db = getDatabase();
    
    if (currentVoiceIds.length === 0) {
      // Mark all voices from this provider as unavailable
      db.prepare(`
        UPDATE tts_voices 
        SET is_available = 0 
        WHERE voice_id LIKE ?
      `).run(`${provider}_%`);
      return;
    }
    
    const placeholders = currentVoiceIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE tts_voices 
      SET is_available = 0 
      WHERE voice_id LIKE ? AND voice_id NOT IN (${placeholders})
    `).run(`${provider}_%`, ...currentVoiceIds);
  }

  // Mark voices as unavailable if not in current list (deprecated - use markUnavailableExcept)
  markUnavailable(currentVoiceIds: string[]): void {
    const db = getDatabase();
    
    if (currentVoiceIds.length === 0) {
      // Mark all as unavailable
      db.prepare('UPDATE tts_voices SET is_available = 0').run();
      return;
    }
    
    const placeholders = currentVoiceIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE tts_voices 
      SET is_available = 0 
      WHERE voice_id NOT IN (${placeholders})
    `).run(...currentVoiceIds);
  }

  // Mark all voices from a specific provider as unavailable
  markProviderUnavailable(provider: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE tts_voices 
      SET is_available = 0 
      WHERE voice_id LIKE ?
    `).run(`${provider}_%`);
    console.log(`[Voices] Marked all ${provider} voices as unavailable`);
  }

  // Mark all voices from a specific provider as available
  markProviderAvailable(provider: string): void {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE tts_voices 
      SET is_available = 1 
      WHERE voice_id LIKE ?
    `).run(`${provider}_%`);
    console.log(`[Voices] Marked ${result.changes} ${provider} voices as available`);
  }

  // Get all available voices with numeric IDs
  getAvailableVoices(): VoiceWithNumericId[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT v.*, n.numeric_id
      FROM tts_voices v
      LEFT JOIN tts_voice_ids n ON v.voice_id = n.voice_id
      WHERE v.is_available = 1
      ORDER BY v.provider, v.language_code, v.source, v.display_order, v.name
    `).all() as VoiceWithNumericId[];
  }

  // Get voice by numeric ID
  getVoiceByNumericId(numericId: number): VoiceWithNumericId | undefined {
    const db = getDatabase();
    return db.prepare(`
      SELECT v.*, n.numeric_id
      FROM tts_voices v
      JOIN tts_voice_ids n ON v.voice_id = n.voice_id
      WHERE n.numeric_id = ?
    `).get(numericId) as VoiceWithNumericId | undefined;
  }

  // Get voice by voice_id
  getVoiceById(voiceId: string): VoiceWithNumericId | undefined {
    const db = getDatabase();
    return db.prepare(`
      SELECT v.*, n.numeric_id
      FROM tts_voices v
      LEFT JOIN tts_voice_ids n ON v.voice_id = n.voice_id
      WHERE v.voice_id = ?
    `).get(voiceId) as VoiceWithNumericId | undefined;
  }

  // Get grouped voices for dropdown
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
    if (voice.source) parts.push(voice.source);
    parts.push(voice.language_name);
    if (voice.region) parts.push(voice.region);
    return parts.join(' - ');
  }

  // Stats for display
  getStats(): { total: number; available: number; byProvider: Record<string, number> } {
    const db = getDatabase();
    const total = db.prepare('SELECT COUNT(*) as count FROM tts_voices').get() as { count: number };
    const available = db.prepare('SELECT COUNT(*) as count FROM tts_voices WHERE is_available = 1').get() as { count: number };
    const byProvider = db.prepare(`
      SELECT provider, COUNT(*) as count 
      FROM tts_voices 
      WHERE is_available = 1 
      GROUP BY provider
    `).all() as { provider: string; count: number }[];

    const providerCounts: Record<string, number> = {};
    byProvider.forEach(row => {
      providerCounts[row.provider] = row.count;
    });

    return {
      total: total.count,
      available: available.count,
      byProvider: providerCounts
    };
  }
}
