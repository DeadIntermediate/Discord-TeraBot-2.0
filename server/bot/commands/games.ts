import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonInteraction,
} from 'discord.js';
import { gameAPI, GameData, GameScreenshot } from '../../utils/gameAPI';
import { error as logError } from '../../utils/logger';

// ── Genre choices ─────────────────────────────────────────────────────────────
const GENRE_CHOICES = [
  { name: 'Action',      value: 'action' },
  { name: 'Adventure',   value: 'adventure' },
  { name: 'RPG',         value: 'role-playing-games-rpg' },
  { name: 'Strategy',    value: 'strategy' },
  { name: 'Shooter',     value: 'shooter' },
  { name: 'Puzzle',      value: 'puzzle' },
  { name: 'Racing',      value: 'racing' },
  { name: 'Sports',      value: 'sports' },
  { name: 'Simulation',  value: 'simulation' },
  { name: 'Indie',       value: 'indie' },
  { name: 'Platformer',  value: 'platformer' },
  { name: 'Fighting',    value: 'fighting' },
] as const;

// ── Platform choices (RAWG parent_platform IDs) ───────────────────────────────
const PLATFORM_CHOICES = [
  { name: 'PC',          value: '1' },
  { name: 'PlayStation', value: '2' },
  { name: 'Xbox',        value: '3' },
  { name: 'iOS',         value: '4' },
  { name: 'Android',     value: '8' },
  { name: 'Mac',         value: '5' },
  { name: 'Linux',       value: '6' },
  { name: 'Nintendo',    value: '7' },
] as const;

// ── Command definition ────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Look up video game information')
  // /game search
  .addSubcommand(sub =>
    sub.setName('search').setDescription('Search for a game by name')
      .addStringOption(o => o.setName('query').setDescription('Game name to search for').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('genre').setDescription('Filter by genre').setRequired(false).addChoices(...GENRE_CHOICES))
      .addStringOption(o => o.setName('platform').setDescription('Filter by platform').setRequired(false).addChoices(...PLATFORM_CHOICES))
  )
  // /game info
  .addSubcommand(sub =>
    sub.setName('info').setDescription('Get detailed information about a game')
      .addStringOption(o => o.setName('game').setDescription('Game name').setRequired(true).setAutocomplete(true))
  )
  // /game compare
  .addSubcommand(sub =>
    sub.setName('compare').setDescription('Compare two games side by side')
      .addStringOption(o => o.setName('game1').setDescription('First game').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('game2').setDescription('Second game').setRequired(true).setAutocomplete(true))
  )
  // /game top
  .addSubcommand(sub =>
    sub.setName('top').setDescription('Show top-rated games')
      .addIntegerOption(o => o.setName('count').setDescription('Number of games (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
      .addStringOption(o => o.setName('genre').setDescription('Filter by genre').setRequired(false).addChoices(...GENRE_CHOICES))
      .addStringOption(o => o.setName('platform').setDescription('Filter by platform').setRequired(false).addChoices(...PLATFORM_CHOICES))
      .addIntegerOption(o => o.setName('year').setDescription('Filter by release year').setMinValue(1970).setMaxValue(new Date().getFullYear()).setRequired(false))
  )
  // /game similar
  .addSubcommand(sub =>
    sub.setName('similar').setDescription('Find games similar to a game you like')
      .addStringOption(o => o.setName('game').setDescription('Game name').setRequired(true).setAutocomplete(true))
  )
  // /game new
  .addSubcommand(sub =>
    sub.setName('new').setDescription('Show recent game releases (last 30 days)')
      .addIntegerOption(o => o.setName('count').setDescription('Number of games (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
  )
  // /game trending
  .addSubcommand(sub =>
    sub.setName('trending').setDescription('Show trending games from the past year')
      .addIntegerOption(o => o.setName('count').setDescription('Number of games (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
      .addStringOption(o => o.setName('genre').setDescription('Filter by genre').setRequired(false).addChoices(...GENRE_CHOICES))
  )
  // /game random
  .addSubcommand(sub =>
    sub.setName('random').setDescription('Discover a random popular game')
  );

// ── Autocomplete ──────────────────────────────────────────────────────────────

export async function handleGameAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  const query = focused.value.trim();
  if (query.length < 2) {
    await interaction.respond([]);
    return;
  }
  try {
    const results = await gameAPI.searchAutocomplete(query);
    await interaction.respond(
      results.slice(0, 25).map(g => ({ name: g.name.slice(0, 100), value: g.name }))
    );
  } catch {
    await interaction.respond([]);
  }
}

// ── Main execute ──────────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  if (gameAPI.missingApiKey) {
    await interaction.reply({
      content: '❌ The RAWG API key is not configured. Ask the bot owner to add `RAWG_API_KEY` to `.env`.',
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'search':   return handleSearch(interaction);
    case 'info':     return handleInfo(interaction);
    case 'compare':  return handleCompare(interaction);
    case 'top':      return handleTop(interaction);
    case 'similar':  return handleSimilar(interaction);
    case 'new':      return handleNew(interaction);
    case 'trending': return handleTrending(interaction);
    case 'random':   return handleRandom(interaction);
    default:
      await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
  }
}

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleSearch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const query    = interaction.options.getString('query', true);
  const genre    = interaction.options.getString('genre') ?? undefined;
  const platform = interaction.options.getString('platform') ?? undefined;

  try {
    const result = await gameAPI.searchGames(query, 1, 10, {
      genre,
      parentPlatform: platform ? Number(platform) : undefined,
    });

    if (result.count === 0) {
      await interaction.editReply({ content: `❌ No games found for **${query}**.` });
      return;
    }

    // Single result — jump straight to details
    if (result.results.length === 1) {
      await showGameDetails(interaction, result.results[0]);
      return;
    }

    // Multiple results — dropdown picker
    const options = result.results.slice(0, 10).map(g =>
      new StringSelectMenuOptionBuilder()
        .setLabel(g.name.slice(0, 100))
        .setDescription(`${g.released ?? 'Unknown'} • Rating: ${gameAPI.formatRating(g.rating, g.rating_top)}`)
        .setValue(g.id.toString())
        .setEmoji('🎮')
    );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('game_select')
      .setPlaceholder('Choose a game to view details')
      .addOptions(options);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🔍 Search Results: "${query}"`)
      .setDescription(`Found **${result.count}** games. Select one below to view details.`)
      .addFields(
        result.results.slice(0, 5).map((g, i) => ({
          name: `${i + 1}. ${g.name}`,
          value: `Released: ${g.released ?? 'Unknown'} • Rating: ${gameAPI.formatRating(g.rating, g.rating_top)}`,
          inline: false,
        }))
      )
      .setFooter({ text: 'Select a game from the dropdown below' });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    try {
      const sel = await msg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 60_000,
      });
      const chosen = result.results.find(g => g.id.toString() === sel.values[0]);
      if (chosen) {
        await sel.deferUpdate();
        await showGameDetails(interaction, chosen);
      }
    } catch {
      // Timeout — disable menu
      await interaction.editReply({ components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu.setDisabled(true))] });
    }
  } catch (err) {
    logError('Error in /game search:', err);
    await interaction.editReply({ content: '❌ An error occurred while searching. Please try again.' });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const query = interaction.options.getString('game', true);

  try {
    const result = await gameAPI.searchGames(query, 1, 1);
    if (result.count === 0 || !result.results[0]) {
      await interaction.editReply({ content: `❌ No game found for **${query}**.` });
      return;
    }
    await showGameDetails(interaction, result.results[0]);
  } catch (err) {
    logError('Error in /game info:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching game info.' });
  }
}

async function handleCompare(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const q1 = interaction.options.getString('game1', true);
  const q2 = interaction.options.getString('game2', true);

  try {
    const [r1, r2] = await Promise.all([
      gameAPI.searchGames(q1, 1, 1),
      gameAPI.searchGames(q2, 1, 1),
    ]);

    const g1 = r1.results[0];
    const g2 = r2.results[0];

    if (!g1 && !g2) {
      await interaction.editReply({ content: '❌ Neither game was found.' });
      return;
    }
    if (!g1) { await interaction.editReply({ content: `❌ Could not find **${q1}**.` }); return; }
    if (!g2) { await interaction.editReply({ content: `❌ Could not find **${q2}**.` }); return; }

    const [d1, d2] = await Promise.all([
      gameAPI.getGameDetails(g1.id),
      gameAPI.getGameDetails(g2.id),
    ]);

    const a = d1 ?? g1;
    const b = d2 ?? g2;

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('⚔️ Game Comparison')
      .setTimestamp()
      .setFooter({ text: 'Data from RAWG Video Games Database' });

    const row = (label: string, va: string | undefined, vb: string | undefined) =>
      `**${label}**\n${va ?? '—'} vs ${vb ?? '—'}`;

    embed.addFields(
      {
        name: `🎮 ${a.name}`,
        value: [
          `Released: ${a.released ?? '—'}`,
          `Rating: ${gameAPI.formatRating(a.rating, a.rating_top)}`,
          `Metacritic: ${a.metacritic ? `${a.metacritic}/100` : '—'}`,
          `Genres: ${a.genres?.slice(0, 3).map(g => g.name).join(', ') ?? '—'}`,
          `Playtime: ${a.playtime ? `~${a.playtime}h` : '—'}`,
          `ESRB: ${gameAPI.formatESRB(a.esrb_rating)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: `🎮 ${b.name}`,
        value: [
          `Released: ${b.released ?? '—'}`,
          `Rating: ${gameAPI.formatRating(b.rating, b.rating_top)}`,
          `Metacritic: ${b.metacritic ? `${b.metacritic}/100` : '—'}`,
          `Genres: ${b.genres?.slice(0, 3).map(g => g.name).join(', ') ?? '—'}`,
          `Playtime: ${b.playtime ? `~${b.playtime}h` : '—'}`,
          `ESRB: ${gameAPI.formatESRB(b.esrb_rating)}`,
        ].join('\n'),
        inline: true,
      }
    );

    // Verdict
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    let verdict = '🤝 Both games are equally rated!';
    if (ratingA > ratingB) verdict = `🏆 **${a.name}** has the higher rating (${ratingA.toFixed(1)} vs ${ratingB.toFixed(1)})`;
    else if (ratingB > ratingA) verdict = `🏆 **${b.name}** has the higher rating (${ratingB.toFixed(1)} vs ${ratingA.toFixed(1)})`;
    embed.addFields({ name: '📊 Verdict', value: verdict, inline: false });

    if (a.background_image) embed.setThumbnail(a.background_image);
    if (b.background_image) embed.setImage(b.background_image);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logError('Error in /game compare:', err);
    await interaction.editReply({ content: '❌ An error occurred while comparing games.' });
  }
}

async function handleTop(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const count    = interaction.options.getInteger('count') ?? 5;
  const genre    = interaction.options.getString('genre') ?? undefined;
  const platform = interaction.options.getString('platform') ?? undefined;
  const year     = interaction.options.getInteger('year') ?? undefined;

  try {
    const games = await gameAPI.getTopGames(count, {
      genre,
      parentPlatform: platform ? Number(platform) : undefined,
      year,
    });
    if (!games.length) {
      await interaction.editReply({ content: '❌ No games found with those filters.' });
      return;
    }
    const subtitle = [genre, platform ? PLATFORM_CHOICES.find(p => p.value === platform)?.name : null, year].filter(Boolean).join(' • ');
    await showGameList(interaction, games, `🏆 Top Games${subtitle ? ` — ${subtitle}` : ''}`);
  } catch (err) {
    logError('Error in /game top:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching top games.' });
  }
}

async function handleSimilar(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const query = interaction.options.getString('game', true);

  try {
    const result = await gameAPI.searchGames(query, 1, 1);
    if (!result.results[0]) {
      await interaction.editReply({ content: `❌ No game found for **${query}**.` });
      return;
    }
    const base    = result.results[0];
    const similar = await gameAPI.getSuggestedGames(base.id, 6);
    if (!similar.length) {
      await interaction.editReply({ content: `❌ No similar games found for **${base.name}**.` });
      return;
    }
    await showGameList(interaction, similar, `🔗 Games Similar to ${base.name}`);
  } catch (err) {
    logError('Error in /game similar:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching similar games.' });
  }
}

async function handleNew(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const count = interaction.options.getInteger('count') ?? 5;

  try {
    const games = await gameAPI.getNewReleases(count);
    if (!games.length) {
      await interaction.editReply({ content: '❌ No new releases found.' });
      return;
    }
    await showGameList(interaction, games, '🆕 Recent Releases');
  } catch (err) {
    logError('Error in /game new:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching new releases.' });
  }
}

async function handleTrending(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const count = interaction.options.getInteger('count') ?? 5;
  const genre = interaction.options.getString('genre') ?? undefined;

  try {
    const games = await gameAPI.getTrendingGames(count, genre);
    if (!games.length) {
      await interaction.editReply({ content: '❌ No trending games found.' });
      return;
    }
    await showGameList(interaction, games, `🔥 Trending Games${genre ? ` — ${genre}` : ''}`);
  } catch (err) {
    logError('Error in /game trending:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching trending games.' });
  }
}

async function handleRandom(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    const games = await gameAPI.getRandomGames(1);
    if (!games.length) {
      await interaction.editReply({ content: '❌ Unable to fetch a random game. Please try again.' });
      return;
    }
    await showGameDetails(interaction, games[0]);
  } catch (err) {
    logError('Error in /game random:', err);
    await interaction.editReply({ content: '❌ An error occurred while fetching a random game.' });
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

async function showGameDetails(interaction: ChatInputCommandInteraction, game: GameData) {
  try {
    const [detailed, screenshots] = await Promise.all([
      gameAPI.getGameDetails(game.id),
      gameAPI.getGameScreenshots(game.id),
    ]);
    const g = detailed ?? game;

    // Strip HTML tags from description
    const rawDesc: string = (g as any).description_raw ?? g.description ?? g.synopsis ?? '';
    const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

    const embed = new EmbedBuilder()
      .setColor(gameAPI.getRatingColor(g.rating))
      .setTitle(`🎮 ${g.name}`)
      .setURL(g.website ?? `https://rawg.io/games/${g.slug}`)
      .setTimestamp()
      .setFooter({ text: `Data from RAWG Video Games Database • ID: ${g.id}` });

    if (g.background_image) embed.setThumbnail(g.background_image);
    if (screenshots.length > 0) embed.setImage(screenshots[0].image);
    if (cleanDesc) embed.setDescription(cleanDesc.length > 500 ? cleanDesc.slice(0, 497) + '…' : cleanDesc);

    // Stats column
    const stats: string[] = [];
    if (g.released)    stats.push(`📅 **Released:** ${g.released}`);
    if (g.rating)      stats.push(`⭐ **Rating:** ${gameAPI.formatRating(g.rating, g.rating_top)}`);
    if (g.metacritic)  stats.push(`📊 **Metacritic:** ${g.metacritic}/100`);
    if (g.playtime)    stats.push(`⏱️ **Avg. Playtime:** ~${g.playtime}h`);
    stats.push(`🔞 **ESRB:** ${gameAPI.formatESRB(g.esrb_rating)}`);
    if (stats.length) embed.addFields({ name: '📋 Info', value: stats.join('\n'), inline: true });

    // Platforms column
    if (g.platforms?.length) {
      embed.addFields({ name: '🖥️ Platforms', value: gameAPI.formatPlatformsWithEmojis(g.platforms), inline: true });
    }

    // Extra details
    const extras: string[] = [];
    if (g.genres?.length)     extras.push(`**Genres:** ${g.genres.slice(0, 4).map(x => x.name).join(', ')}`);
    if (g.developers?.length) extras.push(`**Developers:** ${g.developers.slice(0, 2).map(x => x.name).join(', ')}`);
    if (g.publishers?.length) extras.push(`**Publishers:** ${g.publishers.slice(0, 2).map(x => x.name).join(', ')}`);
    if (g.tags?.length)       extras.push(`**Tags:** ${g.tags.slice(0, 5).map(x => x.name).join(', ')}`);
    if (extras.length) embed.addFields({ name: '🔍 Details', value: extras.join('\n'), inline: false });

    // Buttons
    const buttons: ButtonBuilder[] = [];
    if (screenshots.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`game_ss_${g.id}`)
          .setLabel(`Screenshots (${Math.min(screenshots.length, 10)})`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📸')
      );
    }
    if (g.website) {
      buttons.push(
        new ButtonBuilder().setURL(g.website).setLabel('Official Site').setStyle(ButtonStyle.Link).setEmoji('🌐')
      );
    }
    if (g.metacritic_url) {
      buttons.push(
        new ButtonBuilder().setURL(g.metacritic_url).setLabel('Metacritic').setStyle(ButtonStyle.Link).setEmoji('📊')
      );
    }
    if (g.stores?.length) {
      const store = g.stores.find(s => s.url);
      if (store?.url) {
        buttons.push(
          new ButtonBuilder().setURL(store.url).setLabel(`Buy on ${store.name}`).setStyle(ButtonStyle.Link).setEmoji('🛒')
        );
      }
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
    }

    const msg = await interaction.editReply({ embeds: [embed], components });

    // Screenshot viewer
    if (screenshots.length > 1) {
      const filter = (i: any) => i.customId === `game_ss_${g.id}` && i.user.id === interaction.user.id;
      const collector = interaction.channel?.createMessageComponentCollector({ filter, time: 60_000, max: 1 });
      collector?.on('collect', async (btn: any) => {
        await showScreenshots(btn, g, screenshots);
      });
    }
  } catch (err) {
    logError('Error showing game details:', err);
    await interaction.editReply({ content: '❌ An error occurred while displaying game details.' });
  }
}

async function showGameList(interaction: ChatInputCommandInteraction, games: GameData[], title: string) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(title)
    .setTimestamp()
    .setFooter({ text: 'Use /game info <name> for detailed information • Data from RAWG' });

  const lines = games.map((g, i) => {
    const rating    = gameAPI.formatRating(g.rating, g.rating_top);
    const platforms = gameAPI.formatPlatforms(g.platforms);
    const trunc     = platforms.length > 60 ? platforms.slice(0, 57) + '…' : platforms;
    return `**${i + 1}. ${g.name}**\n📅 ${g.released ?? '—'} • ⭐ ${rating} • 🎮 ${trunc}`;
  });

  embed.setDescription(lines.join('\n\n'));
  if (games[0]?.background_image) embed.setThumbnail(games[0].background_image);

  await interaction.editReply({ embeds: [embed] });
}

async function showScreenshots(btn: ButtonInteraction, game: GameData, screenshots: GameScreenshot[]) {
  await btn.deferUpdate();

  const max = Math.min(screenshots.length, 10);
  let idx = 0;

  const makeEmbed = (i: number) =>
    new EmbedBuilder()
      .setColor(gameAPI.getRatingColor(game.rating))
      .setTitle(`📸 ${game.name} — Screenshots`)
      .setImage(screenshots[i].image)
      .setFooter({ text: `${i + 1} / ${max}` });

  const makeRow = (i: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (i > 0)       row.addComponents(new ButtonBuilder().setCustomId('ss_prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setLabel('Prev'));
    if (i < max - 1) row.addComponents(new ButtonBuilder().setCustomId('ss_next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setLabel('Next'));
    row.addComponents(new ButtonBuilder().setCustomId('ss_close').setEmoji('✖️').setStyle(ButtonStyle.Danger).setLabel('Close'));
    return row;
  };

  await btn.editReply({ embeds: [makeEmbed(idx)], components: [makeRow(idx)] });

  const collector = btn.message.createMessageComponentCollector({ time: 300_000 });

  collector.on('collect', async (b: ButtonInteraction) => {
    if (b.user.id !== btn.user.id) {
      await b.reply({ content: '❌ This screenshot viewer belongs to someone else.', ephemeral: true });
      return;
    }
    await b.deferUpdate();
    if (b.customId === 'ss_prev' && idx > 0) idx--;
    if (b.customId === 'ss_next' && idx < max - 1) idx++;
    if (b.customId === 'ss_close') { collector.stop(); return; }
    await b.editReply({ embeds: [makeEmbed(idx)], components: [makeRow(idx)] });
  });

  collector.on('end', async () => {
    try {
      const disabledRow = makeRow(idx);
      disabledRow.components.forEach((c: any) => c.setDisabled(true));
      await btn.editReply({ components: [disabledRow] });
    } catch { /* message may be gone */ }
  });
}
