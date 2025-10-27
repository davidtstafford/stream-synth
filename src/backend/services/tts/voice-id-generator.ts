/**
 * Voice ID Generator - Creates deterministic numeric IDs for voices
 * 
 * ID Format: PPXXXXXX where:
 * - PP = Provider prefix (1=WebSpeech, 2=Azure, 3=Google)
 * - XXXXXX = 6-digit hash of voice data
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
 * Generate a deterministic numeric ID for a voice
 * Same voice always produces same ID
 */
export function generateNumericVoiceId(provider: VoiceProvider, voice: VoiceData): number {
  // Create unique key from voice characteristics
  const voiceKey = `${voice.name}|${voice.language || ''}|${voice.languageName || ''}|${voice.region || ''}`;
  
  // Generate hash (djb2 algorithm - simple and effective)
  let hash = 5381;
  for (let i = 0; i < voiceKey.length; i++) {
    const char = voiceKey.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
  }
  
  // Make positive and constrain to 6 digits
  hash = Math.abs(hash) % 1000000;
  
  // Combine provider prefix with hash
  // Result: 1XXXXXX, 2XXXXXX, or 3XXXXXX
  return (provider * 1000000) + hash;
}

/**
 * Extract provider from numeric ID
 */
export function extractProviderFromId(numericId: number): VoiceProvider {
  return Math.floor(numericId / 1000000) as VoiceProvider;
}

/**
 * Extract hash from numeric ID
 */
export function extractHashFromId(numericId: number): number {
  return numericId % 1000000;
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
