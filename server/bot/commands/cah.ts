import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ButtonInteraction,
  StringSelectMenuInteraction,
  TextBasedChannel
} from 'discord.js';
import { CahGameEngine, GameSettings } from '../utils/cahGameEngine';
import { db } from '../db';
import { cahGames, cahWhiteCards, cahBlackCards } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Store active games in memory for quick access
const activeGames = new Map<string, CahGameEngine>();

export const data = new SlashCommandBuilder()
  .setName('cah')
  .setDescription('Cards Against Humanity game commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new Cards Against Humanity game')
      .addIntegerOption(option =>
        option
          .setName('max-players')
          .setDescription('Maximum number of players (3-10)')
          .setMinValue(3)
          .setMaxValue(10)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('max-rounds')
          .setDescription('Maximum number of rounds (5-20)')
          .setMinValue(5)
          .setMaxValue(20)
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('win-condition')
          .setDescription('Points needed to win (3-10)')
          .setMinValue(3)
          .setMaxValue(10)
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('family-friendly')
          .setDescription('Use family-friendly cards only')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('join')
      .setDescription('Join an active Cards Against Humanity game')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('leave')
      .setDescription('Leave the current Cards Against Humanity game')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start the Cards Against Humanity game (host only)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('hand')
      .setDescription('View your current hand (sent privately)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('play')
      .setDescription('Play your cards for the current round')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('View the current game status')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel the current game (host only)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('View your Cards Against Humanity statistics')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      return await createGame(interaction);
    case 'join':
      return await joinGame(interaction);
    case 'leave':
      return await leaveGame(interaction);
    case 'start':
      return await startGame(interaction);
    case 'hand':
      return await showHand(interaction);
    case 'play':
      return await playCards(interaction);
    case 'status':
      return await showStatus(interaction);
    case 'cancel':
      return await cancelGame(interaction);
    case 'stats':
      return await showStats(interaction);
    default:
      return await interaction.reply({
        content: '❌ Unknown subcommand!',
        ephemeral: true
      });
  }
}

async function createGame(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const hostId = interaction.user.id;

  // Check if there's already an active game in this channel
  const existingGame = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId),
      eq(cahGames.status, 'waiting')
    ));

  if (existingGame.length > 0) {
    return await interaction.reply({
      content: '❌ There is already an active game in this channel!',
      ephemeral: true
    });
  }

  const settings: Partial<GameSettings> = {
    maxPlayers: interaction.options.getInteger('max-players') || 8,
    maxRounds: interaction.options.getInteger('max-rounds') || 10,
    winCondition: interaction.options.getInteger('win-condition') || 5,
    familyFriendly: interaction.options.getBoolean('family-friendly') || false,
  };

  try {
    const gameEngine = await CahGameEngine.createGame(serverId, channelId, hostId, settings);
    activeGames.set(gameEngine.getGameState()!.game.id, gameEngine);

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🃏 Cards Against Humanity - Game Created!')
      .setDescription('A new game has been created and is waiting for players.')
      .addFields(
        {
          name: '🎮 **Game Settings**',
          value: `• **Max Players:** ${settings.maxPlayers}\n• **Max Rounds:** ${settings.maxRounds}\n• **Win Condition:** ${settings.winCondition} points\n• **Family Friendly:** ${settings.familyFriendly ? 'Yes' : 'No'}`,
          inline: true
        },
        {
          name: '👥 **Players (1/${settings.maxPlayers})**',
          value: `🎪 <@${hostId}> (Host)`,
          inline: true
        },
        {
          name: '📋 **How to Play**',
          value: '• Use `/cah join` to join the game\n• Need at least 3 players to start\n• Host uses `/cah start` when ready',
          inline: false
        }
      )
      .setFooter({ text: 'Cards Against Humanity • Use /cah join to participate!' })
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cah_join_${gameEngine.getGameState()!.game.id}`)
          .setLabel('Join Game')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId(`cah_start_${gameEngine.getGameState()!.game.id}`)
          .setLabel('Start Game')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId(`cah_cancel_${gameEngine.getGameState()!.game.id}`)
          .setLabel('Cancel Game')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });

  } catch (error) {
    console.error('Error creating CAH game:', error);
    await interaction.reply({
      content: '❌ Failed to create game. Please try again.',
      ephemeral: true
    });
  }
}

async function joinGame(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId),
      eq(cahGames.status, 'waiting')
    ));

  if (!game) {
    return await interaction.reply({
      content: '❌ No active game found in this channel. Use `/cah create` to start one!',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const result = await gameEngine.addPlayer(userId);

  if (result.success) {
    const gameState = await gameEngine.loadGameState();
    
    const embed = new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('🎉 Player Joined!')
      .setDescription(`<@${userId}> has joined the game!`)
      .addFields(
        {
          name: '👥 **Players**',
          value: gameState.players.map((p, i) => 
            `${i === 0 ? '🎪' : '🎮'} <@${p.userId}>${i === 0 ? ' (Host)' : ''}`
          ).join('\n'),
          inline: true
        },
        {
          name: '📊 **Game Info**',
          value: `${gameState.players.length}/${gameState.game.maxPlayers} players\nNeed ${Math.max(0, 3 - gameState.players.length)} more to start`,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
}

async function leaveGame(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId)
    ));

  if (!game || game.status === 'finished' || game.status === 'cancelled') {
    return await interaction.reply({
      content: '❌ No active game found in this channel.',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const result = await gameEngine.removePlayer(userId);

  await interaction.reply({
    content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    ephemeral: true
  });
}

async function startGame(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId),
      eq(cahGames.status, 'waiting')
    ));

  if (!game) {
    return await interaction.reply({
      content: '❌ No active game found in this channel.',
      ephemeral: true
    });
  }

  if (game.hostId !== userId) {
    return await interaction.reply({
      content: '❌ Only the game host can start the game!',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const result = await gameEngine.startGame();

  if (result.success) {
    const gameState = await gameEngine.loadGameState();
    
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🚀 Game Started!')
      .setDescription('**Round 1** has begun!')
      .addFields(
        {
          name: '🃏 **Current Black Card**',
          value: `"${gameState.currentBlackCard?.content || 'Loading...'}"\n\n*Pick ${gameState.currentBlackCard?.pickCount || 1} card(s)*`,
          inline: false
        },
        {
          name: '⚖️ **Current Judge**',
          value: `<@${gameState.judgeId}>`,
          inline: true
        },
        {
          name: '👥 **Players**',
          value: gameState.players.map(p => `🎮 <@${p.userId}> (${p.score} pts)`).join('\n'),
          inline: true
        },
        {
          name: '📋 **Instructions**',
          value: '• Use `/cah hand` to see your cards\n• Use `/cah play` to submit your answer\n• Judge waits for all submissions',
          inline: false
        }
      )
      .setFooter({ text: 'Cards Against Humanity • Submit your cards!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Send hands to all players privately
    for (const player of gameState.players) {
      try {
        const hand = await gameEngine.getPlayerHand(player.userId);
        await sendHandToPlayer(interaction, player.userId, hand, gameState.currentBlackCard!);
      } catch (error) {
        console.error(`Failed to send hand to player ${player.userId}:`, error);
      }
    }

  } else {
    await interaction.reply({
      content: `❌ ${result.message}`,
      ephemeral: true
    });
  }
}

async function showHand(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId)
    ));

  if (!game || game.status !== 'active') {
    return await interaction.reply({
      content: '❌ No active game found in this channel.',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const gameState = await gameEngine.loadGameState();
  const hand = await gameEngine.getPlayerHand(userId);

  if (hand.length === 0) {
    return await interaction.reply({
      content: '❌ You are not in this game or have no cards.',
      ephemeral: true
    });
  }

  await sendHandToPlayer(interaction, userId, hand, gameState.currentBlackCard!, true);
}

async function sendHandToPlayer(
  interaction: ChatInputCommandInteraction, 
  userId: string, 
  hand: any[], 
  blackCard: any,
  isDirectRequest = false
) {
  try {
    const user = await interaction.client.users.fetch(userId);
    
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🃏 Your Hand - Cards Against Humanity')
      .setDescription(`**Current Black Card:** "${blackCard.content}"\n\n*Pick ${blackCard.pickCount} card(s)*`)
      .addFields(
        {
          name: '📋 **Your White Cards:**',
          value: hand.map((card, i) => `**${i + 1}.** ${card.content}`).join('\n') || 'No cards',
          inline: false
        }
      )
      .setFooter({ text: 'Use /cah play to submit your cards • Only you can see this' })
      .setTimestamp();

    await user.send({ embeds: [embed] });

    if (isDirectRequest) {
      await interaction.reply({
        content: '✅ Your hand has been sent to your DMs!',
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Failed to send DM to player:', error);
    if (isDirectRequest) {
      await interaction.reply({
        content: '❌ Could not send DM. Please enable DMs from server members.',
        ephemeral: true
      });
    }
  }
}

async function playCards(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId)
    ));

  if (!game || game.status !== 'active') {
    return await interaction.reply({
      content: '❌ No active game found in this channel.',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const gameState = await gameEngine.loadGameState();
  const hand = await gameEngine.getPlayerHand(userId);

  if (hand.length === 0) {
    return await interaction.reply({
      content: '❌ You are not in this game.',
      ephemeral: true
    });
  }

  if (gameState.judgeId === userId) {
    return await interaction.reply({
      content: '❌ You are the judge this round! Wait for other players to submit.',
      ephemeral: true
    });
  }

  // Create select menu for cards
  const pickCount = gameState.currentBlackCard?.pickCount || 1;
  
  if (pickCount === 1) {
    // Single card selection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`cah_select_${game.id}`)
      .setPlaceholder('Choose your card...')
      .addOptions(
        hand.map((card, i) => 
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i + 1}. ${card.content.substring(0, 90)}${card.content.length > 90 ? '...' : ''}`)
            .setDescription(card.content.length > 90 ? card.content.substring(90, 180) + '...' : undefined)
            .setValue(card.id)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🎴 Select Your Card')
      .setDescription(`**Black Card:** "${gameState.currentBlackCard?.content}"\n\nChoose **1 card** to play:`)
      .setFooter({ text: 'Select your card from the dropdown menu' });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

  } else {
    // Multiple card selection - show numbered list
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🎴 Select Your Cards')
      .setDescription(`**Black Card:** "${gameState.currentBlackCard?.content}"\n\nPick **${pickCount} cards** by typing their numbers (e.g., "1 3 5"):`)
      .addFields(
        {
          name: '📋 **Your Cards:**',
          value: hand.map((card, i) => `**${i + 1}.** ${card.content}`).join('\n'),
          inline: false
        }
      )
      .setFooter({ text: `Type ${pickCount} numbers separated by spaces` });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

    // Set up message collector for multi-card selection
    const filter = (m: any) => m.author.id === userId;
    const collector = interaction.channel?.createMessageCollector({ filter, time: 60000, max: 1 });

    collector?.on('collect', async (message) => {
      const numbers = message.content.split(' ').map(n => parseInt(n.trim()));
      
      if (numbers.length !== pickCount || numbers.some(n => isNaN(n) || n < 1 || n > hand.length)) {
        await message.reply({
          content: `❌ Please enter exactly ${pickCount} valid card numbers!`,
          ephemeral: true
        });
        return;
      }

      const selectedCards = numbers.map(n => hand[n - 1].id);
      const result = await gameEngine!.submitCards(userId, selectedCards);

      await message.reply({
        content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        ephemeral: true
      });

      if (result.success) {
        await checkRoundStatus(interaction, gameEngine!, game.id);
      }
    });
  }
}

async function showStatus(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId)
    ));

  if (!game) {
    return await interaction.reply({
      content: '❌ No game found in this channel.',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  const gameState = await gameEngine.loadGameState();

  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('🃏 Cards Against Humanity - Game Status')
    .addFields(
      {
        name: '🎮 **Game Info**',
        value: `**Status:** ${gameState.game.status}\n**Round:** ${gameState.game.currentRound}/${gameState.game.maxRounds}\n**Host:** <@${gameState.game.hostId}>`,
        inline: true
      },
      {
        name: '👥 **Players**',
        value: gameState.players.map(p => `🎮 <@${p.userId}> (${p.score} pts)`).join('\n') || 'No players',
        inline: true
      }
    );

  if (gameState.currentBlackCard && gameState.game.status === 'active') {
    embed.addFields(
      {
        name: '🃏 **Current Black Card**',
        value: `"${gameState.currentBlackCard.content}"\n*Pick ${gameState.currentBlackCard.pickCount} card(s)*`,
        inline: false
      },
      {
        name: '⚖️ **Judge**',
        value: `<@${gameState.judgeId}>`,
        inline: true
      },
      {
        name: '📊 **Submissions**',
        value: `${gameState.submissions.length}/${gameState.players.length - 1} submitted`,
        inline: true
      }
    );
  }

  await interaction.reply({ embeds: [embed] });
}

async function cancelGame(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId!;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  const [game] = await db
    .select()
    .from(cahGames)
    .where(and(
      eq(cahGames.serverId, serverId),
      eq(cahGames.channelId, channelId)
    ));

  if (!game || game.status === 'finished' || game.status === 'cancelled') {
    return await interaction.reply({
      content: '❌ No active game found in this channel.',
      ephemeral: true
    });
  }

  if (game.hostId !== userId) {
    return await interaction.reply({
      content: '❌ Only the game host can cancel the game!',
      ephemeral: true
    });
  }

  let gameEngine = activeGames.get(game.id);
  if (!gameEngine) {
    gameEngine = new CahGameEngine(game.id);
    activeGames.set(game.id, gameEngine);
  }

  await gameEngine.cancelGame();
  activeGames.delete(game.id);

  const embed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('❌ Game Cancelled')
    .setDescription('The Cards Against Humanity game has been cancelled.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function showStats(interaction: ChatInputCommandInteraction) {
  // Implementation for player statistics
  await interaction.reply({
    content: '📊 Player statistics feature coming soon!',
    ephemeral: true
  });
}

async function checkRoundStatus(interaction: ChatInputCommandInteraction, gameEngine: CahGameEngine, gameId: string) {
  const gameState = await gameEngine.loadGameState();
  
  if (gameState.game.status === 'voting') {
    // All players have submitted, show submissions to judge
    await showSubmissionsToJudge(interaction, gameEngine, gameId);
  }
}

async function showSubmissionsToJudge(interaction: ChatInputCommandInteraction, gameEngine: CahGameEngine, gameId: string) {
  const gameState = await gameEngine.loadGameState();
  
  if (!gameState.judgeId) return;

  try {
    const judge = await interaction.client.users.fetch(gameState.judgeId);
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⚖️ Judge Decision Time!')
      .setDescription(`**Black Card:** "${gameState.currentBlackCard?.content}"\n\nAll submissions are in! Choose the winning combination:`)
      .setFooter({ text: 'Select the funniest combination • Only you can see this' });

    // Add submission fields
    gameState.submissions.forEach((submission, index) => {
      const cardIds = Array.isArray(submission.whiteCardIds) ? submission.whiteCardIds : [];
      embed.addFields({
        name: `**Option ${index + 1}**`,
        value: `Submission ID: ${submission.id}\n*Cards will be revealed in voting*`,
        inline: true
      });
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`cah_judge_${gameId}`)
      .setPlaceholder('Choose the winning submission...')
      .addOptions(
        gameState.submissions.map((submission, i: number) => 
          new StringSelectMenuOptionBuilder()
            .setLabel(`Option ${i + 1}`)
            .setDescription('Click to see the cards and select winner')
            .setValue(submission.id)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await judge.send({
      embeds: [embed],
      components: [row]
    });

    // Also notify the channel
    const channelEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⚖️ All Submissions In!')
      .setDescription(`Judge <@${gameState.judgeId}> is now choosing the winning combination...`)
      .setTimestamp();

    await interaction.followUp({ embeds: [channelEmbed] });

  } catch (error) {
    console.error('Failed to send judge DM:', error);
    await interaction.followUp({
      content: `⚖️ <@${gameState.judgeId}> - All submissions are in! Use the voting interface to choose the winner.`,
    });
  }
}

// Handle button and select menu interactions
export async function handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith('cah_join_')) {
    const gameId = customId.replace('cah_join_', '');
    // Handle join button click
    return;
  }

  if (customId.startsWith('cah_select_')) {
    const gameId = customId.replace('cah_select_', '');
    const gameEngine = activeGames.get(gameId);
    
    if (gameEngine && interaction.isStringSelectMenu()) {
      const selectedCardId = interaction.values[0];
      const result = await gameEngine.submitCards(interaction.user.id, [selectedCardId]);
      
      await interaction.update({
        content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        embeds: [],
        components: []
      });

      if (result.success) {
        // Check if round should move to voting
        const gameState = await gameEngine.loadGameState();
        if (gameState.game.status === 'voting') {
          await showSubmissionsToJudge(interaction as any, gameEngine, gameId);
        }
      }
    }
  }

  if (customId.startsWith('cah_judge_')) {
    const gameId = customId.replace('cah_judge_', '');
    const gameEngine = activeGames.get(gameId);
    
    if (gameEngine && interaction.isStringSelectMenu()) {
      const submissionId = interaction.values[0];
      const result = await gameEngine.selectWinner(interaction.user.id, submissionId);
      
      await interaction.update({
        content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        embeds: [],
        components: []
      });

      if (result.success && result.winner) {
        // Announce winner in channel
        const winnerEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🏆 Round Winner!')
          .setDescription(`<@${result.winner.userId}> wins this round!`)
          .setTimestamp();
        // Get the original interaction channel
        const channel = await interaction.client.channels.fetch(gameEngine.getGameState()!.game.channelId);
        if (channel?.isTextBased()) {
          await (channel as TextBasedChannel).send({ embeds: [winnerEmbed] });
        }
        }
      }
    }
  }
}