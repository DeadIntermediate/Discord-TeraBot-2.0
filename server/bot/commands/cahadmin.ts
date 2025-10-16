import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { db } from '../db';
import { 
  cahWhiteCards, 
  cahBlackCards, 
  cahGames, 
  cahGameStats,
  discordServers
} from '../../shared/schema';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { seedCahCards, seedAdditionalCards, getCardStats } from '../utils/cahCardSeeder';

export const data = new SlashCommandBuilder()
  .setName('cahadmin')
  .setDescription('Cards Against Humanity administration commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup(group =>
    group
      .setName('cards')
      .setDescription('Manage Cards Against Humanity cards')
      .addSubcommand(subcommand =>
        subcommand
          .setName('seed')
          .setDescription('Seed the database with official CAH cards')
          .addBooleanOption(option =>
            option
              .setName('force')
              .setDescription('Force re-seed even if cards exist')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('add-white')
          .setDescription('Add a custom white card')
          .addStringOption(option =>
            option
              .setName('content')
              .setDescription('The white card text')
              .setRequired(true)
              .setMaxLength(200)
          )
          .addStringOption(option =>
            option
              .setName('set')
              .setDescription('Card set name')
              .setRequired(false)
              .addChoices(
                { name: 'Server Custom', value: 'server-custom' },
                { name: 'Family Friendly', value: 'family' },
                { name: 'Gaming', value: 'gaming' },
                { name: 'Community', value: 'community' },
                { name: 'Mature (18+)', value: 'mature' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('add-black')
          .setDescription('Add a custom black card')
          .addStringOption(option =>
            option
              .setName('content')
              .setDescription('The black card text (use __________ for blanks)')
              .setRequired(true)
              .setMaxLength(300)
          )
          .addIntegerOption(option =>
            option
              .setName('pick-count')
              .setDescription('Number of white cards to pick')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(3)
          )
          .addStringOption(option =>
            option
              .setName('set')
              .setDescription('Card set name')
              .setRequired(false)
              .addChoices(
                { name: 'Server Custom', value: 'server-custom' },
                { name: 'Family Friendly', value: 'family' },
                { name: 'Gaming', value: 'gaming' },
                { name: 'Community', value: 'community' },
                { name: 'Mature (18+)', value: 'mature' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List custom cards for this server')
          .addStringOption(option =>
            option
              .setName('type')
              .setDescription('Card type to list')
              .setRequired(false)
              .addChoices(
                { name: 'White Cards', value: 'white' },
                { name: 'Black Cards', value: 'black' },
                { name: 'All Cards', value: 'all' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Remove a custom card')
          .addStringOption(option =>
            option
              .setName('card-id')
              .setDescription('The ID of the card to remove')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('stats')
          .setDescription('View card statistics')
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('games')
      .setDescription('Manage active and historical games')
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List active games in the server')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('force-end')
          .setDescription('Force end an active game')
          .addStringOption(option =>
            option
              .setName('game-id')
              .setDescription('Game ID to end (leave empty for current channel)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('history')
          .setDescription('View game history')
          .addIntegerOption(option =>
            option
              .setName('limit')
              .setDescription('Number of games to show')
              .setMinValue(1)
              .setMaxValue(20)
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('leaderboard')
          .setDescription('View server leaderboard')
          .addIntegerOption(option =>
            option
              .setName('limit')
              .setDescription('Number of players to show')
              .setMinValue(5)
              .setMaxValue(25)
              .setRequired(false)
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('settings')
      .setDescription('Configure server CAH settings')
      .addSubcommand(subcommand =>
        subcommand
          .setName('family-mode')
          .setDescription('Toggle family-friendly mode for the server')
          .addBooleanOption(option =>
            option
              .setName('enabled')
              .setDescription('Enable family-friendly mode')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('max-games')
          .setDescription('Set maximum concurrent games per server')
          .addIntegerOption(option =>
            option
              .setName('count')
              .setDescription('Maximum number of concurrent games')
              .setMinValue(1)
              .setMaxValue(5)
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription('View current server CAH settings')
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  switch (subcommandGroup) {
    case 'cards':
      return await handleCardsCommands(interaction, subcommand);
    case 'games':
      return await handleGamesCommands(interaction, subcommand);
    case 'settings':
      return await handleSettingsCommands(interaction, subcommand);
    default:
      return await interaction.reply({
        content: '❌ Unknown command group!',
        ephemeral: true
      });
  }
}

async function handleCardsCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const serverId = interaction.guildId!;

  switch (subcommand) {
    case 'seed':
      await seedCards(interaction);
      break;
    case 'add-white':
      await addWhiteCard(interaction, serverId);
      break;
    case 'add-black':
      await addBlackCard(interaction, serverId);
      break;
    case 'list':
      await listCustomCards(interaction, serverId);
      break;
    case 'remove':
      await removeCard(interaction, serverId);
      break;
    case 'stats':
      await showCardStats(interaction);
      break;
    default:
      await interaction.reply({ content: '❌ Unknown cards command!', ephemeral: true });
  }
}

async function handleGamesCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const serverId = interaction.guildId!;

  switch (subcommand) {
    case 'list':
      await listActiveGames(interaction, serverId);
      break;
    case 'force-end':
      await forceEndGame(interaction, serverId);
      break;
    case 'history':
      await showGameHistory(interaction, serverId);
      break;
    case 'leaderboard':
      await showLeaderboard(interaction, serverId);
      break;
    default:
      await interaction.reply({ content: '❌ Unknown games command!', ephemeral: true });
  }
}

async function handleSettingsCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const serverId = interaction.guildId!;

  switch (subcommand) {
    case 'family-mode':
      await toggleFamilyMode(interaction, serverId);
      break;
    case 'max-games':
      await setMaxGames(interaction, serverId);
      break;
    case 'view':
      await viewSettings(interaction, serverId);
      break;
    default:
      await interaction.reply({ content: '❌ Unknown settings command!', ephemeral: true });
  }
}

async function seedCards(interaction: ChatInputCommandInteraction) {
  const force = interaction.options.getBoolean('force') || false;

  try {
    await interaction.deferReply();

    if (!force) {
      const existingCards = await db.select().from(cahWhiteCards).limit(1);
      if (existingCards.length > 0) {
        return await interaction.editReply({
          content: '⚠️ Cards already exist! Use `force: true` to re-seed.'
        });
      }
    }

    if (force) {
      // Clear existing cards
      await db.delete(cahWhiteCards);
      await db.delete(cahBlackCards);
    }

    await seedCahCards();
    await seedAdditionalCards();

    const stats = await getCardStats();

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('✅ Cards Seeded Successfully!')
      .setDescription('Cards Against Humanity card database has been initialized.')
      .addFields(
        {
          name: '📊 **Card Statistics**',
          value: [
            `**White Cards:** ${stats.totalWhiteCards}`,
            `**Black Cards:** ${stats.totalBlackCards}`,
            `**Total Cards:** ${stats.totalWhiteCards + stats.totalBlackCards}`
          ].join('\n'),
          inline: true
        },
        {
          name: '📚 **Card Sets**',
          value: stats.cardSetBreakdown.map(set => 
            `**${set.cardSet}:** ${set.count} cards`
          ).join('\n') || 'No card sets found',
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error seeding cards:', error);
    await interaction.editReply({
      content: '❌ Failed to seed cards. Check the console for errors.'
    });
  }
}

async function addWhiteCard(interaction: ChatInputCommandInteraction, serverId: string) {
  const content = interaction.options.getString('content', true);
  const cardSet = interaction.options.getString('set') || 'server-custom';

  try {
    const [card] = await db.insert(cahWhiteCards).values({
      content,
      cardSet,
      serverId: cardSet === 'server-custom' ? serverId : null,
      createdBy: interaction.user.id,
      isApproved: true,
      isActive: true,
    }).returning();

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('✅ White Card Added!')
      .setDescription(`**Content:** "${content}"\n**Set:** ${cardSet}\n**ID:** ${card.id}`)
      .setFooter({ text: 'Card is now available for games' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error adding white card:', error);
    await interaction.reply({
      content: '❌ Failed to add white card.',
      ephemeral: true
    });
  }
}

async function addBlackCard(interaction: ChatInputCommandInteraction, serverId: string) {
  const content = interaction.options.getString('content', true);
  const pickCount = interaction.options.getInteger('pick-count') || 1;
  const cardSet = interaction.options.getString('set') || 'server-custom';

  if (!content.includes('__________')) {
    return await interaction.reply({
      content: '❌ Black cards must contain at least one blank (`__________`)!',
      ephemeral: true
    });
  }

  try {
    const [card] = await db.insert(cahBlackCards).values({
      content,
      pickCount,
      cardSet,
      serverId: cardSet === 'server-custom' ? serverId : null,
      createdBy: interaction.user.id,
      isApproved: true,
      isActive: true,
    }).returning();

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('✅ Black Card Added!')
      .setDescription(`**Content:** "${content}"\n**Pick Count:** ${pickCount}\n**Set:** ${cardSet}\n**ID:** ${card.id}`)
      .setFooter({ text: 'Card is now available for games' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error adding black card:', error);
    await interaction.reply({
      content: '❌ Failed to add black card.',
      ephemeral: true
    });
  }
}

async function listCustomCards(interaction: ChatInputCommandInteraction, serverId: string) {
  const type = interaction.options.getString('type') || 'all';

  try {
    let whiteCards: any[] = [];
    let blackCards: any[] = [];

    if (type === 'white' || type === 'all') {
      whiteCards = await db
        .select()
        .from(cahWhiteCards)
        .where(eq(cahWhiteCards.serverId, serverId))
        .limit(10);
    }

    if (type === 'black' || type === 'all') {
      blackCards = await db
        .select()
        .from(cahBlackCards)
        .where(eq(cahBlackCards.serverId, serverId))
        .limit(10);
    }

    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('📋 Custom Cards for This Server')
      .setDescription(`Showing custom cards created for this server.`);

    if (whiteCards.length > 0) {
      embed.addFields({
        name: '⬜ **White Cards**',
        value: whiteCards.map(card => 
          `**${card.id.substring(0, 8)}...** "${card.content}"`
        ).join('\n') + (whiteCards.length === 10 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    if (blackCards.length > 0) {
      embed.addFields({
        name: '⬛ **Black Cards**',
        value: blackCards.map(card => 
          `**${card.id.substring(0, 8)}...** "${card.content}" (${card.pickCount} cards)`
        ).join('\n') + (blackCards.length === 10 ? '\n*...and more*' : ''),
        inline: false
      });
    }

    if (whiteCards.length === 0 && blackCards.length === 0) {
      embed.setDescription('No custom cards found for this server.');
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error listing cards:', error);
    await interaction.reply({
      content: '❌ Failed to list cards.',
      ephemeral: true
    });
  }
}

async function removeCard(interaction: ChatInputCommandInteraction, serverId: string) {
  const cardId = interaction.options.getString('card-id', true);

  try {
    // Try to find and delete white card first
    const whiteResult = await db
      .delete(cahWhiteCards)
      .where(and(
        eq(cahWhiteCards.id, cardId),
        eq(cahWhiteCards.serverId, serverId)
      ))
      .returning();

    if (whiteResult.length > 0) {
      return await interaction.reply({
        content: `✅ White card "${whiteResult[0].content}" has been removed.`
      });
    }

    // Try black card
    const blackResult = await db
      .delete(cahBlackCards)
      .where(and(
        eq(cahBlackCards.id, cardId),
        eq(cahBlackCards.serverId, serverId)
      ))
      .returning();

    if (blackResult.length > 0) {
      return await interaction.reply({
        content: `✅ Black card "${blackResult[0].content}" has been removed.`
      });
    }

    await interaction.reply({
      content: '❌ Card not found or you don\'t have permission to remove it.',
      ephemeral: true
    });

  } catch (error) {
    console.error('Error removing card:', error);
    await interaction.reply({
      content: '❌ Failed to remove card.',
      ephemeral: true
    });
  }
}

async function showCardStats(interaction: ChatInputCommandInteraction) {
  try {
    const stats = await getCardStats();

    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('📊 Cards Against Humanity - Card Statistics')
      .addFields(
        {
          name: '📈 **Overall Statistics**',
          value: [
            `**Total White Cards:** ${stats.totalWhiteCards}`,
            `**Total Black Cards:** ${stats.totalBlackCards}`,
            `**Total Cards:** ${stats.totalWhiteCards + stats.totalBlackCards}`
          ].join('\n'),
          inline: true
        },
        {
          name: '📚 **Card Set Breakdown**',
          value: stats.cardSetBreakdown.map(set => 
            `**${set.cardSet}:** ${set.count} cards`
          ).join('\n') || 'No card sets found',
          inline: true
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error showing card stats:', error);
    await interaction.reply({
      content: '❌ Failed to retrieve card statistics.',
      ephemeral: true
    });
  }
}

async function listActiveGames(interaction: ChatInputCommandInteraction, serverId: string) {
  try {
    const activeGames = await db
      .select()
      .from(cahGames)
      .where(and(
        eq(cahGames.serverId, serverId),
        sql`status IN ('waiting', 'active', 'voting')`
      ))
      .orderBy(desc(cahGames.createdAt));

    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🎮 Active CAH Games')
      .setDescription(activeGames.length > 0 ? 'Current games in this server:' : 'No active games found.');

    if (activeGames.length > 0) {
      embed.addFields(
        activeGames.map(game => ({
          name: `**Game ${game.id.substring(0, 8)}...**`,
          value: [
            `**Status:** ${game.status}`,
            `**Channel:** <#${game.channelId}>`,
            `**Host:** <@${game.hostId}>`,
            `**Round:** ${game.currentRound}/${game.maxRounds}`,
            `**Created:** <t:${Math.floor(new Date(game.createdAt).getTime() / 1000)}:R>`
          ].join('\n'),
          inline: true
        }))
      );
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error listing active games:', error);
    await interaction.reply({
      content: '❌ Failed to list active games.',
      ephemeral: true
    });
  }
}

async function forceEndGame(interaction: ChatInputCommandInteraction, serverId: string) {
  const gameId = interaction.options.getString('game-id');

  try {
    let game;

    if (gameId) {
      [game] = await db
        .select()
        .from(cahGames)
        .where(and(
          eq(cahGames.id, gameId),
          eq(cahGames.serverId, serverId)
        ));
    } else {
      // Find game in current channel
      [game] = await db
        .select()
        .from(cahGames)
        .where(and(
          eq(cahGames.serverId, serverId),
          eq(cahGames.channelId, interaction.channelId),
          sql`status IN ('waiting', 'active', 'voting')`
        ));
    }

    if (!game) {
      return await interaction.reply({
        content: '❌ No active game found.',
        ephemeral: true
      });
    }

    await db
      .update(cahGames)
      .set({
        status: 'cancelled',
        endedAt: new Date()
      })
      .where(eq(cahGames.id, game.id));

    await interaction.reply({
      content: `✅ Game ${game.id.substring(0, 8)}... has been force-ended.`
    });

  } catch (error) {
    console.error('Error force ending game:', error);
    await interaction.reply({
      content: '❌ Failed to end game.',
      ephemeral: true
    });
  }
}

async function showGameHistory(interaction: ChatInputCommandInteraction, serverId: string) {
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const games = await db
      .select()
      .from(cahGames)
      .where(and(
        eq(cahGames.serverId, serverId),
        sql`status IN ('finished', 'cancelled')`
      ))
      .orderBy(desc(cahGames.endedAt))
      .limit(limit);

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📜 CAH Game History')
      .setDescription(games.length > 0 ? `Last ${games.length} completed games:` : 'No completed games found.');

    if (games.length > 0) {
      embed.addFields(
        games.map(game => ({
          name: `**Game ${game.id.substring(0, 8)}...**`,
          value: [
            `**Status:** ${game.status}`,
            `**Host:** <@${game.hostId}>`,
            `**Winner:** ${game.winnerId ? `<@${game.winnerId}>` : 'None'}`,
            `**Rounds:** ${game.currentRound}/${game.maxRounds}`,
            `**Ended:** <t:${Math.floor(new Date(game.endedAt!).getTime() / 1000)}:R>`
          ].join('\n'),
          inline: true
        }))
      );
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error showing game history:', error);
    await interaction.reply({
      content: '❌ Failed to retrieve game history.',
      ephemeral: true
    });
  }
}

async function showLeaderboard(interaction: ChatInputCommandInteraction, serverId: string) {
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const leaderboard = await db
      .select()
      .from(cahGameStats)
      .where(eq(cahGameStats.serverId, serverId))
      .orderBy(desc(cahGameStats.gamesWon), desc(cahGameStats.totalScore))
      .limit(limit);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 CAH Server Leaderboard')
      .setDescription(leaderboard.length > 0 ? 'Top players on this server:' : 'No statistics found.');

    if (leaderboard.length > 0) {
      embed.addFields({
        name: '🏆 **Top Players**',
        value: leaderboard.map((stats, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) : '0.0';
          return `${medal} <@${stats.userId}> - **${stats.gamesWon}** wins (${winRate}% win rate)`;
        }).join('\n'),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error showing leaderboard:', error);
    await interaction.reply({
      content: '❌ Failed to retrieve leaderboard.',
      ephemeral: true
    });
  }
}

async function toggleFamilyMode(interaction: ChatInputCommandInteraction, serverId: string) {
  const enabled = interaction.options.getBoolean('enabled', true);

  try {
    await db
      .update(discordServers)
      .set({
        settings: sql`settings || '{"cah_family_mode": ${enabled}}'::jsonb`
      })
      .where(eq(discordServers.id, serverId));

    await interaction.reply({
      content: `✅ Family-friendly mode has been ${enabled ? 'enabled' : 'disabled'} for this server.`
    });

  } catch (error) {
    console.error('Error toggling family mode:', error);
    await interaction.reply({
      content: '❌ Failed to update family mode setting.',
      ephemeral: true
    });
  }
}

async function setMaxGames(interaction: ChatInputCommandInteraction, serverId: string) {
  const maxGames = interaction.options.getInteger('count', true);

  try {
    await db
      .update(discordServers)
      .set({
        settings: sql`settings || '{"cah_max_games": ${maxGames}}'::jsonb`
      })
      .where(eq(discordServers.id, serverId));

    await interaction.reply({
      content: `✅ Maximum concurrent CAH games set to ${maxGames} for this server.`
    });

  } catch (error) {
    console.error('Error setting max games:', error);
    await interaction.reply({
      content: '❌ Failed to update max games setting.',
      ephemeral: true
    });
  }
}

async function viewSettings(interaction: ChatInputCommandInteraction, serverId: string) {
  try {
    const [server] = await db
      .select()
      .from(discordServers)
      .where(eq(discordServers.id, serverId));

    const settings = (server?.settings as any) || {};

    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('⚙️ CAH Server Settings')
      .addFields(
        {
          name: '🛡️ **Content Settings**',
          value: [
            `**Family-Friendly Mode:** ${settings.cah_family_mode ? 'Enabled' : 'Disabled'}`,
            `**Custom Cards:** Allowed`,
            `**Content Filter:** ${settings.cah_family_mode ? 'Active' : 'Disabled'}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🎮 **Game Settings**',
          value: [
            `**Max Concurrent Games:** ${settings.cah_max_games || 3}`,
            `**Auto-cleanup:** Enabled`,
            `**Stats Tracking:** Enabled`
          ].join('\n'),
          inline: true
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error viewing settings:', error);
    await interaction.reply({
      content: '❌ Failed to retrieve settings.',
      ephemeral: true
    });
  }
}