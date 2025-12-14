/**
 * Google Cloud Text-to-Speech Provider
 * 
 * Implements TTS using Google Cloud Text-to-Speech
 * Documentation: https://cloud.google.com/text-to-speech/docs
 */

import fetch from 'node-fetch';
import { TTSProvider, TTSVoice, TTSOptions } from './base';

export class GoogleTTSProvider implements TTSProvider {
  name = 'google';
  needsApiKey = true;
  
  private apiKey: string = '';
  private isInitialized: boolean = false;
  private lastAudioData: Buffer | null = null;

  /**
   * Initialize the Google provider with API credentials
   */
  async initialize(credentials?: { apiKey?: string }): Promise<void> {
    console.log('[Google TTS] initialize() called');
    
    if (!credentials?.apiKey) {
      throw new Error('Google TTS requires apiKey');
    }

    this.apiKey = credentials.apiKey;

    try {
      // Test the API key by fetching voices
      console.log('[Google TTS] Testing API key...');
      await this.getVoices();
      
      this.isInitialized = true;
      console.log('[Google TTS] Initialized successfully');
    } catch (error) {
      console.error('[Google TTS] Initialization error:', error);
      throw new Error(`Failed to initialize Google TTS: ${error}`);
    }
  }

  /**
   * Get list of available voices from Google Cloud
   */
  async getVoices(): Promise<TTSVoice[]> {
    console.log('[Google TTS] Fetching voices...');
    
    const endpoint = 'https://texttospeech.googleapis.com/v1/voices';
    console.log('[Google TTS] Request endpoint:', endpoint);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[Google TTS] Request timeout - aborting');
      controller.abort();
    }, 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
        signal: controller.signal
      });
      
      console.log('[Google TTS] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Google TTS] Error response body:', errorText);
        throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const googleVoices = data.voices || [];
      console.log(`[Google TTS] Retrieved ${googleVoices.length} voices from API`);
      
      // Filter out incomplete voice aliases that don't follow Google's standard naming pattern
      // Valid patterns: "en-US-Standard-A", "en-US-Neural2-C", "hr-HR-Chirp3-HD-Puck"
      // Invalid: "Puck", "Laomedeia" (these are aliases that require model specification)
      const validVoices = googleVoices.filter((voice: any) => {
        const name = voice.name || '';
        // Valid Google voice names should contain at least one hyphen
        // This filters out simple aliases like "Puck" while keeping full names like "en-US-Chirp3-HD-Puck"
        return name.includes('-');
      });
      
      console.log(`[Google TTS] Filtered to ${validVoices.length} valid voices (removed ${googleVoices.length - validVoices.length} incomplete aliases)`);
      
      const voices: TTSVoice[] = validVoices.map((voice: any) => this.mapGoogleVoice(voice));
      console.log(`[Google TTS] Mapped to ${voices.length} internal voice objects`);
      return voices;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[Google TTS] Request was aborted due to timeout');
        throw new Error('Request to Google Cloud timed out. Verify your internet connection and API key.');
      }
      console.error('[Google TTS] Error retrieving voices:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map Google voice info to our TTSVoice format
   */
  private mapGoogleVoice(voice: any): TTSVoice {
    // Extract language code (e.g., "en-US" from "en-US-Standard-A")
    const languageCode = voice.languageCodes[0] || 'en-US';
    
    // Determine gender
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    const genderStr = (voice.ssmlGender || '').toLowerCase();
    if (genderStr === 'female') {
      gender = 'female';
    } else if (genderStr === 'male') {
      gender = 'male';
    }

    // Build voice_id: google_<voiceName>
    const voiceId = `google_${voice.name}`;

    // Get natural name and language name
    const name = voice.name || '';
    const languageName = this.getLanguageName(languageCode);

    return {
      id: voiceId,
      name: `${name}`,
      language: languageCode,
      languageName,
      gender,
      provider: 'google',
      sampleRateHertz: voice.naturalSampleRateHertz || 24000,
      shortName: voice.name // Store full voice name for later use
    };
  }

  /**
   * Get human-readable language name from language code
   */
  private getLanguageName(languageCode: string): string {
    const languageNames: { [key: string]: string } = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'en-AU': 'English (Australia)',
      'en-IN': 'English (India)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'fr-FR': 'French',
      'fr-CA': 'French (Canada)',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'pt-BR': 'Portuguese (Brazil)',
      'pt-PT': 'Portuguese (Portugal)',
      'ru-RU': 'Russian',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
    };
    
    return languageNames[languageCode] || languageCode;
  }
  /**
   * Extract language code from voice name
   * Google voice names follow pattern: <languageCode>-<variant>
   * e.g., "en-US-Standard-A" -> "en-US", "sv-SE-Chirp3-HD-Charon" -> "sv-SE"
   */
  private extractLanguageCode(voiceName: string): string {
    // Try to extract language code (first 5 chars if in xx-XX format)
    const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
    if (match) {
      return match[1];
    }
    // Fallback to first part before dash
    const parts = voiceName.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`;
    }
    return 'en-US'; // Final fallback
  }

  /**
   * Check if a voice supports pitch adjustment
   * Some Google voices (like newer neural voices) don't support pitch parameters
   */
  private supportsPitch(voiceName: string): boolean {
    // Voices known NOT to support pitch - typically newer neural/Studio voices
    const noPitchVoices = [
      'Chirp', // Neural voice line
      'Journey', // Neural voice line
      'Casual', // Casual voices
      'Studio' // Studio voices
    ];
    
    // Check if voice name contains any known no-pitch markers
    return !noPitchVoices.some(marker => voiceName.includes(marker));
  }

  /**
   * Synthesize speech using Google Cloud Text-to-Speech
   */
  async speak(text: string, voiceId: string, options?: TTSOptions): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Google TTS not initialized. Call initialize() first.');
    }

    console.log('[Google TTS] speak() called with voiceId:', voiceId, 'text length:', text.length);
    
    // Extract voice name from voiceId (e.g., "google_en-US-Standard-A" -> "en-US-Standard-A")
    const voiceName = voiceId.replace('google_', '');
    console.log('[Google TTS] Using voice:', voiceName);

    // Extract language code from voice name
    const languageCode = this.extractLanguageCode(voiceName);
    console.log('[Google TTS] Language code:', languageCode);

    // Check if voice supports pitch
    const supportsPitch = this.supportsPitch(voiceName);
    console.log('[Google TTS] Voice supports pitch:', supportsPitch);

    const endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
      // Build audio config - only include pitch if supported
    const audioConfig: any = {
      audioEncoding: 'MP3',
      speakingRate: (options?.rate ?? 1.0)
    };

    // Only add pitch if voice supports it and pitch is non-zero
    const pitch = options?.pitch ?? 0;
    if (supportsPitch && pitch !== 0) {
      audioConfig.pitch = pitch;
    }

    const requestBody = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig
    };

    console.log('[Google TTS] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[Google TTS] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Google TTS] Error response:', errorText);
        throw new Error(`Failed to synthesize speech: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (!data.audioContent) {
        throw new Error('No audio content in response');
      }

      // Store audio data for later retrieval
      this.lastAudioData = Buffer.from(data.audioContent, 'base64');
      console.log('[Google TTS] Synthesized audio, size:', this.lastAudioData.length, 'bytes');
    } catch (error) {
      console.error('[Google TTS] Error synthesizing speech:', error);
      throw error;
    }
  }

  /**
   * Stop speaking (no-op for Google TTS)
   */
  stop(): void {
    console.log('[Google TTS] stop() called');
    // Google TTS is request-based, no ongoing playback to stop
  }

  /**
   * Test a voice (alias for speak with test message)
   */
  async test(voiceId: string, options?: TTSOptions, message?: string): Promise<void> {
    const testMessage = message || 'Hello, this is a test message from Google Text-to-Speech.';
    await this.speak(testMessage, voiceId, options);
  }

  /**
   * Get the last synthesized audio data
   */
  getLastAudioData(): Buffer | null {
    return this.lastAudioData;
  }
}
