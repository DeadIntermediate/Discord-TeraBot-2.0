import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('gamehelp')
  .setDescription('Show information about the Game Lookup System')
  .addSubcommand(subcommand =>
    subcommand
      .setName('features')
      .setDescription('Display all game lookup features and commands')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Show setup instructions for game lookup system')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('examples')
      .setDescription('Show example game lookup commands and outputs')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'features':
      return await showFeatures(interaction);
    case 'setup':
      return await showSetup(interaction);
    case 'examples':
      return await showExamples(interaction);
    default:
      return await interaction.reply({
        content: '❌ Unknown subcommand!',
        flags: MessageFlags.Ephemeral
      });
  }
}

async function showFeatures(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('🎮 Game Lookup System - Features')
    .setDescription('**A comprehensive game database lookup system with rich information display**')
    .setThumbnail('https://cdn.discordapp.com/attachments/123456789/gamecontroller.png') // You can replace with actual game icon
    .addFields(
      {
        name: '🔍 **Game Search** - `/game search <query>`',
        value: '• Smart search with interactive selection menus\n• Multiple results handling with dropdown\n• Fuzzy matching for partial game names\n• Real-time game discovery',
        inline: false
      },
      {
        name: '📊 **Detailed Game Info** - `/game info <game>`',
        value: '• Game title, release date, ratings\n• Platforms, genres, developers\n• ESRB rating, average playtime\n• Rich descriptions & screenshot carousel\n• Direct links to stores and websites',
        inline: false
      },
      {
        name: '🎲 **Game Discovery** - `/game random [count]`',
        value: '• Discover random popular games\n• Adjustable count (1-5 games)\n• High-quality recommendations\n• Perfect for finding new favorites',
        inline: true
      },
      {
        name: '🔥 **Trending Games** - `/game trending [count]`',
        value: '• Recent releases with high ratings\n• Current year + last year games\n• Up to 10 trending titles\n• Stay updated with gaming trends',
        inline: true
      },
      {
        name: '💾 **Smart Features**',
        value: '• **Caching System**: Optimized API usage\n• **Multi-API Support**: RAWG, IGDB, Steam\n• **Interactive Embeds**: Rich visual display\n• **Database Integration**: Favorites & recommendations',
        inline: false
      },
      {
        name: '📈 **Data Sources**',
        value: '**🟢 RAWG API**: 850,000+ games (Primary)\n**🟡 IGDB API**: Enhanced metadata (Ready)\n**🔵 Steam API**: Store integration (Planned)',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Use /gamehelp setup to see installation instructions • Use /gamehelp examples for usage examples',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/info.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('gamehelp_setup')
        .setLabel('Setup Guide')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔧'),
      new ButtonBuilder()
        .setCustomId('gamehelp_examples')
        .setLabel('View Examples')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setURL('https://rawg.io/apidocs')
        .setLabel('Get RAWG API Key')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔑')
    );

  await interaction.reply({
    embeds: [embed],
    components: [buttons]
  });

  // Handle button interactions
  const filter = (i: any) => i.user.id === interaction.user.id;
  const collector = interaction.channel?.createMessageComponentCollector({
    filter,
    time: 300000 // 5 minutes
  });

  collector?.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'gamehelp_setup') {
      await buttonInteraction.deferUpdate();
      await showSetup(interaction, true);
    } else if (buttonInteraction.customId === 'gamehelp_examples') {
      await buttonInteraction.deferUpdate();
      await showExamples(interaction, true);
    }
  });
}

async function showSetup(interaction: ChatInputCommandInteraction, isUpdate: boolean = false) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle('🔧 Game Lookup System - Setup Guide')
    .setDescription('**Follow these steps to set up the game lookup system**')
    .addFields(
      {
        name: '📦 **Step 1: Install Dependencies**',
        value: '```bash\nnpm install axios node-cache\n```\n**Required packages for HTTP requests and caching**',
        inline: false
      },
      {
        name: '🔑 **Step 2: Get RAWG API Key (Free)**',
        value: '1. Visit [RAWG API Docs](https://rawg.io/apidocs)\n2. Create a free account\n3. Copy your API key\n4. Add to `.env` file:\n```env\nRAWG_API_KEY=your_key_here\n```',
        inline: false
      },
      {
        name: '🗄️ **Step 3: Database Migration**',
        value: '```bash\nnpm run db:push\n```\n**Adds game tables: cache, favorites, recommendations**',
        inline: false
      },
      {
        name: '⚡ **Step 4: Optional APIs**',
        value: '**IGDB API (Enhanced Data):**\n```env\nIGDB_CLIENT_ID=your_client_id\nIGDB_CLIENT_SECRET=your_secret\n```\n\n**Get at**: [Twitch Dev Console](https://dev.twitch.tv/console/apps)',
        inline: false
      },
      {
        name: '✅ **Step 5: Test Commands**',
        value: '```\n/game search witcher\n/game info minecraft\n/game random count:3\n/game trending\n```',
        inline: false
      },
      {
        name: '🚨 **Troubleshooting**',
        value: '• **No results**: Check API key is valid\n• **Slow responses**: Normal for first request (then cached)\n• **Missing screenshots**: Not all games have images\n• **Rate limits**: 20,000 requests/month (RAWG free tier)',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Need help? Check the full documentation in GAME_LOOKUP_SYSTEM.md',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/setup.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('gamehelp_features')
        .setLabel('Back to Features')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔙'),
      new ButtonBuilder()
        .setURL('https://rawg.io/apidocs')
        .setLabel('Get RAWG API Key')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔑'),
      new ButtonBuilder()
        .setURL('https://dev.twitch.tv/console/apps')
        .setLabel('Get IGDB API Key')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🎮')
    );

  if (isUpdate) {
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });
  }
}

async function showExamples(interaction: ChatInputCommandInteraction, isUpdate: boolean = false) {
  const embed = new EmbedBuilder()
    .setColor(0x7B68EE)
    .setTitle('📝 Game Lookup System - Usage Examples')
    .setDescription('**See how the game lookup commands work in action**')
    .addFields(
      {
        name: '🔍 **Example: Search for a Game**',
        value: '**Command:** `/game search witcher`\n\n**Result:**\n```\n🔍 Search Results for "witcher"\nFound 25 games. Select one below:\n\n1. The Witcher 3: Wild Hunt\n   Released: 2015-05-19 • Rating: 4.6/5\n   Platforms: PC, PS4, PS5, Xbox...\n\n[Dropdown menu appears for selection]\n```',
        inline: false
      },
      {
        name: '📊 **Example: Detailed Game Info**',
        value: '**Command:** `/game info cyberpunk 2077`\n\n**Result:** *Rich embed with:*\n• 🎮 **Cyberpunk 2077** (with official link)\n• ⭐ **Rating:** 4.1/5 • 📊 **Metacritic:** 86/100\n• 📅 **Released:** December 10, 2020\n• 🎯 **Genres:** Action, RPG, Sci-Fi\n• 🎮 **Platforms:** PC, PS4, PS5, Xbox One, Xbox Series X/S\n• 📸 Screenshot carousel with navigation\n• 🛒 Store purchase links',
        inline: false
      },
      {
        name: '🎲 **Example: Random Discovery**',
        value: '**Command:** `/game random count:3`\n\n**Result:**\n```\n🎲 Random Games\n\n1. Red Dead Redemption 2\n   📅 2018-10-26 • ⭐ 4.6/5\n   🎮 PC, PlayStation, Xbox\n\n2. God of War (2018)\n   📅 2018-04-20 • ⭐ 4.5/5\n   🎮 PC, PlayStation\n\n3. Portal 2\n   📅 2011-04-19 • ⭐ 4.6/5\n   🎮 PC, PlayStation, Xbox\n```',
        inline: false
      },
      {
        name: '🔥 **Example: Trending Games**',
        value: '**Command:** `/game trending count:5`\n\n**Result:**\n```\n🔥 Trending Games\n\n1. Baldur\'s Gate 3\n   📅 2023-08-03 • ⭐ 4.7/5\n   🎮 PC, PlayStation 5, Xbox Series X/S\n\n2. Elden Ring\n   📅 2022-02-25 • ⭐ 4.5/5\n   🎮 PC, PS4, PS5, Xbox One, Xbox Series X/S\n\n[... and 3 more trending games]\n```',
        inline: false
      },
      {
        name: '🎨 **Interactive Features**',
        value: '• **Screenshot Carousel**: Navigate with ⬅️ ➡️ buttons\n• **Selection Menus**: Choose from multiple search results\n• **External Links**: Direct access to websites and stores\n• **Auto-timeout**: Interactions expire after 5 minutes\n• **Color-coded Ratings**: Green (excellent) to red (poor)',
        inline: false
      },
      {
        name: '📊 **Data Quality Examples**',
        value: '**The Witcher 3 Shows:**\n• ⭐ Community Rating: 4.6/5\n• 📊 Metacritic Score: 92/100\n• ⏱️ Average Playtime: 51 hours\n• 🏆 Awards and achievements count\n• 🎯 30+ genre tags\n• 🌍 Available in 15+ languages\n• 📈 User reviews and sentiment',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Try these commands in your server! Data from RAWG Video Games Database',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/games.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('gamehelp_features')
        .setLabel('Back to Features')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔙'),
      new ButtonBuilder()
        .setCustomId('gamehelp_setup')
        .setLabel('Setup Guide')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔧'),
      new ButtonBuilder()
        .setURL('https://rawg.io/')
        .setLabel('Visit RAWG Database')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🎮')
    );

  if (isUpdate) {
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });
  }
}