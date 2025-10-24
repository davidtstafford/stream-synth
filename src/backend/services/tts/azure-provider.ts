/**
 * Azure Cognitive Services Text-to-Speech Provider
 * 
 * Implements TTS using Azure Neural Voices
 * Documentation: https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import fetch from 'node-fetch';
import { TTSProvider, TTSVoice, TTSOptions } from './base';

export class AzureTTSProvider implements TTSProvider {
  name = 'azure';
  needsApiKey = true;
  
  private speechConfig: sdk.SpeechConfig | null = null;
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private apiKey: string = '';
  private region: string = '';
  private isInitialized: boolean = false;

  /**
   * Initialize the Azure provider with API credentials
   */
  async initialize(credentials?: { apiKey?: string; region?: string }): Promise<void> {
    if (!credentials?.apiKey || !credentials?.region) {
      throw new Error('Azure TTS requires both apiKey and region');
    }

    this.apiKey = credentials.apiKey;
    this.region = credentials.region;

    try {
      // Create speech config
      this.speechConfig = sdk.SpeechConfig.fromSubscription(this.apiKey, this.region);
      
      // Set output format to highest quality
      this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;
      
      // Create synthesizer with default speaker output
      const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
      this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

      this.isInitialized = true;
      console.log('[Azure TTS] Initialized successfully with region:', this.region);
    } catch (error) {
      console.error('[Azure TTS] Initialization error:', error);
      throw new Error(`Failed to initialize Azure TTS: ${error}`);
    }
  }

  /**
   * Get list of available voices from Azure
   */
  async getVoices(): Promise<TTSVoice[]> {
    if (!this.isInitialized || !this.speechConfig) {
      throw new Error('Azure TTS not initialized. Call initialize() first.');
    }

    try {
      // Use REST API to get voices list instead of SDK method
      const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const azureVoices = await response.json() as any[];
      const voices: TTSVoice[] = azureVoices.map((voice: any) => this.mapAzureVoiceFromAPI(voice));
      
      console.log(`[Azure TTS] Retrieved ${voices.length} voices`);
      return voices;
    } catch (error) {
      console.error('[Azure TTS] Error retrieving voices:', error);
      throw error;
    }
  }

  /**
   * Map Azure voice info from REST API to our TTSVoice format
   */
  private mapAzureVoiceFromAPI(voice: any): TTSVoice {
    // Extract display name from ShortName (e.g., "en-US-AriaNeural" -> "Aria")
    const nameParts = voice.ShortName.split('-');
    const displayName = nameParts[nameParts.length - 1].replace('Neural', '').replace('Standard', '');
    
    // Determine gender
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    const genderStr = (voice.Gender || '').toLowerCase();
    if (genderStr === 'female') {
      gender = 'female';
    } else if (genderStr === 'male') {
      gender = 'male';
    }

    // Build voice_id: azure_<locale>_<voiceName>
    const voiceId = `azure_${voice.Locale}_${displayName}`;

    // Extract voice type (Neural vs Standard)
    const voiceType = voice.ShortName.includes('Neural') ? 'Neural' : 'Standard';

    return {
      id: voiceId,
      name: `${displayName} (Azure ${voiceType})`,
      language: voice.Locale,
      languageName: voice.LocaleName || voice.Locale,
      gender,
      provider: 'azure',
      styles: voice.StyleList || []
    };
  }

  /**
   * Map Azure voice info from SDK to our TTSVoice format (deprecated - using REST API instead)
   */
  private mapAzureVoice(voice: any): TTSVoice {
    // Extract display name from ShortName (e.g., "en-US-AriaNeural" -> "Aria")
    const nameParts = voice.shortName.split('-');
    const displayName = nameParts[nameParts.length - 1].replace('Neural', '').replace('Standard', '');
    
    // Determine gender
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    if (voice.gender === sdk.SynthesisVoiceGender.Female) {
      gender = 'female';
    } else if (voice.gender === sdk.SynthesisVoiceGender.Male) {
      gender = 'male';
    }

    // Build voice_id: azure_<locale>_<voiceName>
    const voiceId = `azure_${voice.locale}_${displayName}`;

    // Extract voice type (Neural vs Standard)
    const voiceType = voice.shortName.includes('Neural') ? 'Neural' : 'Standard';

    return {
      id: voiceId,
      name: `${displayName} (Azure ${voiceType})`,
      language: voice.locale,
      languageName: voice.localName || voice.locale,
      gender,
      provider: 'azure',
      styles: voice.styleList || []
    };
  }

  /**
   * Generate SSML for Azure TTS with voice options
   */
  private generateSSML(text: string, voiceId: string, options?: TTSOptions): string {
    // Extract voice name from voice_id (azure_en-US_Aria -> en-US-AriaNeural)
    const parts = voiceId.replace('azure_', '').split('_');
    const locale = parts[0];
    const voiceName = parts[1];
    const fullVoiceName = `${locale}-${voiceName}Neural`; // Assume Neural for now

    // Map volume (0-100) to SSML prosody volume
    let volumeAttr = '';
    if (options?.volume !== undefined) {
      const volumePercent = options.volume;
      if (volumePercent <= 20) volumeAttr = 'x-soft';
      else if (volumePercent <= 40) volumeAttr = 'soft';
      else if (volumePercent <= 60) volumeAttr = 'medium';
      else if (volumePercent <= 80) volumeAttr = 'loud';
      else volumeAttr = 'x-loud';
    }

    // Map rate (0.5-2.0) to SSML prosody rate percentage
    let rateAttr = '';
    if (options?.rate !== undefined) {
      const ratePercent = Math.round((options.rate - 1.0) * 100);
      rateAttr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
    }

    // Map pitch (0.5-2.0) to SSML prosody pitch
    let pitchAttr = '';
    if (options?.pitch !== undefined) {
      const pitchPercent = Math.round((options.pitch - 1.0) * 50);
      pitchAttr = `${pitchPercent >= 0 ? '+' : ''}${pitchPercent}%`;
    }

    // Build prosody attributes
    const prosodyAttrs = [
      volumeAttr ? `volume="${volumeAttr}"` : '',
      rateAttr ? `rate="${rateAttr}"` : '',
      pitchAttr ? `pitch="${pitchAttr}"` : ''
    ].filter(Boolean).join(' ');

    // Escape XML special characters in text
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Build SSML
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">
        <voice name="${fullVoiceName}">
          ${prosodyAttrs ? `<prosody ${prosodyAttrs}>` : ''}
            ${escapedText}
          ${prosodyAttrs ? '</prosody>' : ''}
        </voice>
      </speak>
    `.trim();

    return ssml;
  }

  /**
   * Speak text using specified voice
   */
  async speak(text: string, voiceId: string, options?: TTSOptions): Promise<void> {
    if (!this.isInitialized || !this.synthesizer) {
      throw new Error('Azure TTS not initialized');
    }

    const ssml = this.generateSSML(text, voiceId, options);
    console.log('[Azure TTS] Speaking with SSML:', ssml);

    return new Promise((resolve, reject) => {
      this.synthesizer!.speakSsmlAsync(
        ssml,
        (result: any) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log('[Azure TTS] Speech synthesis completed');
            resolve();
          } else if (result.reason === sdk.ResultReason.Canceled) {
            const error = `Speech synthesis canceled: ${result.errorDetails || 'Unknown error'}`;
            console.error('[Azure TTS]', error);
            reject(new Error(error));
          } else {
            const error = `Speech synthesis failed: ${result.reason}`;
            console.error('[Azure TTS]', error);
            reject(new Error(error));
          }
        }
      );
    });
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.synthesizer) {
      // Azure SDK doesn't have a direct stop method, create new synthesizer
      console.log('[Azure TTS] Stopping speech (recreating synthesizer)');
      this.synthesizer.close();
      
      if (this.speechConfig) {
        const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
        this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);
      }
    }
  }

  /**
   * Test a voice with a sample message
   */
  async test(voiceId: string, options?: TTSOptions): Promise<void> {
    const testMessage = 'Hello! This is a test of the Azure text to speech system.';
    await this.speak(testMessage, voiceId, options);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
    
    if (this.speechConfig) {
      this.speechConfig.close();
      this.speechConfig = null;
    }

    this.isInitialized = false;
    console.log('[Azure TTS] Disposed');
  }
}
