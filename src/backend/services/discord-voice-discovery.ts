/**
 * Discord Voice Discovery Service
 * 
 * Handles voice filtering, searching, and formatting for Discord interactions:
 * - Filter voices by language, gender, provider
 * - Search voices by name or ID
 * - Format voices for Discord embeds
 * - Support pagination
 */

import { VoicesRepository, VoiceWithNumericId } from '../database/repositories/voices';
import { EmbedBuilder } from 'discord.js';

const voicesRepo = new VoicesRepository();

export interface VoiceFilter {
  language?: string | null;
  gender?: string | null;
  provider?: string | null;
  search?: string | null;
}

/**
 * Get voices filtered by criteria
 */
export function getVoicesByFilters(filters: VoiceFilter): VoiceWithNumericId[] {
  const allVoices = voicesRepo.getAvailableVoices();

  let filtered = allVoices.filter((voice: VoiceWithNumericId) => {
    // Filter by language
    if (filters.language) {
      const voiceLang = (voice.language_name || '').toLowerCase();
      const filterLang = filters.language.toLowerCase();
      if (!voiceLang.includes(filterLang)) return false;
    }

    // Filter by gender
    if (filters.gender) {
      if (voice.gender !== filters.gender) return false;
    }

    // Filter by provider
    if (filters.provider) {
      if (voice.provider !== filters.provider) return false;
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const voiceName = (voice.name || '').toLowerCase();
      if (!voiceName.includes(searchTerm)) return false;
    }

    return true;
  });

  // Sort by numeric_id for consistent ordering
  return filtered.sort((a: VoiceWithNumericId, b: VoiceWithNumericId) => a.numeric_id - b.numeric_id);
}

/**
 * Get a single voice by ID
 */
export function getVoiceById(voiceId: number): VoiceWithNumericId | null {
  try {
    return voicesRepo.getVoiceByNumericId(voiceId) || null;
  } catch (err) {
    return null;
  }
}

/**
 * Search voices by name
 */
export function searchVoices(query: string): VoiceWithNumericId[] {
  return getVoicesByFilters({ search: query });
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): string[] {
  const allVoices = voicesRepo.getAvailableVoices();
  const languages = new Set<string>();

  for (const voice of allVoices) {
    if (voice.language_name) {
      languages.add(voice.language_name);
    }
  }

  return Array.from(languages).sort();
}

/**
 * Get voice statistics
 */
export function getVoiceStats() {
  const allVoices = voicesRepo.getAvailableVoices();

  const genderCounts = { male: 0, female: 0, 'non-binary': 0 };
  const providerCounts: Record<string, number> = {};

  for (const voice of allVoices) {
    if (voice.gender && genderCounts.hasOwnProperty(voice.gender)) {
      genderCounts[voice.gender as keyof typeof genderCounts]++;
    }
    if (voice.provider) {
      providerCounts[voice.provider] = (providerCounts[voice.provider] || 0) + 1;
    }
  }

  return {
    total: allVoices.length,
    genders: genderCounts,
    providers: providerCounts,
    languages: getAvailableLanguages().length
  };
}

/**
 * Format voices for Discord embeds (paginated)
 */
export function formatVoicesForEmbed(voices: VoiceWithNumericId[], perPage: number = 10): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  const totalPages = Math.ceil(voices.length / perPage);

  for (let page = 0; page < totalPages; page++) {
    const start = page * perPage;
    const end = Math.min(start + perPage, voices.length);
    const pageVoices = voices.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle('🎤 Available TTS Voices')
      .setDescription(
        `Page ${page + 1}/${totalPages}\n` +
        `Copy the Voice ID and use \`~setvoice\` in Twitch chat to set your voice`
      )
      .setColor(0x5865F2);

    // Add voices as fields
    for (const voice of pageVoices) {
      const genderEmoji = 
        voice.gender === 'male' ? '♂️' :
        voice.gender === 'female' ? '♀️' :
        '⚧';

      // Use the voice identifier (what users need for ~setvoice)
      const voiceId = voice.voice_id || 'N/A';

      const fieldValue =
        `**Voice ID:** \`${voiceId}\`\n` +
        `**Provider:** ${voice.provider || 'Unknown'}\n` +
        `**Gender:** ${genderEmoji} ${voice.gender || 'Unknown'}\n` +
        `**Language:** ${voice.language_name || 'Unknown'}\n\n` +
        `💬 Use in chat: \`~setvoice ${voiceId}\``;

      embed.addFields({
        name: voice.name || 'Unnamed Voice',
        value: fieldValue,
        inline: false
      });
    }

    embed.setFooter({
      text: `Showing ${start + 1}-${end} of ${voices.length} voices • Stream Synth`
    });

    embeds.push(embed);
  }

  return embeds;
}

/**
 * Create a summary embed for voice discovery
 */
export function createDiscoverySummaryEmbed(): EmbedBuilder {
  const stats = getVoiceStats();

  const embed = new EmbedBuilder()
    .setTitle('🎤 Stream Synth Voice Discovery')
    .setDescription('Find and test TTS voices for your stream')
    .setColor(0x5865F2)
    .addFields(
      {
        name: 'Total Voices',
        value: `**${stats.total}** voices available`,
        inline: false
      },
      {
        name: 'By Gender',
        value: `♂️ Male: **${stats.genders.male}** | ♀️ Female: **${stats.genders.female}** | ⚧ Other: **${stats.genders['non-binary']}**`,
        inline: false
      },
      {
        name: 'By Provider',
        value: Object.entries(stats.providers)
          .map(([provider, count]) => `${provider}: **${count}**`)
          .join(' | '),
        inline: false
      },
      {
        name: 'Languages',
        value: `**${stats.languages}** languages supported`,
        inline: false
      },
      {
        name: 'Quick Start',
        value: '1. Use `/findvoice` to search voices\n' +
               '2. Use `/voice-test <ID>` to hear samples\n' +
               '3. Use `~setvoice <ID>` in Twitch chat to activate',
        inline: false
      }
    )
    .setFooter({ text: 'Type /help for more information' });

  return embed;
}
