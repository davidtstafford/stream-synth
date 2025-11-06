/**
 * Discord Slash Commands
 * 
 * Defines all slash commands for the bot:
 * - /findvoice - Find voices by criteria (language, gender, provider)
 * - /listlanguages - List all available languages, optionally filtered by provider
 * - /help - Show help information
 */

import { SlashCommandBuilder, Awaitable } from 'discord.js';

/**
 * Register all slash commands
 */
export function registerSlashCommands(): Awaitable<any>[] {
  return [
    createSearchVoiceCommand(),
    createProvidersCommand(),
    createVoiceDemoCommand(),
    createRandomVoiceCommand(),
    createFindVoiceCommand(),
    createListLanguagesCommand(),
    createHelpCommand()
  ];
}

/**
 * /searchvoice - Search voices by name or description
 */
function createSearchVoiceCommand(): any {
  return new SlashCommandBuilder()
    .setName('searchvoice')
    .setDescription('Search for voices by name or description')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search term (voice name, language, or provider)')
        .setRequired(true)
    );
}

/**
 * /providers - List available TTS providers
 */
function createProvidersCommand(): any {
  return new SlashCommandBuilder()
    .setName('providers')
    .setDescription('Show information about available TTS providers (WebSpeech, Azure, Google)');
}

/**
 * /voicedemo - Demo a voice with sample text
 */
function createVoiceDemoCommand(): any {
  return new SlashCommandBuilder()
    .setName('voicedemo')
    .setDescription('Hear a demo of a voice')
    .addStringOption(option =>
      option
        .setName('voiceid')
        .setDescription('The voice ID to demo')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('Custom text to speak (max 200 characters)')
        .setRequired(false)
        .setMaxLength(200)
    );
}

/**
 * /randomvoice - Get a random voice suggestion
 */
function createRandomVoiceCommand(): any {
  return new SlashCommandBuilder()
    .setName('randomvoice')
    .setDescription('Get a random voice suggestion for your stream');
}

/**
 * /findvoice - Find voices by criteria
 */
function createFindVoiceCommand(): any {
  return new SlashCommandBuilder()
    .setName('findvoice')
    .setDescription('Find TTS voices by language, gender, or provider')
    .addStringOption(option =>
      option
        .setName('language')
        .setDescription('Filter by language (e.g., English, French, Spanish)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('gender')
        .setDescription('Filter by gender (Male, Female, Non-binary)')
        .setRequired(false)
        .addChoices(
          { name: 'Male', value: 'male' },
          { name: 'Female', value: 'female' },
          { name: 'Non-binary', value: 'non-binary' }
        )
    )
    .addStringOption(option =>
      option
        .setName('provider')
        .setDescription('Filter by provider (WebSpeech, Azure, Google)')
        .setRequired(false)
        .addChoices(
          { name: 'WebSpeech', value: 'webspeech' },
          { name: 'Azure', value: 'azure' },
          { name: 'Google', value: 'google' }
        )
    );
}

/**
 * /listlanguages - List all available languages
 */
function createListLanguagesCommand(): any {
  return new SlashCommandBuilder()
    .setName('listlanguages')
    .setDescription('List all available languages for TTS voices')
    .addStringOption(option =>
      option
        .setName('provider')
        .setDescription('Filter by provider (optional)')
        .setRequired(false)
        .addChoices(
          { name: 'WebSpeech', value: 'webspeech' },
          { name: 'Azure', value: 'azure' },
          { name: 'Google', value: 'google' }
        )
    );
}

/**
 * /help - Show help information
 */
function createHelpCommand(): any {
  return new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information for Stream Synth voice commands');
}

/**
 * /voice-test - Test a voice
 */
function createVoiceTestCommand(): any {
  return new SlashCommandBuilder()
    .setName('voice-test')
    .setDescription('Test a voice by ID with a custom message')
    .addIntegerOption(option =>
      option
        .setName('voiceid')
        .setDescription('The voice ID to test (from /findvoice results)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Custom message to speak (optional, max 200 chars)')
        .setRequired(false)
        .setMaxLength(200)
    );
}
