/**
 * Example Moderation Command using new framework
 * Demonstrates best practices with CommandManager, ResponseBuilder, and ValidationHelpers
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { storage } from '../../storage';
import { Command } from '../framework';
import { ResponseBuilder } from '../framework/ResponseBuilder';
import { ValidationHelpers } from '../framework/ValidationHelpers';

/**
 * Kick command - Demonstrates proper command structure
 */
export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers) as SlashCommandBuilder,

  cooldown: 5000, // 5 second cooldown
  requiredPermissions: [PermissionFlagsBits.KickMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    // Validate command context
    if (!(await ValidationHelpers.requireGuild(interaction))) return;

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Fetch target member
    const targetMember = await ValidationHelpers.requireMember(
      interaction,
      targetUser.id
    );
    if (!targetMember) return;

    // Verify bot can interact with member
    if (!(await ValidationHelpers.validateBotCanInteract(interaction, targetMember))) return;

    // Prevent kicking self
    if (targetUser.id === interaction.client.user.id) {
      await interaction.reply(
        ResponseBuilder.error('Invalid Target')
          .setDescription('I cannot kick myself.')
          .setEphemeral()
          .build()
      );
      return;
    }

    // Prevent kicking the command user
    if (targetUser.id === interaction.user.id) {
      await interaction.reply(
        ResponseBuilder.error('Invalid Target')
          .setDescription('You cannot kick yourself.')
          .setEphemeral()
          .build()
      );
      return;
    }

    // Validate member can be kicked
    if (!targetMember.kickable) {
      await interaction.reply(
        ResponseBuilder.error('Cannot Kick Member')
          .setDescription('I do not have permission to kick this member.')
          .setEphemeral()
          .build()
      );
      return;
    }

    // Perform kick
    try {
      await targetMember.kick(reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild!.id,
        moderatorId: interaction.user.id,
        targetUserId: targetUser.id,
        action: 'kick',
        reason,
        channelId: interaction.channel?.id,
      });

      // Send success response
      await interaction.reply(
        ResponseBuilder.success('User Kicked')
          .addFields(
            { name: 'User', value: targetUser.tag, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .build()
      );
    } catch (err) {
      await interaction.reply(
        ResponseBuilder.error('Kick Failed')
          .setDescription('An error occurred while kicking the user.')
          .setEphemeral()
          .build()
      );
      throw err;
    }
  },
};

/**
 * Ban command - Demonstrates ban functionality
 */
export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('delete_messages')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  cooldown: 5000,
  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ValidationHelpers.requireGuild(interaction))) return;

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessageDays = interaction.options.getInteger('delete_messages') ?? 0;

    // Fetch target member
    const targetMember = await ValidationHelpers.requireMember(
      interaction,
      targetUser.id
    );
    if (!targetMember) return;

    // Verify bot can interact
    if (!(await ValidationHelpers.validateBotCanInteract(interaction, targetMember))) return;

    // Validate bot has ban permission
    if (!interaction.guild!.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply(
        ResponseBuilder.error('Missing Permissions')
          .setDescription('I do not have permission to ban members.')
          .setEphemeral()
          .build()
      );
      return;
    }

    try {
      await interaction.guild!.bans.create(targetUser.id, {
        reason,
        deleteMessageDays,
      });

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild!.id,
        moderatorId: interaction.user.id,
        targetUserId: targetUser.id,
        action: 'ban',
        reason,
        channelId: interaction.channel?.id,
      });

      await interaction.reply(
        ResponseBuilder.success('User Banned')
          .addFields(
            { name: 'User', value: targetUser.tag, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Message Deletion', value: `${deleteMessageDays} days`, inline: true }
          )
          .build()
      );
    } catch (err) {
      await interaction.reply(
        ResponseBuilder.error('Ban Failed')
          .setDescription('An error occurred while banning the user.')
          .setEphemeral()
          .build()
      );
      throw err;
    }
  },
};

export const moderationCommands = [kickCommand, banCommand];
