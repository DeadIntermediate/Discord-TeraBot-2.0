import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  TextChannel,
  time,
  TimestampStyles
} from 'discord.js';
import { storage } from '../../storage';

const createGiveawayCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(option =>
      option.setName('prize')
        .setDescription('What is being given away')
        .setRequired(true)
        .setMaxLength(100))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080)) // Max 1 week
    .addIntegerOption(option =>
      option.setName('winners')
        .setDescription('Number of winners')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Giveaway description')
        .setRequired(false)
        .setMaxLength(1000))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post the giveaway')
        .setRequired(false))
    .addRoleOption(option =>
      option.setName('required-role')
        .setDescription('Role required to enter')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('min-account-age')
        .setDescription('Minimum account age in days')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(365)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const prize = interaction.options.getString('prize', true);
    const durationMinutes = interaction.options.getInteger('duration', true);
    const winnersCount = interaction.options.getInteger('winners') || 1;
    const description = interaction.options.getString('description') || `Win **${prize}**!`;
    const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;
    const requiredRole = interaction.options.getRole('required-role');
    const minAccountAge = interaction.options.getInteger('min-account-age') || 0;

    try {
      // Calculate end time
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Create requirements object
      const requirements: any = {};
      if (requiredRole) {
        requirements.requiredRoleId = requiredRole.id;
      }
      if (minAccountAge > 0) {
        requirements.minAccountAgeDays = minAccountAge;
      }

      // Create giveaway embed
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

      // Add requirements field if any
      const requirementsList = [];
      if (requiredRole) {
        requirementsList.push(`• Must have ${requiredRole.toString()} role`);
      }
      if (minAccountAge > 0) {
        requirementsList.push(`• Account must be at least ${minAccountAge} days old`);
      }
      
      if (requirementsList.length > 0) {
        giveawayEmbed.addFields({
          name: '📋 Requirements',
          value: requirementsList.join('\n'),
          inline: false
        });
      }

      // Create entry button
      const entryButton = new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel('🎉 Enter Giveaway')
        .setStyle(ButtonStyle.Primary);

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(entryButton);

      // Send giveaway message
      const giveawayMessage = await channel.send({
        embeds: [giveawayEmbed],
        components: [actionRow]
      });

      // Save to database
      const giveaway = await storage.createGiveaway({
        serverId: interaction.guild.id,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        hostId: interaction.user.id,
        title: prize,
        description: description,
        prize: prize,
        winnerCount: winnersCount,
        requirements: requirements,
        endsAt: endsAt,
      });

      await interaction.reply({
        content: `✅ Giveaway created successfully! Check ${channel.toString()}`,
        ephemeral: true
      });

      // Schedule giveaway end (in a real implementation, you'd use a proper job scheduler)
      setTimeout(async () => {
        await endGiveaway(giveaway.id);
      }, durationMinutes * 60 * 1000);

    } catch (error) {
      console.error('Error creating giveaway:', error);
      await interaction.reply({
        content: 'An error occurred while creating the giveaway.',
        ephemeral: true
      });
    }
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
            .setDescription('Giveaway ID to end')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll giveaway winners')
        .addStringOption(option =>
          option.setName('giveaway-id')
            .setDescription('Giveaway ID to reroll')
            .setRequired(true)))
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
    } catch (error) {
      console.error(`Error in giveaway-manage ${subcommand}:`, error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
};

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

  await endGiveaway(giveawayId);
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

  // Select new winners
  const newWinners = selectRandomWinners(entries, giveaway.winnerCount);
  
  // Update giveaway with new winners
  await storage.updateGiveaway(giveaway.id, {
    winners: newWinners
  });

  // Announce new winners
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
  
  let giveaways;
  if (status === 'active') {
    giveaways = await storage.getActiveGiveaways(interaction.guild!.id);
  } else if (status === 'ended') {
    // This would need a new storage method for ended giveaways
    giveaways = []; // Placeholder
  } else {
    giveaways = await storage.getActiveGiveaways(interaction.guild!.id);
  }

  if (giveaways.length === 0) {
    await interaction.reply({ content: `No ${status} giveaways found.`, ephemeral: true });
    return;
  }

  const giveawayList = giveaways.slice(0, 10).map(giveaway => {
    const statusEmoji = giveaway.isActive ? '🟢' : '🔴';
    const entries = (giveaway.entries as string[] || []).length;
    
    return `${statusEmoji} **${giveaway.prize}** | ${entries} entries | <#${giveaway.channelId}> | \`${giveaway.id.slice(-8)}\``;
  }).join('\n');

  const listEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎉 Giveaways (${status})`)
    .setDescription(giveawayList)
    .setFooter({ text: `Showing ${Math.min(giveaways.length, 10)} of ${giveaways.length} giveaways` })
    .setTimestamp();

  await interaction.reply({ embeds: [listEmbed], ephemeral: true });
}

async function endGiveaway(giveawayId: string) {
  try {
    const giveaway = await storage.getGiveaway(giveawayId);
    if (!giveaway || !giveaway.isActive) {
      return;
    }

    const entries = giveaway.entries as string[] || [];
    const winners = selectRandomWinners(entries, giveaway.winnerCount);

    // Update giveaway
    await storage.updateGiveaway(giveaway.id, {
      isActive: false,
      winners: winners
    });

    // Get the channel and message
    const client = require('../index').client; // This is a hack, in a real app you'd pass the client properly
    const channel = await client.channels.fetch(giveaway.channelId) as TextChannel;
    const message = await channel.messages.fetch(giveaway.messageId);

    // Update the original message
    const endedEmbed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('🎉 GIVEAWAY ENDED 🎉')
      .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
      .addFields(
        { name: '🏆 Winners', value: giveaway.winnerCount.toString(), inline: true },
        { name: '⏰ Ended', value: time(giveaway.endsAt, TimestampStyles.RelativeTime), inline: true },
        { name: '🎯 Total Entries', value: entries.length.toString(), inline: true }
      )
      .setFooter({ text: 'This giveaway has ended!' })
      .setTimestamp();

    if (winners.length > 0) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      endedEmbed.addFields({
        name: '🎊 Winners',
        value: winnerMentions,
        inline: false
      });
    } else {
      endedEmbed.addFields({
        name: '😔 No Winners',
        value: 'Not enough valid entries.',
        inline: false
      });
    }

    // Disable the button
    const disabledButton = new ButtonBuilder()
      .setCustomId('giveaway_enter_disabled')
      .setLabel('🎉 Giveaway Ended')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(disabledButton);

    await message.edit({
      embeds: [endedEmbed],
      components: [actionRow]
    });

    // Announce winners
    if (winners.length > 0) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      
      const winnerEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎊 Congratulations!')
        .setDescription(`**${winnerMentions}** won **${giveaway.prize}**!`)
        .setTimestamp();

      await channel.send({ embeds: [winnerEmbed] });
    }

  } catch (error) {
    console.error('Error ending giveaway:', error);
  }
}

function selectRandomWinners(entries: string[], winnerCount: number): string[] {
  if (entries.length === 0) return [];
  
  const uniqueEntries = [...new Set(entries)]; // Remove duplicates
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