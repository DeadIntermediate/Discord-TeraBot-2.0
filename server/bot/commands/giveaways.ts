import {
  Client,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
  TimestampStyles
} from 'discord.js';
import { storage } from '../../storage';
import { info, error } from '../../utils/logger';

const createGiveawayCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('giveaway_create_modal')
      .setTitle('Create a Giveaway');

    const prizeInput = new TextInputBuilder()
      .setCustomId('prize')
      .setLabel('Prize')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('What are you giving away?')
      .setRequired(true)
      .setMaxLength(100);

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Duration (e.g. 30m, 2h, 1d, 1w)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30m')
      .setRequired(true)
      .setMaxLength(10);

    const winnersInput = new TextInputBuilder()
      .setCustomId('winners')
      .setLabel('Number of Winners')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1')
      .setRequired(false)
      .setMaxLength(2);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Additional giveaway details...')
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    );

    await interaction.showModal(modal);
  }
};

const giveawayManageCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway-manage')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(option =>
          option.setName('giveaway-id')
            .setDescription('Giveaway to end')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll giveaway winners')
        .addStringOption(option =>
          option.setName('giveaway-id')
            .setDescription('Giveaway to reroll')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all giveaways')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Active', value: 'active' },
              { name: 'Ended', value: 'ended' },
              { name: 'All', value: 'all' }
            ))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'end':
          await handleEndGiveaway(interaction);
          break;
        case 'reroll':
          await handleRerollGiveaway(interaction);
          break;
        case 'list':
          await handleListGiveaways(interaction);
          break;
      }
    } catch (err) {
      error(`Error in giveaway-manage ${subcommand}:`, err);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
};

export async function handleGiveawayCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const prize = interaction.fields.getTextInputValue('prize');
  const durationStr = interaction.fields.getTextInputValue('duration');
  const winnersStr = interaction.fields.getTextInputValue('winners');
  const description = interaction.fields.getTextInputValue('description') || `Win **${prize}**!`;

  const durationMs = parseDurationMs(durationStr);
  if (!durationMs) {
    await interaction.reply({ content: 'Invalid duration. Use formats like `30m`, `2h`, `1d`, `1w`.', ephemeral: true });
    return;
  }

  if (durationMs > 7 * 24 * 60 * 60 * 1000) {
    await interaction.reply({ content: 'Maximum duration is 7 days.', ephemeral: true });
    return;
  }

  const winnersCount = Math.max(1, Math.min(20, parseInt(winnersStr) || 1));

  try {
    const endsAt = new Date(Date.now() + durationMs);
    const channel = interaction.channel as TextChannel;

    const giveawayEmbed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`**Prize:** ${prize}\n\n${description}`)
      .addFields(
        { name: '🏆 Winners', value: winnersCount.toString(), inline: true },
        { name: '⏰ Ends', value: time(endsAt, TimestampStyles.RelativeTime), inline: true },
        { name: '🎯 Entries', value: '0', inline: true }
      )
      .setFooter({ text: 'Click the button below to enter!' })
      .setTimestamp(endsAt);

    const entryButton = new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel('🎉 Enter Giveaway')
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(entryButton);

    const giveawayMessage = await channel.send({
      embeds: [giveawayEmbed],
      components: [actionRow]
    });

    const giveaway = await storage.createGiveaway({
      serverId: interaction.guild.id,
      channelId: channel.id,
      messageId: giveawayMessage.id,
      hostId: interaction.user.id,
      title: prize,
      description,
      prize,
      winnerCount: winnersCount,
      requirements: {},
      endsAt,
    });

    await interaction.reply({ content: '✅ Giveaway created! Good luck everyone!', ephemeral: true });

    scheduleGiveaway(interaction.client, giveaway.id, durationMs);

  } catch (err) {
    error('Error creating giveaway from modal:', err);
    await interaction.reply({
      content: 'An error occurred while creating the giveaway.',
      ephemeral: true
    });
  }
}

export async function handleGiveawayAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.respond([]); return; }
  const focused = interaction.options.getFocused().toLowerCase();
  const subcommand = interaction.options.getSubcommand(false);

  try {
    const giveaways = subcommand === 'reroll'
      ? await storage.getEndedGiveaways(interaction.guild.id)
      : await storage.getActiveGiveaways(interaction.guild.id);

    const choices = giveaways
      .filter(g => g.prize.toLowerCase().includes(focused) || g.id.toString().includes(focused))
      .slice(0, 25)
      .map(g => ({
        name: `${g.prize} — ${(g.entries as string[]).length} entries`,
        value: g.id
      }));

    await interaction.respond(choices);
  } catch (err) {
    error('Error in giveaway autocomplete:', err);
    await interaction.respond([]);
  }
}

async function handleEndGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getString('giveaway-id', true);

  const giveaway = await storage.getGiveaway(giveawayId);
  if (!giveaway) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  if (!giveaway.isActive) {
    await interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
    return;
  }

  await endGiveaway(interaction.client, giveawayId);
  await interaction.reply({ content: 'Giveaway ended successfully!', ephemeral: true });
}

async function handleRerollGiveaway(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getString('giveaway-id', true);

  const giveaway = await storage.getGiveaway(giveawayId);
  if (!giveaway) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  if (giveaway.isActive) {
    await interaction.reply({ content: 'Cannot reroll an active giveaway.', ephemeral: true });
    return;
  }

  const entries = giveaway.entries as string[] || [];
  if (entries.length === 0) {
    await interaction.reply({ content: 'No entries to reroll.', ephemeral: true });
    return;
  }

  const newWinners = selectRandomWinners(entries, Number(giveaway.winnerCount || 1));

  await storage.updateGiveaway(giveaway.id, { winners: newWinners });

  const channel = interaction.guild?.channels.cache.get(giveaway.channelId) as TextChannel;
  if (channel) {
    const winnerMentions = newWinners.map(id => `<@${id}>`).join(', ');

    const rerollEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🔄 Giveaway Rerolled!')
      .setDescription(`**Prize:** ${giveaway.prize}\n\n**New Winners:** ${winnerMentions}`)
      .setTimestamp();

    await channel.send({ embeds: [rerollEmbed] });
  }

  await interaction.reply({ content: 'Giveaway rerolled successfully!', ephemeral: true });
}

async function handleListGiveaways(interaction: ChatInputCommandInteraction) {
  const status = interaction.options.getString('status') || 'all';

  let giveaways: any[];
  if (status === 'active') {
    giveaways = await storage.getActiveGiveaways(interaction.guild!.id);
  } else if (status === 'ended') {
    giveaways = await storage.getEndedGiveaways(interaction.guild!.id);
  } else {
    const [active, ended] = await Promise.all([
      storage.getActiveGiveaways(interaction.guild!.id),
      storage.getEndedGiveaways(interaction.guild!.id),
    ]);
    giveaways = [...active, ...ended];
  }

  if (giveaways.length === 0) {
    await interaction.reply({ content: `No ${status} giveaways found.`, ephemeral: true });
    return;
  }

  const giveawayList = giveaways.slice(0, 10).map(giveaway => {
    const statusEmoji = giveaway.isActive ? '🟢' : '🔴';
    const entries = (giveaway.entries as string[] || []).length;
    return `${statusEmoji} **${giveaway.prize}** | ${entries} entries | <#${giveaway.channelId}> | \`${String(giveaway.id).slice(-8)}\``;
  }).join('\n');

  const listEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎉 Giveaways (${status})`)
    .setDescription(giveawayList)
    .setFooter({ text: `Showing ${Math.min(giveaways.length, 10)} of ${giveaways.length} giveaways` })
    .setTimestamp();

  await interaction.reply({ embeds: [listEmbed], ephemeral: true });
}

function scheduleGiveaway(client: Client, giveawayId: string, delayMs: number) {
  setTimeout(() => endGiveaway(client, giveawayId), delayMs);
}

export async function recoverGiveaways(client: Client): Promise<void> {
  const activeGiveaways = await storage.getActiveGiveaways();
  const now = Date.now();
  let scheduled = 0;
  let ended = 0;

  for (const giveaway of activeGiveaways) {
    const msRemaining = giveaway.endsAt.getTime() - now;
    if (msRemaining <= 0) {
      await endGiveaway(client, giveaway.id);
      ended++;
    } else {
      scheduleGiveaway(client, giveaway.id, msRemaining);
      scheduled++;
    }
  }

  info(`🎉 Giveaway recovery: ${ended} ended immediately, ${scheduled} rescheduled`);
}

export async function endGiveaway(client: Client, giveawayId: string): Promise<void> {
  try {
    const giveaway = await storage.getGiveaway(giveawayId);
    if (!giveaway || !giveaway.isActive) return;

    const entries = giveaway.entries as string[] || [];
    const winners = selectRandomWinners(entries, Number(giveaway.winnerCount || 1));

    await storage.updateGiveaway(giveaway.id, { isActive: false, winners });

    const channel = await client.channels.fetch(giveaway.channelId) as TextChannel;
    const message = await channel.messages.fetch(giveaway.messageId);

    const endedEmbed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('🎉 GIVEAWAY ENDED 🎉')
      .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
      .addFields(
        { name: '🏆 Winners', value: String(giveaway.winnerCount ?? 0), inline: true },
        { name: '⏰ Ended', value: time(giveaway.endsAt, TimestampStyles.RelativeTime), inline: true },
        { name: '🎯 Total Entries', value: entries.length.toString(), inline: true }
      )
      .setFooter({ text: 'This giveaway has ended!' })
      .setTimestamp();

    if (winners.length > 0) {
      endedEmbed.addFields({ name: '🎊 Winners', value: winners.map(id => `<@${id}>`).join(', '), inline: false });
    } else {
      endedEmbed.addFields({ name: '😔 No Winners', value: 'Not enough valid entries.', inline: false });
    }

    const disabledButton = new ButtonBuilder()
      .setCustomId('giveaway_enter_disabled')
      .setLabel('🎉 Giveaway Ended')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    await message.edit({
      embeds: [endedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton)]
    });

    if (winners.length > 0) {
      const winnerEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎊 Congratulations!')
        .setDescription(`${winners.map(id => `<@${id}>`).join(', ')} won **${giveaway.prize}**!`)
        .setTimestamp();

      await channel.send({ embeds: [winnerEmbed] });
    }

  } catch (err) {
    error('Error ending giveaway:', err);
  }
}

function parseDurationMs(str: string): number | null {
  const match = str.trim().match(/^(\d+)(m|h|d|w)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return value * multipliers[unit];
}

function selectRandomWinners(entries: string[], winnerCount: number): string[] {
  if (entries.length === 0) return [];
  const uniqueEntries = [...new Set(entries)];
  const actualWinnerCount = Math.min(winnerCount, uniqueEntries.length);
  const winners = [];
  const entriesCopy = [...uniqueEntries];
  for (let i = 0; i < actualWinnerCount; i++) {
    const randomIndex = Math.floor(Math.random() * entriesCopy.length);
    winners.push(entriesCopy.splice(randomIndex, 1)[0]);
  }
  return winners;
}

export const giveawayCommands = [createGiveawayCommand, giveawayManageCommand];
