/**
 * Web Speech API TTS Provider
 * 
 * Uses the browser/Electron's built-in Speech Synthesis API
 * - FREE and unlimited
 * - Available voices depend on OS:
 *   - Windows: Microsoft SAPI voices
 *   - macOS: Apple voices
 * - No API key needed
 */

import { TTSProvider, TTSVoice, TTSOptions } from './base';

export class WebSpeechProvider implements TTSProvider {
  name = 'Web Speech API';
  needsApiKey = false;

  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    // Access speech synthesis from the window object
    this.synth = window.speechSynthesis;
  }

  async initialize(): Promise<void> {
    // No initialization needed for Web Speech API
    return Promise.resolve();
  }

  async getVoices(): Promise<TTSVoice[]> {
    return new Promise((resolve) => {
      // Sometimes voices aren't loaded immediately
      const voices = this.synth.getVoices();
      
      if (voices.length > 0) {
        resolve(this.mapVoices(voices));
      } else {
        // Wait for voices to load
        this.synth.onvoiceschanged = () => {
          const loadedVoices = this.synth.getVoices();
          resolve(this.mapVoices(loadedVoices));
        };
      }
    });
  }

  private mapVoices(voices: SpeechSynthesisVoice[]): TTSVoice[] {
    return voices.map(voice => ({
      id: voice.voiceURI || voice.name,
      name: voice.name,
      language: voice.lang,
      languageName: this.getLanguageName(voice.lang),
      gender: this.guessGender(voice.name),
      provider: 'webspeech' as const
    }));
  }

  private getLanguageName(langCode: string): string {
    // Map common language codes to readable names
    const langMap: { [key: string]: string } = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'en-AU': 'English (Australia)',
      'en-CA': 'English (Canada)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'fr-FR': 'French (France)',
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
      'ar-SA': 'Arabic'
    };

    return langMap[langCode] || langCode;
  }

  private guessGender(voiceName: string): 'male' | 'female' | 'neutral' {
    const name = voiceName.toLowerCase();
    
    // Common female name patterns
    if (name.includes('female') || name.includes('woman') ||
        name.includes('samantha') || name.includes('victoria') ||
        name.includes('zira') || name.includes('hazel') ||
        name.includes('karen') || name.includes('moira') ||
        name.includes('tessa') || name.includes('fiona') ||
        name.includes('siri') || name.includes('paulina') ||
        name.includes('yelda') || name.includes('zoey')) {
      return 'female';
    }
    
    // Common male name patterns
    if (name.includes('male') || name.includes('man') ||
        name.includes('alex') || name.includes('david') ||
        name.includes('daniel') || name.includes('george') ||
        name.includes('thomas') || name.includes('lee') ||
        name.includes('mark') || name.includes('james')) {
      return 'male';
    }

    return 'neutral';
  }

  async speak(text: string, voiceId: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Stop any current speech
        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find the voice
        const voices = this.synth.getVoices();
        const voice = voices.find(v => v.voiceURI === voiceId || v.name === voiceId);
        
        if (voice) {
          utterance.voice = voice;
        }

        // Apply options
        utterance.volume = (options.volume ?? 80) / 100; // Convert 0-100 to 0-1
        utterance.rate = options.rate ?? 1.0;
        utterance.pitch = options.pitch ?? 1.0;

        utterance.onend = () => {
          this.currentUtterance = null;
          resolve();
        };

        utterance.onerror = (event) => {
          this.currentUtterance = null;
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    if (this.currentUtterance) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }
  async test(voiceId: string, options: TTSOptions = {}, message?: string): Promise<void> {
    const testMessage = message || "Hello! This is a test of the text to speech system.";
    return this.speak(testMessage, voiceId, options);
  }
}
