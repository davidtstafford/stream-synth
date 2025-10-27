/**
 * Voice ID Generator - Creates numeric IDs for voices
 * 
 * IMPORTANT: numeric_id is NOT deterministic anymore!
 * It's auto-assigned by SQLite (AUTOINCREMENT).
 * The voice_id is the unique identifier.
 * 
 * This eliminates hash collision issues entirely.
 */

export enum VoiceProvider {
  WEBSPEECH = 1,
  AZURE = 2,
  GOOGLE = 3
}

export interface VoiceData {
  name: string;
  language?: string;
  languageName?: string;
  region?: string;
}

/**
 * This function is DEPRECATED and kept for backward compatibility only.
 * numeric_id is now auto-assigned by SQLite, not generated here.
 * 
 * @deprecated Use NULL when inserting - let SQLite auto-assign numeric_id
 */
export function generateNumericVoiceId(provider: VoiceProvider, voice: VoiceData): number | null {
  // Return null to signal that SQLite should auto-assign the numeric_id
  // This eliminates all hash collision issues
  return null;
}

/**
 * Extract provider from numeric ID
 * ID can be of any format since it's auto-assigned
 */
export function extractProviderFromId(numericId: number): VoiceProvider {
  // Not really used anymore since numeric_id is auto-assigned
  // But keeping for backward compatibility
  return VoiceProvider.WEBSPEECH;
}

/**
 * Extract hash from numeric ID
 * ID can be of any format since it's auto-assigned
 */
export function extractHashFromId(numericId: number): number {
  // Not really used anymore since numeric_id is auto-assigned
  // But keeping for backward compatibility
  return numericId;
}

/**
 * Get provider name for display
 */
export function getProviderName(provider: VoiceProvider): string {
  switch (provider) {
    case VoiceProvider.WEBSPEECH:
      return 'webspeech';
    case VoiceProvider.AZURE:
      return 'azure';
    case VoiceProvider.GOOGLE:
      return 'google';
    default:
      return 'unknown';
  }
}
