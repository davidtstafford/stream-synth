/**
 * AWS Polly Text-to-Speech Provider
 * 
 * Implements TTS using Amazon Polly
 * Documentation: https://docs.aws.amazon.com/polly/
 */

import { Polly } from '@aws-sdk/client-polly';
import { TTSProvider, TTSVoice, TTSOptions } from './base';

export class AWSPollyProvider implements TTSProvider {
  name = 'aws';
  needsApiKey = true;
  
  private polly: Polly | null = null;
  private accessKeyId: string = '';
  private secretAccessKey: string = '';
  private region: string = '';
  private isInitialized: boolean = false;
  private lastAudioData: Buffer | null = null;
  private includeNeuralVoices: boolean = true; // Default to include neural voices

  /**
   * Initialize the AWS Polly provider with API credentials
   */
  async initialize(credentials?: { 
    accessKeyId?: string; 
    secretAccessKey?: string;
    region?: string;
    includeNeuralVoices?: boolean;
  }): Promise<void> {
    console.log('[AWS Polly] initialize() called with region:', credentials?.region);
    
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !credentials?.region) {
      throw new Error('AWS Polly requires accessKeyId, secretAccessKey, and region');
    }

    this.accessKeyId = credentials.accessKeyId;
    this.secretAccessKey = credentials.secretAccessKey;
    this.region = credentials.region;
    this.includeNeuralVoices = credentials.includeNeuralVoices ?? true;

    try {
      // Create Polly client
      console.log('[AWS Polly] Creating Polly client...');
      this.polly = new Polly({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });
      
      // Mark as initialized before testing (getVoices checks this flag)
      this.isInitialized = true;
      
      // Test the credentials by fetching voices
      console.log('[AWS Polly] Testing credentials...');
      await this.getVoices();

      console.log('[AWS Polly] Initialized successfully with region:', this.region);
      console.log('[AWS Polly] Neural voices enabled:', this.includeNeuralVoices);
    } catch (error) {
      this.isInitialized = false; // Reset flag on error
      console.error('[AWS Polly] Initialization error:', error);
      throw new Error(`Failed to initialize AWS Polly: ${error}`);
    }
  }

  /**
   * Get list of available voices from AWS Polly
   */
  async getVoices(): Promise<TTSVoice[]> {
    if (!this.isInitialized || !this.polly) {
      throw new Error('AWS Polly not initialized. Call initialize() first.');
    }

    console.log('[AWS Polly] Fetching voices from region:', this.region);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[AWS Polly] Request timeout - aborting');
      controller.abort();
    }, 15000); // 15 second timeout
    
    try {
      const response = await this.polly.describeVoices({});
      
      const voices = response.Voices || [];
      console.log(`[AWS Polly] Retrieved ${voices.length} voices from API`);
      
      // Filter voices based on neural/standard preference
      const filteredVoices = this.includeNeuralVoices 
        ? voices 
        : voices.filter(v => !v.SupportedEngines?.includes('neural'));
      
      console.log(`[AWS Polly] Filtered to ${filteredVoices.length} voices (neural: ${this.includeNeuralVoices})`);
      
      const ttsVoices: TTSVoice[] = filteredVoices.map((voice: any) => this.mapAWSVoice(voice));
      console.log(`[AWS Polly] Mapped to ${ttsVoices.length} internal voice objects`);
      return ttsVoices;
    } catch (error) {
      console.error('[AWS Polly] Error retrieving voices:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map AWS Polly voice to internal TTSVoice format
   */
  private mapAWSVoice(voice: any): TTSVoice {
    // Extract language info
    const languageCode = voice.LanguageCode || '';
    const languageName = voice.LanguageName || languageCode;
    
    // Determine gender
    let gender: 'male' | 'female' | 'neutral' = 'neutral';
    if (voice.Gender === 'Male') gender = 'male';
    else if (voice.Gender === 'Female') gender = 'female';
    
    // Check if voice supports neural engine
    const supportsNeural = voice.SupportedEngines?.includes('neural') || false;
    
    // Generate voice ID
    const voiceId = `aws_${voice.Id}`;
    
    // Store additional metadata
    const metadata = JSON.stringify({
      voiceId: voice.Id,  // Original AWS voice ID (e.g., "Joanna")
      additionalLanguageCodes: voice.AdditionalLanguageCodes || [],
      supportedEngines: voice.SupportedEngines || ['standard'],
      supportsNeural: supportsNeural
    });
    
    return {
      id: voiceId,
      name: voice.Name || voice.Id,
      language: languageCode,
      languageName: languageName,
      gender: gender,
      provider: 'aws',
      shortName: voice.Id,  // Store AWS voice ID for synthesis
      metadata: metadata as any
    };
  }

  /**
   * Speak text using AWS Polly
   */
  async speak(text: string, voiceId: string, options?: TTSOptions): Promise<void> {
    if (!this.isInitialized || !this.polly) {
      throw new Error('AWS Polly not initialized');
    }

    console.log('[AWS Polly] Speaking:', text);
    console.log('[AWS Polly] Voice ID:', voiceId);

    try {
      // Extract AWS voice ID from our voice ID format (aws_Joanna -> Joanna)
      const awsVoiceId = voiceId.replace('aws_', '');
      
      // Determine engine (neural or standard) based on voice capabilities
      // Try neural first if available, fallback to standard
      let engine: 'neural' | 'standard' = 'standard';
      
      if (this.includeNeuralVoices) {
        // Check if this voice supports neural
        const voiceInfo = await this.polly.describeVoices({});
        const voice = voiceInfo.Voices?.find(v => v.Id === awsVoiceId);
        if (voice?.SupportedEngines?.includes('neural')) {
          engine = 'neural';
        }
      }
      
      console.log('[AWS Polly] Using engine:', engine);
      
      // Synthesize speech
      const response = await this.polly.synthesizeSpeech({
        Text: text,
        VoiceId: awsVoiceId as any,
        OutputFormat: 'mp3',
        Engine: engine,
        SampleRate: '24000'
      });

      // Convert response to Buffer
      const audioStream = response.AudioStream;
      if (audioStream) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of audioStream as any) {
          chunks.push(chunk);
        }
        this.lastAudioData = Buffer.concat(chunks);
        console.log('[AWS Polly] Audio data received, size:', this.lastAudioData.length, 'bytes');
      } else {
        throw new Error('No audio stream returned from AWS Polly');
      }
    } catch (error) {
      console.error('[AWS Polly] Speech synthesis error:', error);
      throw error;
    }
  }

  /**
   * Stop speaking (not supported by AWS Polly - synthesis is one-shot)
   */
  stop(): void {
    console.log('[AWS Polly] Stop called (no-op for AWS Polly)');
    // AWS Polly doesn't support stopping - it's a one-time synthesis
  }

  /**
   * Test a voice with sample text
   */
  async test(voiceId: string, options?: TTSOptions, message?: string): Promise<void> {
    const testMessage = message || 'This is a test of the AWS Polly text to speech system.';
    await this.speak(testMessage, voiceId, options);
  }

  /**
   * Get the last synthesized audio data
   */
  getLastAudioData(): Buffer | null {
    return this.lastAudioData;
  }

  /**
   * Update neural voice filter preference
   */
  setIncludeNeuralVoices(include: boolean): void {
    this.includeNeuralVoices = include;
    console.log('[AWS Polly] Neural voices enabled:', this.includeNeuralVoices);
  }
}
