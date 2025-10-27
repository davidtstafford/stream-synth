import { LanguageService } from './language-service';

// Test cases for different voice providers
const testVoices = [
  // Azure-style voice
  {
    name: 'Brian',
    language: 'en-US',
    languageName: 'English (United States)',
    provider: 'azure'
  },
  // Google-style voice
  {
    name: 'en-US-Standard-A',
    language: 'en-US',
    languageName: 'English',
    provider: 'google'
  },
  // Azure voice with just language code
  {
    name: 'Marie',
    language: 'fr-FR',
    languageName: 'French',
    provider: 'azure'
  },
  // Web Speech voice
  {
    name: 'Google UK English Male',
    language: 'en-GB',
    languageName: 'en-GB',
    provider: 'webspeech'
  },
];

console.log('=== Language Service Tests ===\n');

testVoices.forEach((voice, index) => {
  console.log(`Voice ${index + 1}: ${voice.name}`);
  console.log(`  Provider: ${voice.provider}`);
  console.log(`  Language: ${voice.language}`);
  
  const info = LanguageService.normalizeVoiceLanguage(voice);
  if (info) {
    console.log(`  ✓ Language Code: ${info.languageCode}`);
    console.log(`  ✓ Language Name: ${info.languageName}`);
    if (info.countryCode) {
      console.log(`  ✓ Country Code: ${info.countryCode}`);
    }
    if (info.countryName) {
      console.log(`  ✓ Country Name: ${info.countryName}`);
    }
    
    const display = LanguageService.formatVoiceLanguageDisplay(voice);
    console.log(`  ✓ Display: ${display}`);
  } else {
    console.log(`  ✗ Could not determine language`);
  }
  console.log();
});

console.log('=== Test Parse Locale ===\n');

const locales = ['en-US', 'en_US', 'fr-FR', 'de', 'zh-Hans-CN'];
locales.forEach(locale => {
  const parsed = LanguageService.parseLocale(locale);
  console.log(`${locale} → ${JSON.stringify(parsed)}`);
});

console.log('\n=== Test All Languages Count ===\n');
const allLangs = LanguageService.getAllLanguages();
const allCountries = LanguageService.getAllCountries();
console.log(`Total Languages: ${allLangs.length}`);
console.log(`Total Countries: ${allCountries.length}`);
