import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';

const kickCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.kickable) {
        await interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
        return;
      }

      await member.kick(reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'kick',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('User Kicked')
        .setDescription(`${user.tag} has been kicked from the server.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error kicking user:', error);
      await interaction.reply({ content: 'An error occurred while kicking the user.', ephemeral: true });
    }
  },
};

const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_messages')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await interaction.guild.bans.create(user.id, {
        reason,
        deleteMessageDays,
      });

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'ban',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff4757)
        .setTitle('User Banned')
        .setDescription(`${user.tag} has been banned from the server.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error banning user:', error);
      await interaction.reply({ content: 'An error occurred while banning the user.', ephemeral: true });
    }
  },
};

const muteCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)) // 28 days max
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.moderatable) {
        await interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });
        return;
      }

      const timeoutEnd = new Date(Date.now() + duration * 60000);
      await member.timeout(duration * 60000, reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'mute',
        reason,
        duration,
        channelId: interaction.channel?.id,
        expiresAt: timeoutEnd,
      });

      const embed = new EmbedBuilder()
        .setColor(0xffa502)
        .setTitle('User Timed Out')
        .setDescription(`${user.tag} has been timed out.`)
        .addFields(
          { name: 'Duration', value: `${duration} minutes`, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error timing out user:', error);
      await interaction.reply({ content: 'An error occurred while timing out the user.', ephemeral: true });
    }
  },
};

const clearCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    
    if (!interaction.channel || !('bulkDelete' in interaction.channel)) {
      await interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
      return;
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);

      // Log to database
      if (interaction.guild) {
        await storage.createModerationLog({
          serverId: interaction.guild.id,
          moderatorId: interaction.user.id,
          targetUserId: interaction.user.id, // Self for bulk delete
          action: 'clear',
          reason: `Cleared ${deleted.size} messages`,
          channelId: interaction.channel.id,
        });
      }

      await interaction.reply({ 
        content: `Successfully deleted ${deleted.size} messages.`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error clearing messages:', error);
      await interaction.reply({ 
        content: 'An error occurred while clearing messages.', 
        ephemeral: true 
      });
    }
  },
};

export const moderationCommands = [
  kickCommand,
  banCommand,
  muteCommand,
  clearCommand,
];
