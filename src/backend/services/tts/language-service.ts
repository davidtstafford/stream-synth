import languageMappings from '../../data/language-mappings.json';

export interface LanguageMapping {
  code: string;
  name: string;
  nativeName: string;
}

export interface CountryMapping {
  code: string;
  name: string;
}

export interface VoiceLanguageInfo {
  languageCode: string;
  languageName: string;
  countryCode?: string;
  countryName?: string;
}

export class LanguageService {
  private static readonly languageMappings: Map<string, LanguageMapping> = new Map();
  private static readonly countryMappings: Map<string, CountryMapping> = new Map();

  static {
    // Initialize the language mappings map
    languageMappings.languageMappings.forEach(lang => {
      this.languageMappings.set(lang.code.toLowerCase(), lang);
      // Also add full language name as a key for lookup
      this.languageMappings.set(lang.name.toLowerCase(), lang);
    });

    // Initialize the country mappings map
    languageMappings.countryMappings.forEach(country => {
      this.countryMappings.set(country.code.toUpperCase(), country);
    });
  }
  /**
   * Get language name from language code
   * Supports various input formats: ISO 639-1 (e.g., 'en'), full names (e.g., 'English')
   * Also handles locale formats (e.g., 'en-US' returns 'English')
   */
  static getLanguageName(input: string | null | undefined): string | null {
    if (!input) {
      return null;
    }

    const normalized = input.trim().toLowerCase();

    // Try direct lookup
    const direct = this.languageMappings.get(normalized);
    if (direct) {
      return direct.name;
    }

    // Try locale code (e.g., 'en-US' -> 'en')
    if (normalized.includes('-')) {
      const parts = normalized.split('-');
      const langCode = this.languageMappings.get(parts[0]);
      if (langCode) {
        return langCode.name;
      }
    }

    // Try underscore format (e.g., 'en_US' -> 'en')
    if (normalized.includes('_')) {
      const parts = normalized.split('_');
      const langCode = this.languageMappings.get(parts[0]);
      if (langCode) {
        return langCode.name;
      }
    }

    // If still not found, return the input as-is (might be already a language name)
    return null;
  }

  /**
   * Get language code from language name
   */
  static getLanguageCode(name: string | null | undefined): string | null {
    if (!name) {
      return null;
    }

    const normalized = name.trim().toLowerCase();
    const mapping = this.languageMappings.get(normalized);
    return mapping ? mapping.code : null;
  }

  /**
   * Get country name from country code
   */
  static getCountryName(code: string | null | undefined): string | null {
    if (!code) {
      return null;
    }

    const normalized = code.trim().toUpperCase();
    const country = this.countryMappings.get(normalized);
    return country ? country.name : null;
  }

  /**
   * Extract language code and country code from locale string
   * Supports formats: 'en', 'en-US', 'en_US'
   */
  static parseLocale(locale: string | null | undefined): { langCode: string; countryCode?: string } | null {
    if (!locale) {
      return null;
    }

    const normalized = locale.trim().toUpperCase();

    // Handle hyphen format (e.g., 'en-US')
    if (normalized.includes('-')) {
      const [lang, country] = normalized.split('-');
      return { langCode: lang.toLowerCase(), countryCode: country };
    }

    // Handle underscore format (e.g., 'en_US')
    if (normalized.includes('_')) {
      const [lang, country] = normalized.split('_');
      return { langCode: lang.toLowerCase(), countryCode: country };
    }

    // Just a language code
    return { langCode: normalized.toLowerCase() };
  }

  /**
   * Determine language and country for a voice based on available information
   * Tries multiple fields and returns the best match
   */
  static determineLanguageAndCountry(voice: any): VoiceLanguageInfo | null {
    if (!voice) {
      return null;
    }

    // Try different language identifiers in order of preference
    const candidates = [
      voice.language,           // e.g., 'en', 'en-US', 'en_US'
      voice.languageName,       // e.g., 'English'
      voice.lang,              // alternative field
      voice.languageCode,      // another alternative
      voice.locale,            // locale might also help
    ].filter(c => c && typeof c === 'string');

    for (const candidate of candidates) {
      // First check if it's already a full language name
      if (this.languageMappings.has(candidate.toLowerCase())) {
        const mapping = this.languageMappings.get(candidate.toLowerCase());
        if (mapping) {
          return { 
            languageCode: mapping.code, 
            languageName: mapping.name 
          };
        }
      }

      // Try to parse as locale (e.g., 'en-US')
      const parsed = this.parseLocale(candidate);
      if (parsed) {
        const langMapping = this.languageMappings.get(parsed.langCode);
        if (langMapping) {
          const result: VoiceLanguageInfo = {
            languageCode: langMapping.code,
            languageName: langMapping.name,
          };

          // Add country if found
          if (parsed.countryCode) {
            const countryName = this.getCountryName(parsed.countryCode);
            if (countryName) {
              result.countryCode = parsed.countryCode;
              result.countryName = countryName;
            }
          }

          return result;
        }
      }
    }

    return null;
  }

  /**
   * Normalize voice language information
   * Ensures consistent format across different voice providers
   */
  static normalizeVoiceLanguage(voice: any): VoiceLanguageInfo | null {
    return this.determineLanguageAndCountry(voice);
  }

  /**
   * Format voice language for display
   * Examples:
   *   - "English" (no country)
   *   - "English (United States)"
   *   - "English (US)" (abbreviated)
   */
  static formatVoiceLanguageDisplay(voice: any, abbreviated = false): string | null {
    const info = this.determineLanguageAndCountry(voice);
    if (!info) {
      return null;
    }

    if (info.countryName) {
      const country = abbreviated ? info.countryCode : info.countryName;
      return `${info.languageName} (${country})`;
    }

    return info.languageName;
  }

  /**
   * Get all available languages
   */
  static getAllLanguages(): LanguageMapping[] {
    return languageMappings.languageMappings;
  }

  /**
   * Get all available countries
   */
  static getAllCountries(): CountryMapping[] {
    return languageMappings.countryMappings;
  }

  /**
   * Check if a language code exists
   */
  static isValidLanguageCode(code: string): boolean {
    return this.languageMappings.has(code.toLowerCase());
  }

  /**
   * Check if a country code exists
   */
  static isValidCountryCode(code: string): boolean {
    return this.countryMappings.has(code.toUpperCase());
  }
}
