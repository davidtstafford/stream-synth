/**
 * Voice Debugging Utility
 * Use this to understand what voices are available on your system
 */

export function debugWebSpeechVoices(): void {
  if (!window.speechSynthesis) {
    console.error('[Voice Debug] Web Speech API not available');
    return;
  }

  console.log('=== WEB SPEECH VOICE DEBUG ===');
  
  const loadAndLogVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    
    console.log(`Total voices available: ${voices.length}`);
    console.log('');
    
    if (voices.length === 0) {
      console.warn('⚠️ No voices found! This might be because:');
      console.warn('  1. Your OS has no TTS voices installed');
      console.warn('  2. Web Speech API is not supported in your browser/Electron version');
      console.warn('  3. Voices are still loading (try again in a moment)');
      return;
    }

    // Group voices by language
    const byLanguage: Record<string, typeof voices> = {};
    voices.forEach(voice => {
      const lang = voice.lang;
      if (!byLanguage[lang]) {
        byLanguage[lang] = [];
      }
      byLanguage[lang].push(voice);
    });

    // Log by language
    Object.keys(byLanguage).sort().forEach(lang => {
      console.log(`\n📍 ${lang}:`);
      byLanguage[lang].forEach((voice, idx) => {
        console.log(
          `  [${idx + 1}] ${voice.name}` +
          (voice.default ? ' (default)' : '') +
          (voice.localService ? ' (local)' : ' (remote)') +
          `\n       URI: ${voice.voiceURI}`
        );
      });
    });

    console.log('\n=== COPY-PASTE VOICE IDs ===');
    console.log('Use these IDs in your app:');
    voices.forEach((voice, idx) => {
      console.log(`  ${idx + 1}. "${voice.voiceURI}"`);
    });
  };

  // Try to load voices immediately
  loadAndLogVoices();

  // If voices aren't loaded yet, wait for them
  if (window.speechSynthesis.getVoices().length === 0) {
    console.log('Voices not loaded yet, waiting for onvoiceschanged event...');
    const handler = () => {
      console.log('Voices loaded!');
      loadAndLogVoices();
      window.speechSynthesis.onvoiceschanged = null;
    };
    window.speechSynthesis.onvoiceschanged = handler;
  }
}

export function testVoiceSynthesis(text: string = 'Hello, this is a test.'): void {
  if (!window.speechSynthesis) {
    console.error('[Voice Debug] Web Speech API not available');
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    console.error('[Voice Debug] No voices available to test');
    return;
  }

  console.log(`Testing with voice: ${voices[0].name} (${voices[0].lang})`);
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices[0];
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => console.log('[Voice Debug] Speech started');
  utterance.onend = () => console.log('[Voice Debug] Speech finished');
  utterance.onerror = (e) => console.error('[Voice Debug] Speech error:', e);

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
