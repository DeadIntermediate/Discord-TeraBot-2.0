import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
  , ButtonInteraction,
  MessageFlags
} from 'discord.js';
import { gameAPI, GameData, GameScreenshot } from '../../utils/gameAPI';

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Look up video game information')
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search for a game by name')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Game name to search for')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('Get detailed information about a specific game')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Game name or ID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('random')
      .setDescription('Get information about random popular games')
      .addIntegerOption(option =>
        option
          .setName('count')
          .setDescription('Number of random games to show (1-5)')
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('trending')
      .setDescription('Show trending games from the past year')
      .addIntegerOption(option =>
        option
          .setName('count')
          .setDescription('Number of trending games to show (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'search':
      return await handleSearch(interaction);
    case 'info':
      return await handleInfo(interaction);
    case 'random':
      return await handleRandom(interaction);
    case 'trending':
      return await handleTrending(interaction);
    default:
      return await interaction.reply({
        content: '❌ Unknown subcommand!',
        flags: MessageFlags.Ephemeral
      });
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);

  try {
    const searchResults = await gameAPI.searchGames(query, 1, 10);

    if (searchResults.count === 0) {
      return await interaction.editReply({
        content: `❌ No games found for "${query}". Try a different search term.`
      });
    }

    if (searchResults.results.length === 1) {
      // If only one result, show detailed info directly
      return await showGameDetails(interaction, searchResults.results[0]);
    }

    // Create selection menu for multiple results
    const options = searchResults.results.slice(0, 10).map((game, index) => 
      new StringSelectMenuOptionBuilder()
        .setLabel(game.name.length > 100 ? game.name.substring(0, 97) + '...' : game.name)
        .setDescription(`${game.released || 'Unknown year'} • Rating: ${gameAPI.formatRating(game.rating, game.rating_top)}`)
        .setValue(game.id.toString())
        .setEmoji('🎮')
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('game_select')
      .setPlaceholder('Choose a game to view details')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🔍 Search Results for "${query}"`)
      .setDescription(`Found ${searchResults.count} games. Select one below to view details.`)
      .addFields(
        await Promise.all(
          searchResults.results.slice(0, 5).map(async (game, index) => {
            // Fetch full details to get platforms
            const fullDetails = await gameAPI.getGameDetails(game.id);
            const platformsStr = fullDetails?.platforms && fullDetails.platforms.length > 0
              ? gameAPI.formatPlatforms(fullDetails.platforms).substring(0, 100)
              : 'Unknown';
            
            return {
              name: `${index + 1}. ${game.name}`,
              value: `**Released:** ${game.released || 'Unknown'}\n**Rating:** ${gameAPI.formatRating(game.rating, game.rating_top)}\n**Platforms:** ${platformsStr}`,
              inline: false
            };
          })
        )
      )
      .setFooter({ text: 'Select a game from the dropdown to view detailed information' });

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    // Handle selection
    try {
      const confirmation = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      const selectedGameId = confirmation.values[0];
      const selectedGame = searchResults.results.find(g => g.id.toString() === selectedGameId);

      if (selectedGame) {
        await confirmation.deferUpdate();
        await showGameDetails(interaction, selectedGame, true);
      }
    } catch (error) {
      // Selection timeout
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu.setDisabled(true));
      
      await interaction.editReply({
        components: [disabledRow]
      });
    }
  } catch (error) {
    console.error('Error in game search:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('RAWG_API_KEY')) {
      await interaction.editReply({
        content: '❌ Game search is not available yet.\n\n**Reason:** The bot admin needs to set up the RAWG API key.\n\n**Admin:** Get a free key at https://rawg.io/apidocs and add it to your `.env` file as `RAWG_API_KEY=your_key`'
      });
    } else {
      await interaction.editReply({
        content: '❌ An error occurred while searching for games. Please try again later.'
      });
    }
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const gameQuery = interaction.options.getString('game', true);

  try {
    // First try to search for the game to get exact match
    const searchResults = await gameAPI.searchGames(gameQuery, 1, 5);
    
    if (searchResults.count === 0) {
      return await interaction.editReply({
        content: `❌ No game found for "${gameQuery}". Try using \`/game search\` first.`
      });
    }

    // Use the first result (most relevant)
    const game = searchResults.results[0];
    await showGameDetails(interaction, game);
  } catch (error) {
    console.error('Error getting game info:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('RAWG_API_KEY')) {
      await interaction.editReply({
        content: '❌ Game info is not available yet.\n\n**Reason:** The bot admin needs to set up the RAWG API key.\n\n**Admin:** Get a free key at https://rawg.io/apidocs and add it to your `.env` file as `RAWG_API_KEY=your_key`'
      });
    } else {
      await interaction.editReply({
        content: '❌ An error occurred while fetching game information. Please try again later.'
      });
    }
  }
}

async function handleRandom(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const count = interaction.options.getInteger('count') || 1;

  try {
    const randomGames = await gameAPI.getRandomGames(count);

    if (randomGames.length === 0) {
      return await interaction.editReply({
        content: '❌ Unable to fetch random games. Please try again later.'
      });
    }

    if (count === 1) {
      await showGameDetails(interaction, randomGames[0]);
    } else {
      await showGameList(interaction, randomGames, '🎲 Random Games');
    }
  } catch (error) {
    console.error('Error getting random games:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('RAWG_API_KEY')) {
      await interaction.editReply({
        content: '❌ Random games feature is not available yet.\n\n**Reason:** The bot admin needs to set up the RAWG API key.\n\n**Admin:** Get a free key at https://rawg.io/apidocs and add it to your `.env` file as `RAWG_API_KEY=your_key`'
      });
    } else {
      await interaction.editReply({
        content: '❌ An error occurred while fetching random games. Please try again later.'
      });
    }
  }
}

async function handleTrending(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const count = interaction.options.getInteger('count') || 5;

  try {
    const trendingGames = await gameAPI.getTrendingGames(count);

    if (trendingGames.length === 0) {
      return await interaction.editReply({
        content: '❌ Unable to fetch trending games. Please try again later.'
      });
    }

    await showGameList(interaction, trendingGames, '🔥 Trending Games');
  } catch (error) {
    console.error('Error getting trending games:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('RAWG_API_KEY')) {
      await interaction.editReply({
        content: '❌ Trending games feature is not available yet.\n\n**Reason:** The bot admin needs to set up the RAWG API key.\n\n**Admin:** Get a free key at https://rawg.io/apidocs and add it to your `.env` file as `RAWG_API_KEY=your_key`'
      });
    } else {
      await interaction.editReply({
        content: '❌ An error occurred while fetching trending games. Please try again later.'
      });
    }
  }
}

async function showGameDetails(interaction: ChatInputCommandInteraction, game: GameData, isUpdate: boolean = false) {
  try {
    // Get additional details and screenshots
    const [detailedGame, screenshots] = await Promise.all([
      gameAPI.getGameDetails(game.id),
      gameAPI.getGameScreenshots(game.id)
    ]);

    const gameInfo = detailedGame || game;

    const embed = new EmbedBuilder()
      .setColor(gameAPI.getRatingColor(gameInfo.rating))
      .setTitle(`🎮 ${gameInfo.name}`)
      .setURL(gameInfo.website || `https://rawg.io/games/${gameInfo.slug}`)
      .setTimestamp();

    // Add thumbnail
    if (gameInfo.background_image) {
      embed.setThumbnail(gameInfo.background_image);
    }

    // Basic information
    const basicInfo: string[] = [];
    if (gameInfo.released) {
      basicInfo.push(`**📅 Released:** ${gameInfo.released}`);
    }
    if (gameInfo.rating) {
      basicInfo.push(`**⭐ Rating:** ${gameAPI.formatRating(gameInfo.rating, gameInfo.rating_top)}`);
    }
    if (gameInfo.metacritic) {
      basicInfo.push(`**📊 Metacritic:** ${gameInfo.metacritic}/100`);
    }
    if (gameInfo.esrb_rating) {
      basicInfo.push(`**🔞 ESRB:** ${gameInfo.esrb_rating}`);
    }

    if (basicInfo.length > 0) {
      embed.addFields({ name: 'Basic Information', value: basicInfo.join('\n'), inline: true });
    }

    // Platforms
    if (gameInfo.platforms && gameInfo.platforms.length > 0) {
      const platforms = gameAPI.formatPlatforms(gameInfo.platforms);
      embed.addFields({ name: '🎮 Platforms', value: platforms, inline: true });
    }

    // Genres and developers
    const gameDetails: string[] = [];
    if (gameInfo.genres && (gameInfo.genres as any[]).length > 0) {
      gameDetails.push(`**🎯 Genres:** ${(gameInfo.genres as any[]).slice(0, 3).map((g: any) => g.name || g).join(', ')}`);
    }
    if (gameInfo.developers && (gameInfo.developers as any[]).length > 0) {
      gameDetails.push(`**👥 Developers:** ${(gameInfo.developers as any[]).slice(0, 2).map((d: any) => d.name || d).join(', ')}`);
    }
    if (gameInfo.publishers && (gameInfo.publishers as any[]).length > 0) {
      gameDetails.push(`**🏢 Publishers:** ${(gameInfo.publishers as any[]).slice(0, 2).map((p: any) => p.name || p).join(', ')}`);
    }
    if (gameInfo.playtime) {
      gameDetails.push(`**⏱️ Avg. Playtime:** ${gameInfo.playtime} hours`);
    }

    if (gameDetails.length > 0) {
      embed.addFields({ name: 'Game Details', value: gameDetails.join('\n'), inline: false });
    }

    // Description/Synopsis
    if ((gameInfo as any).description_raw || gameInfo.description || gameInfo.synopsis) {
      const description = (gameInfo as any).description_raw || gameInfo.description || gameInfo.synopsis;
      const truncatedDesc = description.length > 500 
        ? description.substring(0, 497) + '...'
        : description;
      
      // Remove HTML tags
      const cleanDesc = truncatedDesc.replace(/<[^>]*>/g, '');
      embed.setDescription(cleanDesc);
    }

    // Add screenshot if available
    if (screenshots && screenshots.length > 0) {
      embed.setImage(screenshots[0].image);
    }

    // Create buttons for additional actions
    const buttons = [];

    if (screenshots && screenshots.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`screenshots_${game.id}`)
          .setLabel('View Screenshots')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📸')
      );
    }

    if (gameInfo.website) {
      buttons.push(
        new ButtonBuilder()
          .setURL(gameInfo.website)
          .setLabel('Official Website')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🌐')
      );
    }

    if (gameInfo.metacritic_url) {
      buttons.push(
        new ButtonBuilder()
          .setURL(gameInfo.metacritic_url)
          .setLabel('Metacritic')
          .setStyle(ButtonStyle.Link)
          .setEmoji('📊')
      );
    }

    // Add stores/purchase links
    if (gameInfo.stores && gameInfo.stores.length > 0) {
      const store = gameInfo.stores[0];
      if (store.url) {
        buttons.push(
          new ButtonBuilder()
            .setURL(store.url)
            .setLabel(`Get on ${store.name}`)
            .setStyle(ButtonStyle.Link)
            .setEmoji('🛒')
        );
      }
    }

    const components = [];
    if (buttons.length > 0) {
      // Split buttons into rows (max 5 per row)
      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(buttons.slice(i, i + 5));
        components.push(row);
      }
    }

    embed.setFooter({ 
      text: `Data from RAWG Video Games Database • ID: ${game.id}`,
      iconURL: 'https://rawg.io/assets/logo.png'
    });

    if (isUpdate) {
      await interaction.editReply({
        embeds: [embed],
        components
      });
    } else {
      await interaction.editReply({
        embeds: [embed],
        components
      });
    }

    // Handle screenshot button clicks
    if (screenshots && screenshots.length > 1) {
      const filter = (i: any) => i.customId === `screenshots_${game.id}` && i.user.id === interaction.user.id;
      
      const collector = interaction.channel?.createMessageComponentCollector({
        filter,
        time: 300000 // 5 minutes
      });

      collector?.on('collect', async (buttonInteraction: any) => {
        await showGameScreenshots(buttonInteraction as any, gameInfo as any, screenshots as any);
      });
    }
  } catch (error) {
    console.error('Error showing game details:', error);
    const errorMessage = '❌ An error occurred while displaying game details.';
    
    if (isUpdate) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.editReply({ content: errorMessage });
    }
  }
}

async function showGameList(interaction: ChatInputCommandInteraction, games: GameData[], title: string) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(title)
    .setTimestamp();

  const gameList = games.map((game, index) => {
    const rating = gameAPI.formatRating(game.rating, game.rating_top);
    const platforms = gameAPI.formatPlatforms(game.platforms);
    
    return `**${index + 1}. ${game.name}**\n` +
           `📅 ${game.released || 'Unknown'} • ⭐ ${rating}\n` +
           `🎮 ${platforms.substring(0, 50)}${platforms.length > 50 ? '...' : ''}`;
  }).join('\n\n');

  embed.setDescription(gameList);
  embed.setFooter({ text: 'Use /game info <game name> to get detailed information about any game' });

  await interaction.editReply({ embeds: [embed] });
}

async function showGameScreenshots(interaction: any, game: GameData, screenshots: GameScreenshot[]) {
  await interaction.deferUpdate();

  let currentIndex = 0;
  const maxIndex = Math.min(screenshots.length, 10); // Limit to 10 screenshots

  const createScreenshotEmbed = (index: number) => {
    const screenshot = screenshots[index];
    
    return new EmbedBuilder()
      .setColor(gameAPI.getRatingColor(game.rating))
      .setTitle(`📸 ${game.name} - Screenshots`)
      .setImage(screenshot.image)
      .setFooter({ text: `Screenshot ${index + 1} of ${maxIndex}` });
  };

  const createButtons = (index: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    if (index > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('prev_screenshot')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }
    
    if (index < maxIndex - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('next_screenshot')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('close_screenshots')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    return row;
  };

  const response = await interaction.editReply({
    embeds: [createScreenshotEmbed(currentIndex)],
    components: [createButtons(currentIndex)]
  });

  const collector = response.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: '❌ You cannot control this screenshot viewer.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await buttonInteraction.deferUpdate();

    switch (buttonInteraction.customId) {
      case 'prev_screenshot':
        if (currentIndex > 0) currentIndex--;
        break;
      case 'next_screenshot':
        if (currentIndex < maxIndex - 1) currentIndex++;
        break;
      case 'close_screenshots':
        collector.stop();
        return;
    }

    await buttonInteraction.editReply({
      embeds: [createScreenshotEmbed(currentIndex)],
      components: [createButtons(currentIndex)]
    });
  });

  collector.on('end', async () => {
    try {
      const disabledButtons = createButtons(currentIndex);
      disabledButtons.components.forEach(button => button.setDisabled(true));
      
      await interaction.editReply({
        components: [disabledButtons]
      });
    } catch (error) {
      // Ignore errors when disabling buttons (message might be deleted)
    }
  });
}