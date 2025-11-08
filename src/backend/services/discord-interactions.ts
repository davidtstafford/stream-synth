/**
 * Discord Interaction Handlers
 * 
 * Handles all Discord interactions:
 * - Slash command interactions
 * - Button interactions
 * - Select menu interactions
 * - Modal submissions
 */

import {
  Client,
  Interaction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { getVoicesByFilters, getVoiceById, formatVoicesForEmbed, getAvailableLanguages } from './discord-voice-discovery';
import {
  setPaginationState,
  getPaginationState,
  updateCurrentPage,
  getPageVoices,
  getPaginationInfo,
  clearPaginationState
} from './discord-pagination';

let client: Client | null = null;

/**
 * Setup interaction handlers
 */
export function setupInteractionHandlers(botClient: Client): void {
  client = botClient;

  client.on('interactionCreate', handleInteraction);
}

/**
 * Main interaction handler router
 */
async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (err: any) {
    console.error('[Discord Interactions] Error handling interaction:', err.message);
    try {
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            content: '❌ An error occurred while processing your request.'
          });
        } else {
          await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
          });
        }
      }
    } catch (replyErr: any) {
      console.error('[Discord Interactions] Error sending error response:', replyErr.message);
    }
  }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(interaction: any): Promise<void> {
  const commandName = interaction.commandName;

  console.log(`[Discord Interactions] Slash command: /${commandName}`);

  switch (commandName) {
    case 'searchvoice':
      await handleSearchVoiceCommand(interaction);
      break;
    case 'providers':
      await handleProvidersCommand(interaction);
      break;
    case 'voicedemo':
      await handleVoiceDemoCommand(interaction);
      break;
    case 'randomvoice':
      await handleRandomVoiceCommand(interaction);
      break;
    case 'findvoice':
      await handleFindVoiceCommand(interaction);
      break;
    case 'listlanguages':
      await handleListLanguagesCommand(interaction);
      break;
    case 'help':
      await handleHelpCommand(interaction);
      break;
    default:
      await interaction.reply({
        content: `❌ Unknown command: /${commandName}`,
        ephemeral: true
      });
  }
}

/**
 * Handle /searchvoice command
 */
async function handleSearchVoiceCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const query = interaction.options.getString('query') || '';

  console.log('[Discord Interactions] Searching voices:', query);

  try {
    if (!query || query.length === 0) {
      await interaction.editReply({
        content: '❌ Please provide a search query. Example: `/searchvoice query:Emma`'
      });
      return;
    }

    // Search voices by name or description (case-insensitive)
    const allVoices = getVoicesByFilters({});
    const searchResults = allVoices.filter((voice: any) =>
      voice.name.toLowerCase().includes(query.toLowerCase()) ||
      voice.provider?.toLowerCase().includes(query.toLowerCase()) ||
      voice.language?.toLowerCase().includes(query.toLowerCase())
    );

    if (searchResults.length === 0) {
      await interaction.editReply({
        content: `❌ No voices found matching "${query}". Try a different search term!`
      });
      return;
    }

    // Format results
    const embeds = formatVoicesForEmbed(searchResults.slice(0, 10), 10);
    const summaryEmbed = new EmbedBuilder()
      .setTitle(`🔍 Search Results: "${query}"`)
      .setDescription(`Found ${searchResults.length} matching voice${searchResults.length !== 1 ? 's' : ''}`)
      .setColor(0x5865F2);

    await interaction.editReply({
      embeds: [summaryEmbed, ...embeds],
      content: `Found ${searchResults.length} results • Showing first 10`
    });
  } catch (err: any) {
    console.error('[Discord Interactions] Error searching voices:', err);
    await interaction.editReply({
      content: `❌ Error searching voices: ${err.message}`
    });
  }
}

/**
 * Handle /providers command
 */
async function handleProvidersCommand(interaction: any): Promise<void> {
  const providersEmbed = new EmbedBuilder()
    .setTitle('🏢 Available TTS Providers')
    .setDescription('Compare and learn about TTS providers')
    .setColor(0x5865F2)
    .addFields(
      {
        name: '🔊 WebSpeech',
        value: '**Quality:** Standard\n' +
               '**Latency:** Very fast\n' +
               '**Languages:** 40+\n' +
               '**Cost:** Free\n' +
               '**Best for:** Quick voices, browser-based',
        inline: true
      },
      {
        name: '☁️ Google Cloud',
        value: '**Quality:** High\n' +
               '**Latency:** Fast\n' +
               '**Languages:** 80+\n' +
               '**Cost:** Paid\n' +
               '**Best for:** Professional, international',
        inline: true
      },
      {
        name: '☁️ Microsoft Azure',
        value: '**Quality:** High\n' +
               '**Latency:** Fast\n' +
               '**Languages:** 100+\n' +
               '**Cost:** Paid\n' +
               '**Best for:** Premium voices, enterprise',
        inline: true
      },
      {
        name: '💡 How to Choose',
        value: '• **Budget-conscious?** → Try WebSpeech first\n' +
               '• **Need variety?** → Azure has the most languages\n' +
               '• **High quality?** → Google and Azure are both great\n' +
               '• **International stream?** → Check `/listlanguages provider:Azure`',
        inline: false
      },
      {
        name: '🔄 Switching Providers',
        value: 'Use `/findvoice provider:Azure` to browse one provider\'s voices.\n' +
               'All three providers are integrated with Stream Synth!',
        inline: false
      }
    )
    .setFooter({ text: 'Compare providers and find the best fit for your stream' });

  await interaction.reply({
    embeds: [providersEmbed],
    ephemeral: true
  });
}

/**
 * Handle /voicedemo command
 */
async function handleVoiceDemoCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const voiceId = interaction.options.getString('voiceid') || '';
  const customText = interaction.options.getString('text');

  console.log('[Discord Interactions] Playing voice demo:', { voiceId, customText });

  try {
    if (!voiceId) {
      await interaction.editReply({
        content: '❌ Please provide a voice ID. Get one from `/findvoice` results!'
      });
      return;
    }

    const voice = getVoiceById(voiceId);

    if (!voice) {
      await interaction.editReply({
        content: `❌ Voice not found: ${voiceId}`
      });
      return;
    }

    const demoText = customText || 'Hello! This is a voice demo from Stream Synth.';

    const demoEmbed = new EmbedBuilder()
      .setTitle('🔊 Voice Demo')
      .setDescription(`**Voice:** ${voice.name}\n**Provider:** ${voice.provider}\n**Language:** ${voice.language_name}`)
      .setColor(0x5865F2)
      .addFields(
        {
          name: 'Demo Text',
          value: `"${demoText}"`,
          inline: false
        },
        {
          name: '⏯️ Playing...',
          value: 'Audio playback would occur in the main Stream Synth app',
          inline: false
        }
      )
      .setFooter({ text: `Voice ID: ${voiceId}` });

    await interaction.editReply({
      embeds: [demoEmbed]
    });
  } catch (err: any) {
    console.error('[Discord Interactions] Error playing demo:', err);
    await interaction.editReply({
      content: `❌ Error playing demo: ${err.message}`
    });
  }
}

/**
 * Handle /randomvoice command
 */
async function handleRandomVoiceCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  try {
    const allVoices = getVoicesByFilters({});

    if (allVoices.length === 0) {
      await interaction.editReply({
        content: '❌ No voices available. Sync voices in the Stream Synth app first!'
      });
      return;
    }

    const randomVoice = allVoices[Math.floor(Math.random() * allVoices.length)];
    const embeds = formatVoicesForEmbed([randomVoice], 1);

    const randomEmbed = new EmbedBuilder()
      .setTitle('🎲 Random Voice Suggestion')
      .setDescription('Like it? Use it! Or try another random voice.')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '📋 How to Use',
          value: `1. Copy the Voice ID from above\n2. In Twitch chat: \`~setvoice ${randomVoice.voice_id}\`\n3. Your viewers will love it!`,
          inline: false
        }
      );

    await interaction.editReply({
      embeds: [randomEmbed, ...embeds],
      content: 'Here\'s a random voice for you!'
    });
  } catch (err: any) {
    console.error('[Discord Interactions] Error getting random voice:', err);
    await interaction.editReply({
      content: `❌ Error getting random voice: ${err.message}`
    });
  }
}

/**
 * Handle /findvoice command
 */
async function handleFindVoiceCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const language = interaction.options.getString('language') || undefined;
  const gender = interaction.options.getString('gender') || undefined;
  const provider = interaction.options.getString('provider') || undefined;

  console.log('[Discord Interactions] Finding voices:', { language, gender, provider });

  try {
    // Build filters object, omitting undefined values
    const filters: any = {};
    if (language) filters.language = language;
    if (gender) filters.gender = gender;
    if (provider) filters.provider = provider;

    console.log('[Discord Interactions] Applying filters:', filters);
    const voices = getVoicesByFilters(filters);
    console.log('[Discord Interactions] Found', voices.length, 'voices');

    if (voices.length === 0) {
      await interaction.editReply({
        content: '❌ No voices found matching your criteria. Try adjusting your filters!'
      });
      return;
    }

    // Store pagination state
    setPaginationState(
      interaction.user.id,
      interaction.id,
      voices,
      { language, gender, provider },
      10
    );

    // Create embeds with pagination (max 10 voices per embed)
    const pageVoices = getPageVoices(interaction.user.id, interaction.id);
    console.log('[Discord Interactions] Formatting', pageVoices.length, 'voices for first page');
    
    const embeds = formatVoicesForEmbed(pageVoices, 10);
    console.log('[Discord Interactions] Created', embeds.length, 'embed(s)');
    
    const paginationInfo = getPaginationInfo(interaction.user.id, interaction.id);

    // Build action rows (buttons + select menus)
    const actionRows = buildVoiceActionRows(
      interaction.user.id,
      interaction.id,
      paginationInfo
    );

    await interaction.editReply({
      embeds: embeds,
      content: `🎤 **Found ${voices.length} voices** • Showing ${paginationInfo?.startIdx || 1}-${paginationInfo?.endIdx || 0} • Page ${paginationInfo?.currentPage}/${paginationInfo?.totalPages}`,
      components: actionRows
    });
  } catch (err: any) {
    console.error('[Discord Interactions] Error in findvoice:', err);
    console.error('[Discord Interactions] Stack:', err.stack);
    await interaction.editReply({
      content: `❌ Error finding voices: ${err.message}\n\nPlease check the logs for details.`
    });
  }
}

/**
 * Build action rows with buttons and select menus
 */
function buildVoiceActionRows(userId: string, interactionId: string, paginationInfo: any): ActionRowBuilder<any>[] {
  const rows: ActionRowBuilder<any>[] = [];

  // Row 1: Pagination buttons
  const paginationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`prev_page_${interactionId}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginationInfo?.currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`next_page_${interactionId}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginationInfo?.currentPage === paginationInfo?.totalPages)
    );
  rows.push(paginationRow as any);

  // Row 2: Gender filter (simple, always fits)
  const genderSelect = new StringSelectMenuBuilder()
    .setCustomId(`gender_select_${interactionId}`)
    .setPlaceholder('Filter by Gender')
    .setMinValues(0)
    .setMaxValues(1)
    .addOptions([
      { label: '🔄 Clear Filter', value: 'clear_gender' },
      { label: '👨 Male', value: 'male' },
      { label: '👩 Female', value: 'female' },
      { label: '👫 Non-binary', value: 'non-binary' }
    ]);

  const row2 = new ActionRowBuilder().addComponents(genderSelect);
  rows.push(row2 as any);
  
  // Note: Language filter removed due to Discord's 25 option limit
  // With 60+ languages, we can't use a dropdown
  // Users should use the slash command parameter instead:
  // /findvoice language:Spanish

  return rows;
}

/**
 * Handle /listlanguages command
 */
async function handleListLanguagesCommand(interaction: any): Promise<void> {
  await interaction.deferReply();

  const provider = interaction.options.getString('provider') || undefined;

  console.log('[Discord Interactions] Listing languages, provider filter:', provider);

  try {
    // Get all available languages, optionally filtered by provider
    const languages = getAvailableLanguages(provider);
    console.log('[Discord Interactions] Found', languages.length, 'languages');

    if (languages.length === 0) {
      await interaction.editReply({
        content: '❌ No languages found. Make sure voices are synced in the Stream Synth app!'
      });
      return;
    }

    // Sort languages alphabetically
    languages.sort();

    // Build the embed
    const languageEmbed = new EmbedBuilder()
      .setTitle('🌍 Available Languages')
      .setDescription(provider ? `Showing languages for **${provider.toUpperCase()}** provider` : 'Showing all available languages')
      .setColor(0x5865F2)
      .setFooter({ text: `Total: ${languages.length} language${languages.length !== 1 ? 's' : ''}` });

    // Split languages into chunks for multiple fields (max 25 fields per embed, ~1024 chars per field)
    const chunkSize = 50; // Languages per field
    const chunks: string[][] = [];
    for (let i = 0; i < languages.length; i += chunkSize) {
      chunks.push(languages.slice(i, i + chunkSize));
    }

    // Add fields (Discord limit: 25 fields per embed)
    chunks.slice(0, 25).forEach((chunk, index) => {
      const fieldTitle = chunks.length > 1 ? `Languages (${index * chunkSize + 1}-${Math.min((index + 1) * chunkSize, languages.length)})` : 'Languages';
      languageEmbed.addFields({
        name: fieldTitle,
        value: chunk.map(lang => `• ${lang}`).join('\n'),
        inline: false
      });
    });

    // Add usage tip
    languageEmbed.addFields({
      name: '💡 Usage',
      value: 'Use these languages with `/findvoice language:<language>`\n' +
             'Example: `/findvoice language:English` or `/findvoice language:Spanish`',
      inline: false
    });

    await interaction.editReply({
      embeds: [languageEmbed]
    });
  } catch (err: any) {
    console.error('[Discord Interactions] Error listing languages:', err);
    await interaction.editReply({
      content: `❌ Error listing languages: ${err.message}`
    });
  }
}

/**
 * Handle /help command
 */
async function handleHelpCommand(interaction: any): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setTitle('🎤 Stream Synth Discord Commands')
    .setDescription('Discover and manage TTS voices for your stream')
    .setColor(0x5865F2)
    .addFields(
      {
        name: '⭐ Top Commands',
        value: '`/searchvoice` ⭐⭐⭐ - Search for voices by name or description\n' +
               '`/findvoice` ⭐⭐⭐ - Browse voices with advanced filters\n' +
               '`/providers` ⭐⭐ - Learn about TTS providers\n' +
               '`/voicedemo` ⭐⭐ - Hear a voice demo\n' +
               '`/randomvoice` ⭐⭐ - Get a random voice suggestion\n' +
               '`/listlanguages` - List all available languages\n' +
               '`/help` - Show this message',
        inline: false
      },
      {
        name: '🔥 Quick Start',
        value: '1. Type `/findvoice` to browse voices\n' +
               '2. Find a voice you like\n' +
               '3. Copy the Voice ID\n' +
               '4. In Twitch chat: `~setvoice <Voice ID>`\n' +
               '5. Adjust with: `~setvoicepitch <0.5-2.0>` or `~setvoicespeed <0.5-2.0>`\n' +
               '6. Done! Your TTS voice is set',
        inline: false
      },
      {
        name: ' /searchvoice',
        value: '**Usage:** `/searchvoice query:<search term>`\n\n' +
               '**Examples:**\n' +
               '• `/searchvoice query:English` - Find English voices\n' +
               '• `/searchvoice query:Google` - Find Google voices\n' +
               '• `/searchvoice query:Emma` - Search by name',
        inline: false
      },
      {
        name: '🎯 /findvoice',
        value: '**Usage:** `/findvoice [language] [gender] [provider]`\n\n' +
               '**Examples:**\n' +
               '• `/findvoice` - Show all voices\n' +
               '• `/findvoice language:Spanish` - Spanish voices\n' +
               '• `/findvoice gender:Female` - Female voices\n' +
               '• `/findvoice language:French gender:Female provider:Azure`\n\n' +
               '**Features:** Pagination • Real-time filters • Voice details',
        inline: false
      },
      {
        name: '🏢 /providers',
        value: 'Learn about available TTS providers:\n' +
               '• **WebSpeech** - Built-in browser voices\n' +
               '• **Azure** - Microsoft\'s professional voices\n' +
               '• **Google** - Google Cloud\'s high-quality voices\n' +
               'Each has different languages and accents!',
        inline: false
      },
      {
        name: '🔊 /voicedemo',
        value: '**Usage:** `/voicedemo voiceid:<ID> [text:<optional text>]`\n\n' +
               'Hear a sample of any voice before setting it:\n' +
               '• Uses default demo text if no text specified\n' +
               '• Custom text (max 200 chars)\n' +
               '• Instant playback preview',
        inline: false
      },
      {
        name: '🎲 /randomvoice',
        value: 'Get a random voice suggestion!\n\n' +
               'Perfect for:\n' +
               '• Discovering new voices\n' +
               '• Keeping your stream fresh\n' +
               '• Fun spontaneous voice changes\n' +
               '• Breaking out of voice ruts',
        inline: false
      },
      {
        name: '🌍 /listlanguages',
        value: '**Usage:** `/listlanguages [provider]`\n\n' +
               '**Examples:**\n' +
               '• `/listlanguages` - All languages\n' +
               '• `/listlanguages provider:Google` - Google only\n' +
               '• `/listlanguages provider:Azure` - Azure only\n\n' +
               'Use these with `/findvoice language:<name>`',
        inline: false
      },
      {
        name: '🎵 ~setvoicepitch (Twitch Chat)',
        value: '**Usage:** `~setvoicepitch <value>`\n\n' +
               '**Range:** 0.5 (lower) to 2.0 (higher)\n\n' +
               '**Examples:**\n' +
               '• `~setvoicepitch 0.8` - Lower pitch\n' +
               '• `~setvoicepitch 1.0` - Normal (default)\n' +
               '• `~setvoicepitch 1.5` - Higher pitch\n\n' +
               '**Requirements:** Must have set a voice with `~setvoice` first',
        inline: false
      },
      {
        name: '⏱️ ~setvoicespeed (Twitch Chat)',
        value: '**Usage:** `~setvoicespeed <value>`\n\n' +
               '**Range:** 0.5 (slower) to 2.0 (faster)\n\n' +
               '**Examples:**\n' +
               '• `~setvoicespeed 0.8` - Slower speech\n' +
               '• `~setvoicespeed 1.0` - Normal (default)\n' +
               '• `~setvoicespeed 1.5` - Faster speech\n\n' +
               '**Requirements:** Must have set a voice with `~setvoice` first',
        inline: false
      },
      {
        name: '💡 Tips & Tricks',
        value: '✓ Combine filters in `/findvoice` for precision\n' +
               '✓ Try `/randomvoice` for discovery\n' +
               '✓ Use `/voicedemo` before setting a voice\n' +
               '✓ Use `~setvoicepitch` and `~setvoicespeed` to customize your voice\n' +
               '✓ Use `/searchvoice` to find voices fast\n' +
               '✓ All voices synced from Stream Synth app',
        inline: false
      }
    )
    .setFooter({ text: 'Stream Synth • Discord Voice Discovery Bot' });

  await interaction.reply({
    embeds: [helpEmbed],
    ephemeral: true
  });
}

/**
 * Note: /voice-test command was removed
 * 
 * Why: Voice testing requires playing audio through the stream's TTS system,
 * which is complex to implement and doesn't make sense for Discord.
 * 
 * Users should test voices in Twitch chat using ~setvoice <ID> instead.
 */

/**
 * Handle button interactions
 */
async function handleButtonInteraction(interaction: any): Promise<void> {
  const buttonId = interaction.customId;
  console.log('[Discord Interactions] Button click:', buttonId);

  try {
    // Parse button ID (format: action_page_interactionId)
    const parts = buttonId.split('_');
    const action = parts[0]; // 'prev' or 'next'
    // Skip "page" part and get the actual interaction ID
    const interactionId = parts.slice(2).join('_'); // Skip action and "page", get interaction ID

    if (action === 'prev' || action === 'next') {
      await handlePaginationButton(interaction, action, interactionId);
    } else {
      await interaction.reply({
        content: '❌ Unknown button action',
        ephemeral: true
      });
    }
  } catch (err: any) {
    console.error('[Discord Interactions] Error handling button:', err.message);
    await interaction.reply({
      content: '❌ Error processing button click',
      ephemeral: true
    });
  }
}

/**
 * Handle pagination button clicks
 */
async function handlePaginationButton(interaction: any, action: string, interactionId: string): Promise<void> {
  await interaction.deferUpdate(); // Acknowledge without replying

  console.log(`[Discord Interactions] Looking for pagination state: userId=${interaction.user.id}, interactionId=${interactionId}`);
  const state = getPaginationState(interaction.user.id, interactionId);

  if (!state) {
    console.error('[Discord Interactions] Pagination state not found!');
    await interaction.followUp({
      content: '❌ Pagination state expired. Use `/findvoice` again.',
      ephemeral: true
    });
    return;
  }
  
  console.log(`[Discord Interactions] Found state: page ${state.currentPage}/${state.totalPages}, ${state.voices.length} voices`);

  let newPage = state.currentPage;

  if (action === 'next') {
    newPage = Math.min(state.currentPage + 1, state.totalPages);
  } else if (action === 'prev') {
    newPage = Math.max(state.currentPage - 1, 1);
  }

  // Update page
  const success = updateCurrentPage(interaction.user.id, interactionId, newPage);

  if (!success) {
    await interaction.followUp({
      content: '❌ Could not change page',
      ephemeral: true
    });
    return;
  }

  // Get new page data
  const pageVoices = getPageVoices(interaction.user.id, interactionId);
  const embeds = formatVoicesForEmbed(pageVoices, 10);
  const paginationInfo = getPaginationInfo(interaction.user.id, interactionId);

  // Build updated action rows
  const actionRows = buildVoiceActionRows(interaction.user.id, interactionId, paginationInfo);

  // Update message
  await interaction.editReply({
    embeds: embeds,
    content: `🎤 **${state.voices.length} voices** • Showing ${paginationInfo?.startIdx || 1}-${paginationInfo?.endIdx || 0} • Page ${paginationInfo?.currentPage}/${paginationInfo?.totalPages}`,
    components: actionRows
  });
}

/**
 * Handle select menu interactions
 */
async function handleSelectMenuInteraction(interaction: any): Promise<void> {
  const menuId = interaction.customId;
  const selected = interaction.values;

  console.log('[Discord Interactions] Select menu:', { menuId, selected });

  try {
    const parts = menuId.split('_');
    const filterType = parts[0]; // 'gender' or 'lang'
    // Skip "select" part and get the actual interaction ID
    const interactionId = parts.slice(2).join('_'); // Skip filterType and "select"

    if (filterType === 'lang' || filterType === 'gender') {
      await handleFilterChange(interaction, filterType, selected, interactionId);
    } else {
      await interaction.reply({
        content: '❌ Unknown filter type',
        ephemeral: true
      });
    }
  } catch (err: any) {
    console.error('[Discord Interactions] Error handling select menu:', err.message);
    await interaction.reply({
      content: '❌ Error processing filter',
      ephemeral: true
    });
  }
}

/**
 * Handle filter changes from select menus
 */
async function handleFilterChange(
  interaction: any,
  filterType: string,
  selected: string[],
  interactionId: string
): Promise<void> {
  await interaction.deferUpdate();

  const state = getPaginationState(interaction.user.id, interactionId);

  if (!state) {
    await interaction.followUp({
      content: '❌ Filter state expired. Use `/findvoice` again.',
      ephemeral: true
    });
    return;
  }

  // Determine new filter value
  const newValue = selected[0] === `clear_${filterType}` ? undefined : selected[0];

  // Update filter
  if (filterType === 'lang') {
    state.filters.language = newValue;
  } else if (filterType === 'gender') {
    state.filters.gender = newValue;
  }

  // Re-query voices with updated filters
  const newVoices = getVoicesByFilters(state.filters);

  if (newVoices.length === 0) {
    await interaction.followUp({
      content: '❌ No voices match the updated filters. Try adjusting them.',
      ephemeral: true
    });
    return;
  }

  // Reset pagination state with new voices
  setPaginationState(
    interaction.user.id,
    interactionId,
    newVoices,
    state.filters,
    10
  );

  // Get first page of new results
  const pageVoices = getPageVoices(interaction.user.id, interactionId);
  const embeds = formatVoicesForEmbed(pageVoices, 10);
  const paginationInfo = getPaginationInfo(interaction.user.id, interactionId);

  // Build action rows
  const actionRows = buildVoiceActionRows(interaction.user.id, interactionId, paginationInfo);

  // Format filter display
  const filterDisplay = [
    state.filters.language ? `Language: ${state.filters.language}` : null,
    state.filters.gender ? `Gender: ${state.filters.gender}` : null,
    state.filters.provider ? `Provider: ${state.filters.provider}` : null
  ].filter(Boolean).join(' • ');

  // Update message
  await interaction.editReply({
    embeds: embeds,
    content: `🎤 **${newVoices.length} voices** • ${filterDisplay || 'No filters'} • Page ${paginationInfo?.currentPage}/${paginationInfo?.totalPages}`,
    components: actionRows
  });
}

/**
 * Handle modal submissions
 */
async function handleModalSubmit(interaction: any): Promise<void> {
  const modalId = interaction.customId;

  console.log('[Discord Interactions] Modal submit:', modalId);

  // Modal handlers will be implemented for custom inputs
  // Examples: voice_search_modal, voice_filter_modal, etc.

  await interaction.reply({
    content: `Form submitted: ${modalId}`,
    ephemeral: true
  });
}
