/**
 * Discord Slash Commands
 * 
 * Defines all slash commands for the bot:
 * - /findvoice - Find voices by criteria (language, gender, provider)
 * - /help - Show help information
 * - /voice-test - Test a voice with a message
 */

import { SlashCommandBuilder, Awaitable } from 'discord.js';

/**
 * Register all slash commands
 */
export function registerSlashCommands(): Awaitable<any>[] {
  return [
    createFindVoiceCommand(),
    createHelpCommand()
    // Note: /voice-test removed - voice testing happens in Twitch, not Discord
  ];
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
