/**
 * Language Configuration - Centralized language and gender data
 * 
 * Single source of truth for:
 * - Language code to language name mapping
 * - Region code to region name mapping
 * - Gender detection from voice names
 */

export const LANGUAGE_MAP: Record<string, { name: string; region?: string }> = {
  'en-US': { name: 'English', region: 'United States' },
  'en-GB': { name: 'English', region: 'United Kingdom' },
  'en-AU': { name: 'English', region: 'Australia' },
  'en-CA': { name: 'English', region: 'Canada' },
  'en-IN': { name: 'English', region: 'India' },
  'es-ES': { name: 'Spanish', region: 'Spain' },
  'es-MX': { name: 'Spanish', region: 'Mexico' },
  'es-AR': { name: 'Spanish', region: 'Argentina' },
  'fr-FR': { name: 'French', region: 'France' },
  'fr-CA': { name: 'French', region: 'Canada' },
  'de-DE': { name: 'German', region: 'Germany' },
  'it-IT': { name: 'Italian', region: 'Italy' },
  'pt-BR': { name: 'Portuguese', region: 'Brazil' },
  'pt-PT': { name: 'Portuguese', region: 'Portugal' },
  'ja-JP': { name: 'Japanese', region: 'Japan' },
  'ko-KR': { name: 'Korean', region: 'South Korea' },
  'zh-CN': { name: 'Chinese', region: 'Simplified' },
  'zh-TW': { name: 'Chinese', region: 'Traditional' },
  'ru-RU': { name: 'Russian', region: 'Russia' },
  'ar-SA': { name: 'Arabic', region: 'Saudi Arabia' },
  'hi-IN': { name: 'Hindi', region: 'India' },
  'nl-NL': { name: 'Dutch', region: 'Netherlands' },
  'pl-PL': { name: 'Polish', region: 'Poland' },
  'tr-TR': { name: 'Turkish', region: 'Turkey' },
  'sv-SE': { name: 'Swedish', region: 'Sweden' },
  'da-DK': { name: 'Danish', region: 'Denmark' },
  'no-NO': { name: 'Norwegian', region: 'Norway' },
  'fi-FI': { name: 'Finnish', region: 'Finland' },
  'cs-CZ': { name: 'Czech', region: 'Czech Republic' },
  'el-GR': { name: 'Greek', region: 'Greece' },
  'he-IL': { name: 'Hebrew', region: 'Israel' },
  'th-TH': { name: 'Thai', region: 'Thailand' },
  'id-ID': { name: 'Indonesian', region: 'Indonesia' },
  'vi-VN': { name: 'Vietnamese', region: 'Vietnam' },
  'ro-RO': { name: 'Romanian', region: 'Romania' },
  'hu-HU': { name: 'Hungarian', region: 'Hungary' },
  'sk-SK': { name: 'Slovak', region: 'Slovakia' },
};

/**
 * Gender indicators for voice name detection
 */
export const GENDER_INDICATORS = {
  female: [
    'female', 'woman', 'girl', 'lady',
    'samantha', 'victoria', 'kate', 'monica', 'paulina', 'amelie', 
    'alice', 'emma', 'sophia', 'karen', 'nicky', 'jenny', 'flo',
    'sara', 'laura', 'anna', 'ava', 'catherine', 'ellen', 'grandma',
    'martha', 'sandy', 'shelley', 'susan', 'allison', 'kathy', 'melina',
    'milena', 'nora', 'tessa', 'zuzana', 'joana', 'luciana',
    'ting', 'mei', 'li', 'yan', 'kyoko', 'satu', 'joanna', 'ewa',
    'magdalena', 'julia', 'marija', 'stefania', 'jacqueline', 'ines',
    'olga', 'irina', 'tatiana', 'marta', 'felicity', 'amy', 'heidi',
    'moira', 'fiona', 'roz'
  ],
  male: [
    'male', 'man', 'boy', 'guy',
    'alex', 'daniel', 'fred', 'jorge', 'juan', 'diego', 'thomas', 'ralph', 
    'bruce', 'aaron', 'albert', 'arthur', 'brian', 'carlos', 'gordon',
    'henrik', 'james', 'lee', 'luca', 'martin', 'matej', 'nicolas', 
    'oliver', 'otoya', 'reed', 'rocko', 'grandpa',
    'xander', 'yannick', 'eddy', 'majed', 'maged', 'tarik', 'filip',
    'giorgio', 'enrique', 'oskar',
    'mikhail', 'yuri', 'pierre', 'emilio',
    'tong', 'fang', 'wei', 'qiang', 'takeshi', 'kenji', 'haruka',
    'tam', 'hieu', 'hans', 'tom'
  ]
};

/**
 * Get display name for a language code
 */
export function getLanguageName(langCode: string): string {
  const entry = LANGUAGE_MAP[langCode];
  if (entry) {
    return entry.region ? `${entry.name} (${entry.region})` : entry.name;
  }
  return langCode;
}

/**
 * Detect gender from voice name (unified implementation)
 */
export function detectGender(voiceName: string, voiceURI?: string): 'male' | 'female' | 'neutral' {
  const combined = `${voiceName} ${voiceURI || ''}`.toLowerCase();
  
  for (const indicator of GENDER_INDICATORS.female) {
    if (combined.includes(indicator)) return 'female';
  }
  
  for (const indicator of GENDER_INDICATORS.male) {
    if (combined.includes(indicator)) return 'male';
  }
  
  return 'neutral';
}

/**
 * Get language info from language code
 */
export function parseLanguageCode(langCode: string): {
  languageCode: string;
  languageName: string;
  region: string | null;
} {
  if (!langCode || typeof langCode !== 'string') {
    return {
      languageCode: 'en-US',
      languageName: 'English (United States)',
      region: 'United States'
    };
  }

  const entry = LANGUAGE_MAP[langCode];
  if (entry) {
    return {
      languageCode: langCode,
      languageName: entry.region ? `${entry.name} (${entry.region})` : entry.name,
      region: entry.region || null
    };
  }

  const basicLangNames: Record<string, string> = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
    'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish', 'sv': 'Swedish',
    'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'cs': 'Czech',
    'el': 'Greek', 'he': 'Hebrew', 'th': 'Thai', 'id': 'Indonesian',
    'vi': 'Vietnamese', 'ro': 'Romanian', 'hu': 'Hungarian', 'sk': 'Slovak'
  };

  const parts = langCode.split('-');
  const langPart = parts[0].toLowerCase();
  const languageName = basicLangNames[langPart] || langPart.toUpperCase();
  
  return {
    languageCode: langCode,
    languageName,
    region: null
  };
}
