export interface ParsedVoice {
  voice_id: string;
  provider: string;
  source: string | null;
  name: string;
  language_code: string;
  language_name: string;
  region: string | null;
  gender: string | null;
  display_order: number | null;
  metadata: string | null;
}

export class VoiceParser {
  // Parse Web Speech API voice
  static parseWebSpeechVoice(voice: any, index: number): ParsedVoice {
    // Defensive checks for undefined properties
    const voiceName = voice.name || `Voice ${index}`;
    const voiceUri = voice.voiceURI || '';
    const langCode = voice.language || voice.lang || 'en-US';
    
    const source = this.detectSource(voiceName);
    const cleanName = this.extractName(voiceName);
    const gender = this.detectGender(voiceName, voiceUri);
    const { languageCode, languageName, region } = this.parseLanguage(langCode);

    // Create a voice ID that's unique and includes identifying information
    // Format: webspeech_{languageCode}_{index}
    // Store the actual voiceURI in metadata for lookup
    const voiceId = `webspeech_${languageCode}_${index}`;

    return {
      voice_id: voiceId,
      provider: 'webspeech',
      source,
      name: cleanName,
      language_code: languageCode,
      language_name: languageName,
      region,
      gender,
      display_order: index,
      metadata: JSON.stringify({
        voiceURI: voiceUri,
        localService: voice.localService,
        default: voice.default,
        originalName: voiceName
      })
    };
  }
  // Detect voice source (System, Siri, Enhanced, etc.)
  private static detectSource(voiceName: string | undefined): string | null {
    if (!voiceName) return 'system';
    
    const lower = voiceName.toLowerCase();
    
    if (lower.includes('siri') || lower.includes('premium')) return 'siri';
    if (lower.includes('enhanced')) return 'enhanced';
    if (lower.includes('compact')) return 'compact';
    
    return 'system';
  }
  // Extract clean name from voice name
  private static extractName(voiceName: string | undefined): string {
    if (!voiceName) return 'Unknown Voice';
    
    // Remove parenthetical information and extra spaces
    const match = voiceName.match(/^([^(]+)/);
    const cleanName = match ? match[1].trim() : voiceName;
    
    return cleanName;
  }

  // Detect gender from voice name or URI
  private static detectGender(voiceName: string, voiceURI: string): string | null {
    const combined = `${voiceName} ${voiceURI}`.toLowerCase();
    
    // Known male voices (common TTS voice names)
    const maleIndicators = [
      'male', 'man', 'boy', 'guy', 'tom',
      // English male names
      'alex', 'daniel', 'fred', 'jorge', 'juan', 'diego', 'thomas', 'ralph', 
      'bruce', 'aaron', 'albert', 'arthur', 'brian', 'carlos', 'gordon',
      'henrik', 'james', 'lee', 'luca', 'martin', 'matej', 'nicolas', 
      'oliver', 'otoya', 'reed', 'rocko', 'damayanti', 'grandpa',
      // International male names
      'xander', 'yannick', 'eddy', 'majed', 'maged', 'tarik', 'filip',
      'giorgio', 'diego', 'enrique', 'jorge', 'juan', 'matej', 'oskar',
      'mikhail', 'yuri', 'pierre', 'thomas', 'henrik', 'emilio'
    ];
    
    // Known female voices
    const femaleIndicators = [
      'female', 'woman', 'girl', 
      // English female names
      'samantha', 'victoria', 'kate', 'monica', 'paulina', 'amelie', 
      'alice', 'emma', 'sophia', 'karen', 'nicky', 'jenny', 'flo',
      'sara', 'laura', 'anna', 'ava', 'catherine', 'ellen', 'grandma',
      'martha', 'sandy', 'shelley', 'susan', 'allison', 'kathy', 'melina',
      'milena', 'nora', 'tessa', 'zuzana', 'joana', 'luciana', 'monica',
      // International female names
      'ting', 'mei', 'li', 'yan', 'kyoko', 'sara', 'satu', 'laura',
      'alva', 'klara', 'petra', 'veena', 'lekha', 'carmit', 'yelda'
    ];
    
    // Check for male indicators
    for (const indicator of maleIndicators) {
      if (combined.includes(indicator)) return 'male';
    }
    
    // Check for female indicators
    for (const indicator of femaleIndicators) {
      if (combined.includes(indicator)) return 'female';
    }
    
    return 'neutral';
  }

  // Parse language code into structured data
  private static parseLanguage(langCode: string): {
    languageCode: string;
    languageName: string;
    region: string | null;
  } {
    // Handle undefined/null/empty strings
    if (!langCode || typeof langCode !== 'string') {
      return {
        languageCode: 'en-US',
        languageName: 'English',
        region: 'United States'
      };
    }
    
    // langCode format: "en-US", "es-ES", "fr-FR", etc.
    const parts = langCode.split('-');
    const langPart = parts[0].toLowerCase();
    const regionPart = parts[1]?.toUpperCase();

    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'cs': 'Czech',
      'el': 'Greek',
      'he': 'Hebrew',
      'th': 'Thai',
      'id': 'Indonesian',
      'vi': 'Vietnamese',
      'ro': 'Romanian',
      'hu': 'Hungarian',
      'sk': 'Slovak'
    };

    const regionNames: Record<string, string> = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'AU': 'Australia',
      'CA': 'Canada',
      'IN': 'India',
      'ES': 'Spain',
      'MX': 'Mexico',
      'AR': 'Argentina',
      'FR': 'France',
      'DE': 'Germany',
      'IT': 'Italy',
      'BR': 'Brazil',
      'PT': 'Portugal',
      'RU': 'Russia',
      'JP': 'Japan',
      'KR': 'South Korea',
      'CN': 'China',
      'TW': 'Taiwan',
      'HK': 'Hong Kong',
      'NL': 'Netherlands',
      'BE': 'Belgium',
      'CH': 'Switzerland',
      'AT': 'Austria'
    };

    const languageName = languageNames[langPart] || langPart.toUpperCase();
    const region = regionPart ? (regionNames[regionPart] || regionPart) : null;

    return {
      languageCode: langCode,
      languageName,
      region
    };
  }

  // Future: Parse Azure voice
  static parseAzureVoice(voice: any, index: number): ParsedVoice {
    // TODO: Implement when adding Azure
    throw new Error('Not implemented');
  }

  // Future: Parse Google voice
  static parseGoogleVoice(voice: any, index: number): ParsedVoice {
    // TODO: Implement when adding Google
    throw new Error('Not implemented');
  }
}
