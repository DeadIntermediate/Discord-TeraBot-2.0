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
  .setName('gamedemo')
  .setDescription('Demo of the Game Lookup System output (example embed)')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type of demo to show')
      .setRequired(false)
      .addChoices(
        { name: 'Game Info Example (The Witcher 3)', value: 'info' },
        { name: 'Search Results Example', value: 'search' },
        { name: 'Random Games Example', value: 'random' },
        { name: 'Trending Games Example', value: 'trending' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const type = interaction.options.getString('type') || 'info';

  switch (type) {
    case 'info':
      return await showGameInfoDemo(interaction);
    case 'search':
      return await showSearchDemo(interaction);
    case 'random':
      return await showRandomDemo(interaction);
    case 'trending':
      return await showTrendingDemo(interaction);
    default:
      return await showGameInfoDemo(interaction);
  }
}

async function showGameInfoDemo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('The Witcher 3: Wild Hunt')
    .setURL('https://thewitcher.com/en/witcher3')
    .setDescription('**A story-driven, next-generation open world role-playing game set in a visually stunning fantasy universe full of meaningful choices and impactful consequences.**')
    .setThumbnail('https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg')
    .setImage('https://media.rawg.io/media/screenshots/1ac/1ac19f31974314855ad7be266adeb500.jpg')
    .addFields(
      {
        name: '⭐ **Rating & Reviews**',
        value: '**Community Rating:** 4.6/5 ⭐⭐⭐⭐⭐\n**Metacritic Score:** 92/100 🏆\n**User Reviews:** 49,231 reviews',
        inline: true
      },
      {
        name: '📅 **Release Information**',
        value: '**Released:** May 19, 2015\n**Developer:** CD Projekt RED\n**Publisher:** CD Projekt\n**ESRB Rating:** M (Mature 17+)',
        inline: true
      },
      {
        name: '🎮 **Platforms Available**',
        value: '• PC (Windows)\n• PlayStation 4 & 5\n• Xbox One & Series X/S\n• Nintendo Switch',
        inline: true
      },
      {
        name: '🎯 **Genres & Tags**',
        value: '`Action` `RPG` `Open World` `Fantasy` `Story Rich` `Single-player` `Third Person` `Medieval` `Atmospheric` `Magic`',
        inline: false
      },
      {
        name: '⏱️ **Gameplay Stats**',
        value: '**Average Playtime:** 51 hours\n**Main Story:** ~25 hours\n**Completionist:** ~173 hours\n**Achievements:** 78 total',
        inline: true
      },
      {
        name: '🛒 **Store Links**',
        value: '[Steam Store](https://store.steampowered.com)\n[GOG Store](https://gog.com)\n[Epic Games](https://epicgames.com)',
        inline: true
      },
      {
        name: '📸 **Media Gallery**',
        value: '🖼️ **Screenshots:** 1 of 15 available\n*Use the navigation buttons below to browse*',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Data provided by RAWG Video Games Database • This is a demo of /game info output',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/rawg.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('screenshot_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️'),
      new ButtonBuilder()
        .setCustomId('screenshot_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️'),
      new ButtonBuilder()
        .setURL('https://thewitcher.com/en/witcher3')
        .setLabel('Official Website')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setCustomId('more_info')
        .setLabel('More Details')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊')
    );

  await interaction.reply({
    content: '🎮 **DEMO:** This is what `/game info the witcher 3` would look like:',
    embeds: [embed],
    components: [buttons]
  });
}

async function showSearchDemo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔍 Game Search Results')
    .setDescription('**Search Query:** "witcher"\n**Results Found:** 25 games\n\nSelect a game from the dropdown menu below:')
    .addFields(
      {
        name: '🎮 **Top Results Preview:**',
        value: '**1.** The Witcher 3: Wild Hunt\n📅 *2015-05-19* • ⭐ *4.6/5* • 🎮 *PC, PS4, PS5, Xbox...*\n\n**2.** The Witcher 2: Assassins of Kings\n📅 *2011-05-17* • ⭐ *4.2/5* • 🎮 *PC, Xbox 360*\n\n**3.** The Witcher\n📅 *2007-10-26* • ⭐ *4.1/5* • 🎮 *PC*\n\n**4.** The Witcher 3: Wild Hunt - Game of the Year Edition\n📅 *2016-08-30* • ⭐ *4.7/5* • 🎮 *PC, PS4, Xbox One*\n\n**5.** The Witcher: Enhanced Edition\n📅 *2008-09-16* • ⭐ *4.0/5* • 🎮 *PC*',
        inline: false
      },
      {
        name: '📝 **How to Use:**',
        value: '• Select a game from the dropdown menu\n• Click to get detailed information\n• Browse screenshots and links\n• Discover similar games',
        inline: false
      }
    )
    .setFooter({ 
      text: 'This is a demo of /game search output • Menu selection expires in 5 minutes',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/search.png'
    })
    .setTimestamp();

  // Note: In the real implementation, this would be a SelectMenuBuilder
  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('select_witcher3')
        .setLabel('The Witcher 3: Wild Hunt')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('select_witcher2')
        .setLabel('The Witcher 2')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId('show_all')
        .setLabel('Show All 25 Results')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('new_search')
        .setLabel('New Search')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍')
    );

  await interaction.reply({
    content: '🔍 **DEMO:** This is what `/game search witcher` would look like:',
    embeds: [embed],
    components: [buttons]
  });
}

async function showRandomDemo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎲 Random Game Discovery')
    .setDescription('**Discovered 3 highly-rated games for you to explore!**')
    .addFields(
      {
        name: '🎮 **1. Red Dead Redemption 2**',
        value: '📅 **Released:** October 26, 2018\n⭐ **Rating:** 4.6/5 • 📊 **Metacritic:** 97/100\n🎯 **Genres:** Action, Adventure, Western\n🎮 **Platforms:** PC, PlayStation 4 & 5, Xbox One & Series X/S\n💬 **Summary:** An epic tale of life in America\'s unforgiving heartland...',
        inline: false
      },
      {
        name: '🎮 **2. God of War (2018)**',
        value: '📅 **Released:** April 20, 2018\n⭐ **Rating:** 4.5/5 • 📊 **Metacritic:** 94/100\n🎯 **Genres:** Action, Adventure, Mythology\n🎮 **Platforms:** PC, PlayStation 4 & 5\n💬 **Summary:** Living as a man outside the shadow of the gods...',
        inline: false
      },
      {
        name: '🎮 **3. Portal 2**',
        value: '📅 **Released:** April 19, 2011\n⭐ **Rating:** 4.6/5 • 📊 **Metacritic:** 95/100\n🎯 **Genres:** Puzzle, Sci-Fi, First-Person\n🎮 **Platforms:** PC, PlayStation 3, Xbox 360, Mac, Linux\n💬 **Summary:** The sequel to the acclaimed Portal...',
        inline: false
      },
      {
        name: '🎯 **Discovery Tips**',
        value: '• Use `/game info [game name]` for detailed information\n• Try `/game random count:5` for more discoveries\n• Save favorites with future features\n• All games shown have ratings 4.0+ ⭐',
        inline: false
      }
    )
    .setFooter({ 
      text: 'This is a demo of /game random count:3 output • Refresh for new discoveries!',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/dice.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('info_rdr2')
        .setLabel('Red Dead 2 Info')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🤠'),
      new ButtonBuilder()
        .setCustomId('info_gow')
        .setLabel('God of War Info')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️'),
      new ButtonBuilder()
        .setCustomId('info_portal2')
        .setLabel('Portal 2 Info')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🧪'),
      new ButtonBuilder()
        .setCustomId('random_again')
        .setLabel('Discover More')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎲')
    );

  await interaction.reply({
    content: '🎲 **DEMO:** This is what `/game random count:3` would look like:',
    embeds: [embed],
    components: [buttons]
  });
}

async function showTrendingDemo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xFF4500)
    .setTitle('🔥 Trending Games')
    .setDescription('**Popular games released in 2024-2025 with high ratings**')
    .addFields(
      {
        name: '🏆 **#1 - Baldur\'s Gate 3**',
        value: '📅 **Released:** August 3, 2023\n⭐ **Rating:** 4.7/5 • 📊 **Metacritic:** 96/100\n🎮 **Platforms:** PC, PlayStation 5, Xbox Series X/S\n🔥 **Trending:** #1 RPG of the year',
        inline: false
      },
      {
        name: '🏆 **#2 - Elden Ring**',
        value: '📅 **Released:** February 25, 2022\n⭐ **Rating:** 4.5/5 • 📊 **Metacritic:** 96/100\n🎮 **Platforms:** PC, PS4, PS5, Xbox One, Xbox Series X/S\n🔥 **Trending:** FromSoftware masterpiece',
        inline: false
      },
      {
        name: '🏆 **#3 - Hades II (Early Access)**',
        value: '📅 **Released:** May 6, 2024\n⭐ **Rating:** 4.4/5 • 📊 **Steam:** 98% Positive\n🎮 **Platforms:** PC (Early Access)\n🔥 **Trending:** Supergiant Games sequel',
        inline: false
      },
      {
        name: '🏆 **#4 - Palworld**',
        value: '📅 **Released:** January 19, 2024\n⭐ **Rating:** 4.2/5 • 📊 **Steam:** 94% Positive\n🎮 **Platforms:** PC, Xbox One, Xbox Series X/S\n🔥 **Trending:** Viral sensation',
        inline: false
      },
      {
        name: '🏆 **#5 - Helldivers 2**',
        value: '📅 **Released:** February 8, 2024\n⭐ **Rating:** 4.3/5 • 📊 **Steam:** 91% Positive\n🎮 **Platforms:** PC, PlayStation 5\n🔥 **Trending:** Co-op shooter hit',
        inline: false
      },
      {
        name: '📈 **Trending Metrics**',
        value: '• **Rating Filter:** 4.0+ stars only\n• **Recency:** Released within 2 years\n• **Popularity:** High user engagement\n• **Reviews:** Thousands of positive reviews',
        inline: false
      }
    )
    .setFooter({ 
      text: 'This is a demo of /game trending count:5 output • Updated based on current gaming trends',
      iconURL: 'https://cdn.discordapp.com/attachments/123456789/trending.png'
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('trending_bg3')
        .setLabel('Baldur\'s Gate 3 Info')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🐉'),
      new ButtonBuilder()
        .setCustomId('trending_elden')
        .setLabel('Elden Ring Info')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💍'),
      new ButtonBuilder()
        .setCustomId('view_top10')
        .setLabel('View Top 10')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('refresh_trending')
        .setLabel('Refresh List')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );

  await interaction.reply({
    content: '🔥 **DEMO:** This is what `/game trending count:5` would look like:',
    embeds: [embed],
    components: [buttons]
  });
}