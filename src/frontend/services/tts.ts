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
  provider: 'webspeech' | 'azure' | 'google'; // Deprecated - kept for backwards compatibility
  voiceId: string;
  volume: number;
  rate: number;
  pitch: number;
  // Provider Enable Flags (multiple can be true)
  webspeechEnabled?: boolean;
  azureEnabled?: boolean;
  googleEnabled?: boolean;
  // Provider Credentials
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
  voiceId?: string;
  volume?: number;
  rate?: number;
  pitch?: number;
}

// Auto-sync WebSpeech voices to database
export async function autoSyncWebSpeechVoices(): Promise<number> {
  try {
    if (!window.speechSynthesis) {
      console.warn('[TTS] Web Speech API not available');
      return 0;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      console.log('[TTS] No WebSpeech voices to sync');
      return 0;
    }

    console.log(`[TTS] Auto-syncing ${voices.length} WebSpeech voices...`);

    // Convert browser voices to TTSVoice format
    const ttsVoices = mapWebSpeechVoices();
    
    // Send to backend for syncing
    const result = await ipcRenderer.invoke('tts:sync-voices', 'webspeech', ttsVoices);
    
    if (result.success) {
      console.log(`[TTS] Auto-synced ${result.count} WebSpeech voices`);
      return result.count;
    } else {
      console.error('[TTS] Failed to sync WebSpeech voices:', result.error);
      return 0;
    }
  } catch (error) {
    console.error('[TTS] Error in autoSyncWebSpeechVoices:', error);
    return 0;
  }
}

// Initialize voice syncing on app startup (one-time per provider)
export async function initializeVoiceSync(): Promise<{ success: boolean; count: number }> {
  try {
    console.log('[TTS] Checking if voice sync is needed...');
    
    if (!window.speechSynthesis) {
      console.warn('[TTS] Web Speech API not available');
      return { success: true, count: 0 };
    }

    // Check with backend if WebSpeech voices need syncing
    const syncNeeded = await ipcRenderer.invoke('provider:check-sync-needed', 'webspeech');
    
    if (!syncNeeded) {
      console.log('[TTS] WebSpeech voices already synced, skipping');
      return { success: true, count: 0 };
    }    console.log('[TTS] WebSpeech voices need syncing, performing sync...');
    
    const rawVoices = window.speechSynthesis.getVoices();
    if (rawVoices.length === 0) {
      console.log('[TTS] No WebSpeech voices available to sync');
      return { success: true, count: 0 };
    }

    // Convert SpeechSynthesisVoice objects to plain objects for IPC serialization
    const serializedVoices = rawVoices.map(v => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      localService: v.localService,
      default: v.default
    }));
    
    const result = await ipcRenderer.invoke('tts:sync-voices', 'webspeech', serializedVoices);
    
    if (result.success) {
      console.log(`[TTS] Synced ${result.count} WebSpeech voices on startup`);
      return { success: true, count: result.count };
    } else {
      console.error('[TTS] Failed to sync WebSpeech voices:', result.error);
      return { success: false, count: 0 };
    }
  } catch (error: any) {
    console.error('[TTS] Error in initializeVoiceSync:', error);
    return { success: false, count: 0 };
  }
}

// Web Speech API - Renderer Process Only
let webSpeechSynth: SpeechSynthesis | null = null;
let webSpeechVoices: SpeechSynthesisVoice[] = [];

// Map to cache voiceURI for quick lookup during speak
let voiceUriMap: Map<string, string> = new Map();

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

      // Build the voice URI map from current voices
      buildVoiceUriMap();
    };
    
    loadVoices();
    
    // Some browsers load voices asynchronously
    if (webSpeechSynth.onvoiceschanged !== undefined) {
      webSpeechSynth.onvoiceschanged = loadVoices;
    }
  }
}

// Build the voice URI map from current voices
function buildVoiceUriMap() {
  voiceUriMap.clear();
  webSpeechVoices.forEach((voice, index) => {
    // Store multiple keys that might be used to look up this voice
    const langCode = voice.lang || 'en-US';
    const baseId = `webspeech_${langCode}_${index}`;
    voiceUriMap.set(baseId, voice.voiceURI);
    // Also store by clean name for fallback
    voiceUriMap.set(voice.name, voice.voiceURI);
  });
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

async function webSpeechSpeak(text: string, voiceId: string, options: TTSOptions): Promise<void> {
  if (!webSpeechSynth) {
    throw new Error('Web Speech API not available');
  }
  
  console.log('[TTS] webSpeechSpeak() CALLED - text:', text, 'voiceId:', voiceId);
  
  // Stop any current speech
  webSpeechSynth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  let voice: SpeechSynthesisVoice | undefined;
  
  // Try to get voiceURI from database metadata
  try {
    const metaResult = await ipcRenderer.invoke('tts:get-voice-metadata', voiceId);
    if (metaResult.success && metaResult.voiceURI) {
      console.log('[TTS] webSpeechSpeak() - Got voiceURI from database:', metaResult.voiceURI);
      // Find voice by voiceURI
      voice = webSpeechVoices.find(v => v.voiceURI === metaResult.voiceURI);
      if (voice) {
        console.log('[TTS] webSpeechSpeak() - Found voice by voiceURI:', voice.name, voice.lang);
      }
    }
  } catch (error) {
    console.warn('[TTS] webSpeechSpeak() - Could not get voice metadata:', error);
  }
  
  // Fallback: If not found by voiceURI, try to parse the complex ID and match by index
  if (!voice && voiceId.startsWith('webspeech_')) {
    const cleanVoiceId = voiceId.replace(/^webspeech_/, '');
    const parts = cleanVoiceId.split('_');
    if (parts.length >= 2) {
      const langCode = parts[0]; // e.g., 'en-GB'
      const indexStr = parts[1]; // e.g., '0'
      const index = parseInt(indexStr, 10);
      
      // Find all voices with this language
      const voicesForLang = webSpeechVoices.filter(v => v.lang === langCode);
      
      // Get the voice at the specified index
      if (voicesForLang.length > index) {
        voice = voicesForLang[index];
        console.log('[TTS] webSpeechSpeak() - Found voice by index fallback:', voice.name, voice.lang);
      }
    }  }
  
  console.log('[TTS] webSpeechSpeak() - Final voice selection:', voice?.name, voice?.lang, 'voiceURI:', voice?.voiceURI);
  
  if (voice) {
    utterance.voice = voice;
    console.log('[TTS] webSpeechSpeak() - ✓ Voice set to:', voice.name, '(' + voice.lang + ')');
  } else {
    console.warn('[TTS] webSpeechSpeak() - ✗ Could not find voice, using browser default');
  }
  
  // Set options
  utterance.volume = (options.volume ?? 80) / 100; // Convert 0-100 to 0-1
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  
  // Notify backend when speech finishes (for proper queue sequencing)
  utterance.onend = async () => {
    console.log('[TTS] Web Speech utterance finished');
    try {
      await ipcRenderer.invoke('tts:audio-finished');
    } catch (error) {
      console.error('[TTS] Error notifying audio finished:', error);
    }
  };
  
  // Handle errors
  utterance.onerror = async (event) => {
    console.error('[TTS] Web Speech error:', event);
    try {
      await ipcRenderer.invoke('tts:audio-finished');
    } catch (error) {
      console.error('[TTS] Error notifying audio finished after error:', error);
    }
  };
  
  console.log('[TTS] webSpeechSpeak() - Speaking with voice:', utterance.voice?.name, 'lang:', utterance.voice?.lang, 'volume:', utterance.volume, 'rate:', utterance.rate, 'pitch:', utterance.pitch);
  webSpeechSynth.speak(utterance);
  console.log('[TTS] webSpeechSpeak() - speak() called on SpeechSynthesis');
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
  const testMessage = 'Hello! This is a test of the text to speech system.';
  
  // Determine provider from voice ID prefix
  const isAzureVoice = voiceId?.startsWith('azure_');
  const isGoogleVoice = voiceId?.startsWith('google_');
  
  // Use Web Speech for non-Azure/Google voices
  if (!isAzureVoice && !isGoogleVoice) {
    await webSpeechSpeak(testMessage, voiceId, options || {});
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
  
  // Determine provider from voice ID (since we now support multiple providers)
  const voiceId = options?.voiceId || settings.voiceId;
  const isAzureVoice = voiceId?.startsWith('azure_');
  const isGoogleVoice = voiceId?.startsWith('google_');
    // Use Web Speech for non-Azure/Google voices
  if (!isAzureVoice && !isGoogleVoice) {
    console.log('[TTS Service] speak() - Using Web Speech for voiceId:', voiceId);
    await webSpeechSpeak(text, voiceId, options || {});
    return;
  }
  
  // For Azure/Google, call backend
  console.log('[TTS Service] speak() - Using backend provider for voiceId:', voiceId, 'options:', options);
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

// Viewer TTS Rules
export interface ViewerTTSRule {
  id: number;
  username: string;
  customVoiceId: number | null;
  pitchOverride: number | null;
  rateOverride: number | null;
  isMuted: boolean;
  mutedUntil: string | null;
  cooldownEnabled: boolean;
  cooldownSeconds: number | null;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerTTSRuleInput {
  username: string;
  customVoiceId?: number | null;
  pitchOverride?: number | null;
  rateOverride?: number | null;
  isMuted?: boolean;
  mutedUntil?: string | null;
  cooldownEnabled?: boolean;
  cooldownSeconds?: number | null;
  cooldownUntil?: string | null;
}

export async function getViewerRule(username: string): Promise<ViewerTTSRule | null> {
  const result = await ipcRenderer.invoke('viewer-rules:get', username);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.rule;
}

export async function createViewerRule(input: ViewerTTSRuleInput): Promise<ViewerTTSRule> {
  const result = await ipcRenderer.invoke('viewer-rules:create', input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.rule;
}

export async function updateViewerRule(username: string, updates: Partial<Omit<ViewerTTSRuleInput, 'username'>>): Promise<ViewerTTSRule | null> {
  const result = await ipcRenderer.invoke('viewer-rules:update', username, updates);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.rule;
}

export async function deleteViewerRule(username: string): Promise<boolean> {
  const result = await ipcRenderer.invoke('viewer-rules:delete', username);
  return result.success;
}

export async function getAllViewerRules(): Promise<ViewerTTSRule[]> {
  const result = await ipcRenderer.invoke('viewer-rules:get-all');
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.rules;
}

// Web Audio API for Azure/Google TTS (OBS-compatible)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

async function playAudioBuffer(audioData: string, volume: number, rate: number, pitch: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = getAudioContext();
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decode audio data
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      
      // Create source node
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      
      // Apply rate (playback speed)
      source.playbackRate.value = rate;
      
      // Create gain node for volume
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume / 100; // Convert 0-100 to 0-1
      
      // Connect: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Resolve when audio finishes playing
      source.onended = () => {
        console.log('[TTS] Azure audio playback completed');
        resolve();
      };
      
      // Start playback
      source.start(0);
      
      console.log('[TTS] Playing Azure audio via Web Audio API (OBS-compatible)');
    } catch (error) {
      console.error('[TTS] Error playing audio:', error);
      reject(error);
    }
  });
}

// Listen for audio playback requests from backend
// Remove any existing listeners to prevent duplicates
let playAudioCallCount = 0;
let speakCallCount = 0;

ipcRenderer.removeAllListeners('tts:play-audio');
ipcRenderer.on('tts:play-audio', async (_event: any, data: any) => {
  playAudioCallCount++;
  const { audioData, volume, rate, pitch } = data;
  console.log('[TTS] Received tts:play-audio event #' + playAudioCallCount);
  
  // Wait for audio to finish playing, then notify backend
  await playAudioBuffer(audioData, volume, rate, pitch);
  
  // Notify backend that playback is complete
  try {
    await ipcRenderer.invoke('tts:audio-finished');
  } catch (error) {
    console.error('[TTS] Error notifying audio finished:', error);
  }
});

// Listen for Web Speech playback requests from backend
// Remove any existing listeners to prevent duplicates
ipcRenderer.removeAllListeners('tts:speak');
ipcRenderer.on('tts:speak', (_event: any, data: any) => {
  speakCallCount++;
  const { text, voiceId, volume, rate, pitch } = data;
  console.log('[TTS] Received tts:speak event #' + speakCallCount + ' for voice:', voiceId);
  webSpeechSpeak(text, voiceId, { voiceId, volume, rate, pitch });
});
