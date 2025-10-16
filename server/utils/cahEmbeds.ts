import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { CahGameState, CahGameEngine } from './cahGameEngine';
import { CahWhiteCard, CahBlackCard, CahGamePlayer, CahGameSubmission } from '../../shared/schema';

export class CahEmbedBuilder {
  
  /**
   * Create game lobby embed
   */
  static createLobbyEmbed(gameState: CahGameState): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
    const { game, players } = gameState;
    const settings = game.settings as any;

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🃏 Cards Against Humanity - Game Lobby')
      .setDescription('Waiting for players to join...')
      .addFields(
        {
          name: '🎮 **Game Settings**',
          value: [
            `• **Max Players:** ${settings.maxPlayers || 8}`,
            `• **Max Rounds:** ${settings.maxRounds || 10}`,
            `• **Win Condition:** ${settings.winCondition || 5} points`,
            `• **Family Friendly:** ${settings.familyFriendly ? 'Yes' : 'No'}`,
            `• **Card Sets:** ${(settings.cardSets || ['base']).join(', ')}`
          ].join('\n'),
          inline: true
        },
        {
          name: `👥 **Players (${players.length}/${settings.maxPlayers || 8})**`,
          value: players.length > 0 
            ? players.map((p, i) => 
                `${i === 0 ? '👑' : '🎮'} <@${p.userId}>${i === 0 ? ' (Host)' : ''}`
              ).join('\n')
            : 'No players yet',
          inline: true
        },
        {
          name: '📋 **How to Join**',
          value: [
            '• Click **Join Game** button below',
            '• Or use `/cah join` command',
            `• Need at least 3 players to start`,
            '• Host clicks **Start** when ready'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Cards Against Humanity • Inappropriate humor since 2011' })
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cah_join_${game.id}`)
          .setLabel('Join Game')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId(`cah_start_${game.id}`)
          .setLabel('Start Game')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀')
          .setDisabled(players.length < 3),
        new ButtonBuilder()
          .setCustomId(`cah_leave_${game.id}`)
          .setLabel('Leave Game')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🚪'),
        new ButtonBuilder()
          .setCustomId(`cah_cancel_${game.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    return { embed, components: [buttons] };
  }

  /**
   * Create round start embed
   */
  static createRoundStartEmbed(gameState: CahGameState): EmbedBuilder {
    const { game, players, currentBlackCard, judgeId } = gameState;

    return new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle(`🚀 Round ${game.currentRound} Started!`)
      .setDescription('Time to submit your hilarious answers!')
      .addFields(
        {
          name: '🃏 **Black Card**',
          value: `**"${currentBlackCard?.content || 'Loading...'}"**\n\n*Pick ${currentBlackCard?.pickCount || 1} card${(currentBlackCard?.pickCount || 1) > 1 ? 's' : ''}*`,
          inline: false
        },
        {
          name: '⚖️ **Judge This Round**',
          value: `<@${judgeId}>`,
          inline: true
        },
        {
          name: '🏆 **Current Scores**',
          value: players
            .sort((a, b) => b.score - a.score)
            .map(p => `🎮 <@${p.userId}>: **${p.score}** pts`)
            .join('\n'),
          inline: true
        },
        {
          name: '📋 **Instructions**',
          value: [
            '• **Players:** Use `/cah hand` to see your cards',
            '• **Players:** Use `/cah play` to submit your answer',
            '• **Judge:** Wait for all submissions, then vote',
            '• **Everyone:** Have fun and be inappropriate! 😈'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: `Round ${game.currentRound}/${game.maxRounds} • Cards Against Humanity` })
      .setTimestamp();
  }

  /**
   * Create player hand embed (DM)
   */
  static createHandEmbed(hand: CahWhiteCard[], blackCard: CahBlackCard, gameRound: number): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🃏 Your Hand - Cards Against Humanity')
      .setDescription([
        `**Current Black Card:**`,
        `*"${blackCard.content}"*`,
        '',
        `**Pick ${blackCard.pickCount} card${blackCard.pickCount > 1 ? 's' : ''} to play**`
      ].join('\n'))
      .addFields(
        {
          name: '📋 **Your White Cards**',
          value: hand.length > 0 
            ? hand.map((card, i) => `**${i + 1}.** ${card.content}`).join('\n')
            : 'No cards in hand',
          inline: false
        },
        {
          name: '🎯 **How to Play**',
          value: [
            `• Go back to the server channel`,
            `• Use \`/cah play\` to submit your cards`,
            `• Choose card${blackCard.pickCount > 1 ? 's' : ''} that make the funniest combination!`
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: `Round ${gameRound} • Only you can see this message` })
      .setTimestamp();
  }

  /**
   * Create card selection embed
   */
  static createCardSelectionEmbed(
    hand: CahWhiteCard[], 
    blackCard: CahBlackCard, 
    pickCount: number
  ): { embed: EmbedBuilder; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
    const embed = new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🎴 Select Your Cards')
      .setDescription([
        `**Black Card:** "${blackCard.content}"`,
        '',
        `Choose **${pickCount} card${pickCount > 1 ? 's' : ''}** to play:`
      ].join('\n'))
      .addFields(
        {
          name: '📋 **Available Cards**',
          value: hand.map((card, i) => `**${i + 1}.** ${card.content}`).join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Select your cards from the dropdown menu below' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('cah_card_select')
      .setPlaceholder(`Choose ${pickCount} card${pickCount > 1 ? 's' : ''}...`)
      .setMinValues(pickCount)
      .setMaxValues(pickCount)
      .addOptions(
        hand.map((card, i) => 
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i + 1}. ${card.content.substring(0, 85)}${card.content.length > 85 ? '...' : ''}`)
            .setDescription(card.content.length > 85 ? card.content.substring(85, 185) + '...' : undefined)
            .setValue(card.id)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return { embed, components: [row] };
  }

  /**
   * Create voting phase embed
   */
  static createVotingEmbed(gameState: CahGameState, submissions: Array<{ submission: CahGameSubmission; cards: CahWhiteCard[] }>): EmbedBuilder {
    const { currentBlackCard, judgeId } = gameState;

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⚖️ Voting Time!')
      .setDescription([
        `**Black Card:** "${currentBlackCard?.content}"`,
        '',
        `All submissions are in! Judge <@${judgeId}> will choose the winner.`
      ].join('\n'))
      .addFields(
        {
          name: '📝 **Submissions**',
          value: submissions.map((sub, i) => 
            `**${i + 1}.** ${sub.cards.map(c => c.content).join(' + ')}`
          ).join('\n\n'),
          inline: false
        },
        {
          name: '🎯 **Judge Instructions**',
          value: [
            '• Read each submission carefully',
            '• Consider which is funniest/most clever',
            '• Use the voting interface sent to your DMs',
            '• Choose wisely - points are at stake!'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Waiting for judge decision...' })
      .setTimestamp();
  }

  /**
   * Create judge selection embed (DM)
   */
  static createJudgeSelectionEmbed(
    blackCard: CahBlackCard,
    submissions: Array<{ submission: CahGameSubmission; cards: CahWhiteCard[]; player: CahGamePlayer }>
  ): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⚖️ Judge Decision Time!')
      .setDescription([
        `**Black Card:** "${blackCard.content}"`,
        '',
        'Choose the winning combination!'
      ].join('\n'))
      .addFields(
        submissions.map((sub, i) => ({
          name: `**Option ${i + 1}**`,
          value: `"${sub.cards.map(c => c.content).join(' / ')}"`,
          inline: false
        }))
      )
      .setFooter({ text: 'Click the button for the funniest combination' })
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        submissions.map((sub, i) => 
          new ButtonBuilder()
            .setCustomId(`cah_judge_vote_${sub.submission.id}`)
            .setLabel(`Option ${i + 1}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(`${i + 1}️⃣`)
        )
      );

    return { embed, components: [buttons] };
  }

  /**
   * Create round winner embed
   */
  static createRoundWinnerEmbed(
    winner: CahGamePlayer, 
    winningCards: CahWhiteCard[], 
    blackCard: CahBlackCard,
    gameState: CahGameState
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏆 Round Winner!')
      .setDescription([
        `**Winning Combination:**`,
        `*"${blackCard.content}"*`,
        '',
        `**Answer:** "${winningCards.map(c => c.content).join(' / ')}"`,
        '',
        `🎉 **Winner: <@${winner.userId}>** (+1 point)`
      ].join('\n'))
      .addFields(
        {
          name: '🏆 **Updated Scores**',
          value: gameState.players
            .sort((a, b) => b.score - a.score)
            .map((p, i) => {
              const points = p.userId === winner.userId ? p.score + 1 : p.score;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎮';
              return `${medal} <@${p.userId}>: **${points}** pts`;
            })
            .join('\n'),
          inline: true
        },
        {
          name: '🎯 **Game Progress**',
          value: [
            `**Round:** ${gameState.game.currentRound}/${gameState.game.maxRounds}`,
            `**Win Condition:** ${(gameState.game.settings as any).winCondition || 5} points`,
            `**Status:** ${gameState.game.currentRound >= gameState.game.maxRounds ? 'Final Round!' : 'Continuing...'}`
          ].join('\n'),
          inline: true
        }
      )
      .setFooter({ text: 'Get ready for the next round!' })
      .setTimestamp();
  }

  /**
   * Create game over embed
   */
  static createGameOverEmbed(gameState: CahGameState, winner: CahGamePlayer): EmbedBuilder {
    const { players, game } = gameState;
    const finalScores = players.sort((a, b) => b.score - a.score);

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎊 Game Over - We Have a Winner!')
      .setDescription(`**🏆 Congratulations <@${winner.userId}>! 🏆**\n\nYou've won this round of Cards Against Humanity!`)
      .addFields(
        {
          name: '🏆 **Final Leaderboard**',
          value: finalScores.map((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎮';
            return `${medal} <@${p.userId}>: **${p.score}** points`;
          }).join('\n'),
          inline: false
        },
        {
          name: '📊 **Game Statistics**',
          value: [
            `**Total Rounds:** ${game.currentRound}`,
            `**Players:** ${players.length}`,
            `**Duration:** ${this.getGameDuration(game.startedAt, game.endedAt)}`,
            `**Most Points:** ${Math.max(...players.map(p => p.score))} points`
          ].join('\n'),
          inline: true
        },
        {
          name: '🎮 **Play Again?**',
          value: [
            'Thanks for playing Cards Against Humanity!',
            'Use `/cah create` to start another game.',
            'The inappropriateness never ends! 😈'
          ].join('\n'),
          inline: true
        }
      )
      .setFooter({ text: 'Cards Against Humanity • Thanks for playing!' })
      .setTimestamp();
  }

  /**
   * Create game status embed
   */
  static createStatusEmbed(gameState: CahGameState): EmbedBuilder {
    const { game, players, currentBlackCard, submissions, judgeId } = gameState;

    let statusColor = 0x4A90E2;
    let statusText = 'Unknown';

    switch (game.status) {
      case 'waiting':
        statusColor = 0xFFD700;
        statusText = '⏳ Waiting for players';
        break;
      case 'active':
        statusColor = 0x00D4AA;
        statusText = '🎮 Round in progress';
        break;
      case 'voting':
        statusColor = 0xFF6B6B;
        statusText = '⚖️ Judge is voting';
        break;
      case 'finished':
        statusColor = 0x9B59B6;
        statusText = '🏁 Game finished';
        break;
      case 'cancelled':
        statusColor = 0xFF4444;
        statusText = '❌ Game cancelled';
        break;
    }

    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle('🃏 Cards Against Humanity - Game Status')
      .setDescription(statusText)
      .addFields(
        {
          name: '🎮 **Game Info**',
          value: [
            `**Host:** <@${game.hostId}>`,
            `**Round:** ${game.currentRound}/${game.maxRounds}`,
            `**Players:** ${players.length}/${game.maxPlayers}`,
            `**Status:** ${statusText}`
          ].join('\n'),
          inline: true
        }
      );

    if (players.length > 0) {
      embed.addFields({
        name: '👥 **Players & Scores**',
        value: players
          .sort((a, b) => b.score - a.score)
          .map(p => `🎮 <@${p.userId}>: **${p.score}** pts`)
          .join('\n'),
        inline: true
      });
    }

    if (currentBlackCard && game.status === 'active') {
      embed.addFields(
        {
          name: '🃏 **Current Black Card**',
          value: `"${currentBlackCard.content}"\n*Pick ${currentBlackCard.pickCount} card(s)*`,
          inline: false
        },
        {
          name: '📊 **Round Progress**',
          value: [
            `**Judge:** <@${judgeId}>`,
            `**Submissions:** ${submissions.length}/${players.length - 1}`,
            `**Phase:** ${game.status === 'voting' ? 'Judge Decision' : 'Card Submission'}`
          ].join('\n'),
          inline: true
        }
      );
    }

    return embed;
  }

  /**
   * Create submission confirmation embed
   */
  static createSubmissionConfirmEmbed(submittedCards: CahWhiteCard[], blackCard: CahBlackCard): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00D4AA)
      .setTitle('✅ Cards Submitted!')
      .setDescription([
        'Your cards have been submitted for this round.',
        '',
        `**Black Card:** "${blackCard.content}"`,
        `**Your Answer:** "${submittedCards.map(c => c.content).join(' / ')}"`,
        '',
        'Wait for other players to submit, then the judge will choose the winner!'
      ].join('\n'))
      .setFooter({ text: 'Submission received • Good luck!' })
      .setTimestamp();
  }

  /**
   * Create error embed
   */
  static createErrorEmbed(message: string, details?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('❌ Error')
      .setDescription(message)
      .setTimestamp();

    if (details) {
      embed.addFields({
        name: '📋 **Details**',
        value: details,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Create help embed
   */
  static createHelpEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x4A90E2)
      .setTitle('🃏 Cards Against Humanity - Help')
      .setDescription('Learn how to play the most inappropriate party game!')
      .addFields(
        {
          name: '🎯 **How to Play**',
          value: [
            '1. **Host** creates a game with `/cah create`',
            '2. **Players** join with `/cah join` (3-10 players)',
            '3. **Host** starts with `/cah start`',
            '4. Each round, one player is the **Judge**',
            '5. **Judge** reads the black card aloud',
            '6. **Other players** submit white card(s) privately',
            '7. **Judge** picks the funniest combination',
            '8. Winner gets a point, first to win condition wins!'
          ].join('\n'),
          inline: false
        },
        {
          name: '🎮 **Commands**',
          value: [
            '• `/cah create` - Create new game',
            '• `/cah join` - Join active game',
            '• `/cah start` - Start game (host only)',
            '• `/cah hand` - View your cards (DM)',
            '• `/cah play` - Submit your cards',
            '• `/cah status` - View game status',
            '• `/cah leave` - Leave current game',
            '• `/cah cancel` - Cancel game (host only)'
          ].join('\n'),
          inline: true
        },
        {
          name: '⚙️ **Game Settings**',
          value: [
            '• **Max Players:** 3-10 players',
            '• **Max Rounds:** 5-20 rounds',
            '• **Win Condition:** 3-10 points',
            '• **Family Friendly:** Optional safe mode',
            '• **Card Sets:** Base, Gaming, Family, etc.'
          ].join('\n'),
          inline: true
        },
        {
          name: '🚨 **Important Notes**',
          value: [
            '⚠️ **Content Warning:** Game contains adult humor',
            '🔞 **Age Rating:** Mature content (17+)',
            '🏠 **Family Mode:** Use family-friendly option for cleaner content',
            '🤖 **DMs Required:** Bot sends cards via direct message'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Cards Against Humanity • A party game for horrible people' })
      .setTimestamp();
  }

  /**
   * Get formatted game duration
   */
  private static getGameDuration(startedAt: Date | null, endedAt: Date | null): string {
    if (!startedAt || !endedAt) return 'Unknown';
    
    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }
}