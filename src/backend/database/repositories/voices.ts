import { getDatabase } from '../connection';

export interface VoiceRecord {
  voice_id: string;
  provider: string;
  source: string | null;
  name: string;
  language_code: string;
  language_name: string;
  region: string | null;
  gender: string | null;
  display_order: number | null;
  created_at: string;
  metadata: string | null;
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
  // Create or update a voice (using voice_id as natural key)
  upsertVoice(voice: Omit<VoiceRecord, 'created_at'>): string {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const existing = db.prepare(
      'SELECT voice_id FROM tts_voices WHERE voice_id = ?'
    ).get(voice.voice_id) as { voice_id: string } | undefined;

    if (existing) {
      // Update existing - don't touch numeric_id
      db.prepare(`
        UPDATE tts_voices 
        SET provider = ?, source = ?, name = ?, language_code = ?,
            language_name = ?, region = ?, gender = ?,
            display_order = ?, metadata = ?
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
        voice.metadata,
        voice.voice_id
      );
    } else {
      // Insert new voice (numeric_id will be auto-assigned in reassignNumericIds)
      db.prepare(`
        INSERT INTO tts_voices (
          voice_id, provider, source, name, language_code, language_name,
          region, gender, display_order, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        voice.metadata
      );
    }
    
    return voice.voice_id;
  }
  // Purge all voices and numeric IDs for a provider (clean slate on rescan)
  purgeProvider(provider: string): void {
    const db = getDatabase();
    
    // Get all voice_ids for this provider first
    const voiceIds = db.prepare(
      'SELECT voice_id FROM tts_voices WHERE provider = ?'
    ).all(provider) as { voice_id: string }[];
    
    // Delete numeric ID mappings
    for (const { voice_id } of voiceIds) {
      db.prepare('DELETE FROM tts_voice_ids WHERE voice_id = ?').run(voice_id);
    }
    
    // Delete voices
    const result = db.prepare(
      'DELETE FROM tts_voices WHERE provider = ?'
    ).run(provider);
    
    console.log(`[Voices] Purged ${result.changes} ${provider} voices and their numeric ID mappings`);
  }

  // Assign sequential numeric IDs to all voices for a provider (1, 2, 3...)
  assignNumericIds(provider: string): void {
    const db = getDatabase();
    
    // Get all voices for this provider in order
    const voices = db.prepare(`
      SELECT voice_id FROM tts_voices 
      WHERE provider = ? 
      ORDER BY display_order, language_code, name
    `).all(provider) as { voice_id: string }[];

    let nextId = 1;
    
    for (const voice of voices) {
      // Insert new numeric ID (no existing ones since we just purged)
      db.prepare(
        'INSERT INTO tts_voice_ids (numeric_id, voice_id) VALUES (?, ?)'
      ).run(nextId, voice.voice_id);
      nextId++;
    }
      console.log(`[Voices] Assigned numeric IDs for ${provider}: ${voices.length} voices`);
  }

  // Get all voices for a provider
  getVoicesByProvider(provider: string): VoiceWithNumericId[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT v.*, n.numeric_id
      FROM tts_voices v
      LEFT JOIN tts_voice_ids n ON v.voice_id = n.voice_id
      WHERE v.provider = ?
      ORDER BY COALESCE(n.numeric_id, 999999), v.name
    `).all(provider) as VoiceWithNumericId[];
  }

  // Get all available voices with numeric IDs
  getAvailableVoices(): VoiceWithNumericId[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT v.*, n.numeric_id
      FROM tts_voices v
      LEFT JOIN tts_voice_ids n ON v.voice_id = n.voice_id
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

  // Get voice by voice_id (natural key)
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
    const total = db.prepare('SELECT COUNT(*) as count FROM tts_voices').get() as { count: number };
    const byProvider = db.prepare(`
      SELECT provider, COUNT(*) as count 
      FROM tts_voices 
      GROUP BY provider
    `).all() as { provider: string; count: number }[];

    const providerCounts: Record<string, number> = {};
    byProvider.forEach(row => {
      providerCounts[row.provider] = row.count;
    });

    return {
      total: total.count,
      available: total.count, // All stored voices are considered available in new design
      byProvider: providerCounts
    };
  }
}
