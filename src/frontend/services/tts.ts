const { ipcRenderer } = window.require('electron');

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  languageName: string;
  gender: 'male' | 'female' | 'neutral';
  provider: 'webspeech' | 'azure' | 'google';
  styles?: string[];
  sampleRateHertz?: number;
}

export interface TTSSettings {
  enabled: boolean;
  provider: 'webspeech' | 'azure' | 'google';
  voiceId: string;
  volume: number;
  rate: number;
  pitch: number;
  azureApiKey?: string;
  azureRegion?: string;
  googleApiKey?: string;
  // Basic TTS Rules
  filterCommands?: boolean;
  filterBots?: boolean;
  filterUrls?: boolean;
  announceUsername?: boolean;
  minMessageLength?: number;
  maxMessageLength?: number;
  // Duplicate Detection
  skipDuplicateMessages?: boolean;
  duplicateMessageWindow?: number;
  // Rate Limiting
  userCooldownEnabled?: boolean;
  userCooldownSeconds?: number;
  globalCooldownEnabled?: boolean;
  globalCooldownSeconds?: number;
  maxQueueSize?: number;
  // Emote/Emoji Limits
  maxEmotesPerMessage?: number;
  maxEmojisPerMessage?: number;
  stripExcessiveEmotes?: boolean;
  // Character Repetition
  maxRepeatedChars?: number;
  maxRepeatedWords?: number;
  // Content Filters
  copypastaFilterEnabled?: boolean;
}

export interface TTSOptions {
  volume?: number;
  rate?: number;
  pitch?: number;
}

// Web Speech API - Renderer Process Only
let webSpeechSynth: SpeechSynthesis | null = null;
let webSpeechVoices: SpeechSynthesisVoice[] = [];

function initWebSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    webSpeechSynth = window.speechSynthesis;
    
    // Load voices (might be delayed on some browsers)
    const loadVoices = () => {
      webSpeechVoices = webSpeechSynth!.getVoices();
      console.log(`[TTS] Loaded ${webSpeechVoices.length} voices from Web Speech API`);
      
      // Group voices by language for debugging
      const byLanguage: Record<string, number> = {};
      webSpeechVoices.forEach(voice => {
        const lang = voice.lang.split('-')[0]; // Get base language (en, es, fr, etc.)
        byLanguage[lang] = (byLanguage[lang] || 0) + 1;
      });
      console.log('[TTS] Voices by language:', byLanguage);
    };
    
    loadVoices();
    
    // Some browsers load voices asynchronously
    if (webSpeechSynth.onvoiceschanged !== undefined) {
      webSpeechSynth.onvoiceschanged = loadVoices;
    }
  }
}

// Initialize on module load
initWebSpeech();

function mapWebSpeechVoices(): TTSVoice[] {
  const voices: TTSVoice[] = [];
  
  for (const voice of webSpeechVoices) {
    const gender = guessGender(voice.name);
    const languageName = getLanguageName(voice.lang);
    
    voices.push({
      id: voice.voiceURI || voice.name,
      name: voice.name,
      language: voice.lang,
      languageName,
      gender,
      provider: 'webspeech'
    });
  }
  
  return voices;
}

function guessGender(voiceName: string): 'male' | 'female' | 'neutral' {
  const name = voiceName.toLowerCase();
  
  // Female indicators
  const femaleNames = ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'kate', 'anna', 'alice', 'emma', 'sophia'];
  if (femaleNames.some(n => name.includes(n))) return 'female';
  
  // Male indicators
  const maleNames = ['male', 'man', 'alex', 'daniel', 'thomas', 'fred', 'ralph', 'jorge', 'diego', 'juan', 'tom', 'bruce'];
  if (maleNames.some(n => name.includes(n))) return 'male';
  
  return 'neutral';
}

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en-US': 'English (United States)',
    'en-GB': 'English (United Kingdom)',
    'en-AU': 'English (Australia)',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'fr-FR': 'French (France)',
    'de-DE': 'German (Germany)',
    'it-IT': 'Italian (Italy)',
    'pt-BR': 'Portuguese (Brazil)',
    'pt-PT': 'Portuguese (Portugal)',
    'ja-JP': 'Japanese (Japan)',
    'ko-KR': 'Korean (Korea)',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ru-RU': 'Russian (Russia)',
    'ar-SA': 'Arabic (Saudi Arabia)',
    'hi-IN': 'Hindi (India)',
    'nl-NL': 'Dutch (Netherlands)',
    'pl-PL': 'Polish (Poland)',
    'tr-TR': 'Turkish (Turkey)'
  };
  
  return langMap[langCode] || langCode;
}

function webSpeechSpeak(text: string, voiceId: string, options: TTSOptions): void {
  if (!webSpeechSynth) {
    throw new Error('Web Speech API not available');
  }
  
  // Stop any current speech
  webSpeechSynth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Find the voice
  const voice = webSpeechVoices.find(v => v.voiceURI === voiceId || v.name === voiceId);
  if (voice) {
    utterance.voice = voice;
  }
  
  // Set options
  utterance.volume = (options.volume ?? 80) / 100; // Convert 0-100 to 0-1
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  
  webSpeechSynth.speak(utterance);
}

function webSpeechStop(): void {
  if (webSpeechSynth) {
    webSpeechSynth.cancel();
  }
}

// Public API
export async function getVoices(): Promise<TTSVoice[]> {
  const settings = await getSettings();
  
  if (settings.provider === 'webspeech') {
    // Refresh voices in case they were loaded asynchronously
    if (webSpeechSynth) {
      webSpeechVoices = webSpeechSynth.getVoices();
    }
    return mapWebSpeechVoices();
  }
  
  // For Azure/Google, call backend
  const result = await ipcRenderer.invoke('tts:get-voices');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.voices;
}

export async function testVoice(voiceId: string, options?: TTSOptions): Promise<void> {
  const settings = await getSettings();
  const testMessage = 'Hello! This is a test of the text to speech system.';
  
  if (settings.provider === 'webspeech') {
    webSpeechSpeak(testMessage, voiceId, options || {});
    return;
  }
  
  // For Azure/Google, call backend
  const result = await ipcRenderer.invoke('tts:test-voice', voiceId, options);
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function speak(text: string, options?: TTSOptions): Promise<void> {
  const settings = await getSettings();
  
  if (settings.provider === 'webspeech') {
    webSpeechSpeak(text, settings.voiceId, options || {});
    return;
  }
  
  // For Azure/Google, call backend
  const result = await ipcRenderer.invoke('tts:speak', text, options);
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function stop(): Promise<void> {
  const settings = await getSettings();
  
  if (settings.provider === 'webspeech') {
    webSpeechStop();
    return;
  }
  
  // For Azure/Google, call backend
  const result = await ipcRenderer.invoke('tts:stop');
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function getSettings(): Promise<TTSSettings> {
  const result = await ipcRenderer.invoke('tts:get-settings');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.settings;
}

export async function saveSettings(settings: Partial<TTSSettings>): Promise<void> {
  const result = await ipcRenderer.invoke('tts:save-settings', settings);
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function getProviders(): Promise<string[]> {
  const result = await ipcRenderer.invoke('tts:get-providers');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.providers;
}

export async function syncVoices(provider: string, voices: any[]): Promise<{ success: boolean; count: number; stats: any }> {
  const result = await ipcRenderer.invoke('tts:sync-voices', provider, voices);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result;
}

export async function getGroupedVoices(): Promise<Record<string, any[]>> {
  const result = await ipcRenderer.invoke('tts:get-grouped-voices');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.grouped;
}

export async function getVoiceStats(): Promise<any> {
  const result = await ipcRenderer.invoke('tts:get-voice-stats');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.stats;
}

export async function getVoiceByNumericId(numericId: number): Promise<any> {
  const result = await ipcRenderer.invoke('tts:get-voice-by-id', numericId);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.voice;
}
