/**
 * ValidationHelpers - Reusable validation functions for commands
 * Provides common validation patterns
 */

import { ChatInputCommandInteraction, GuildMember, User } from 'discord.js';
import { ResponseBuilder } from './ResponseBuilder';

export class ValidationHelpers {
  /**
   * Validate command is used in a guild
   */
  static async requireGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.guild) {
      await interaction.reply(
        ResponseBuilder.error('Guild Required').setDescription(
          'This command can only be used in a server.'
        ).setEphemeral().build()
      );
      return false;
    }
    return true;
  }

  /**
   * Validate member exists and is fetchable
   */
  static async requireMember(
    interaction: ChatInputCommandInteraction,
    userId: string
  ): Promise<GuildMember | null> {
    if (!interaction.guild) {
      await interaction.reply(
        ResponseBuilder.error('Guild Required').setEphemeral().build()
      );
      return null;
    }

    try {
      const member = await interaction.guild.members.fetch(userId);
      return member;
    } catch (err) {
      await interaction.reply(
        ResponseBuilder.error('User Not Found').setDescription(
          'Could not find the specified user in this server.'
        ).setEphemeral().build()
      );
      return null;
    }
  }

  /**
   * Validate user has permission
   */
  static async requirePermission(
    interaction: ChatInputCommandInteraction,
    permission: bigint
  ): Promise<boolean> {
    if (!interaction.member || typeof interaction.member.permissions === 'string') {
      await interaction.reply(
        ResponseBuilder.error('Permission Denied').setEphemeral().build()
      );
      return false;
    }

    if (!interaction.member.permissions.has(permission)) {
      await interaction.reply(
        ResponseBuilder.error('Insufficient Permissions').setDescription(
          'You do not have permission to use this command.'
        ).setEphemeral().build()
      );
      return false;
    }

    return true;
  }

  /**
   * Validate bot can interact with target
   */
  static async validateBotCanInteract(
    interaction: ChatInputCommandInteraction,
    target: GuildMember | User
  ): Promise<boolean> {
    if (!interaction.guild) return true;

    try {
      if (target instanceof GuildMember) {
        // Check if bot has higher role
        const botMember = await interaction.guild.members.fetchMe();
        const comparison = botMember.roles.highest.comparePositionTo(target.roles.highest);
        if (comparison <= 0) {
          await interaction.reply(
            ResponseBuilder.error('Insufficient Bot Permissions').setDescription(
              'I do not have a high enough role to interact with this member.'
            ).setEphemeral().build()
          );
          return false;
        }
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Validate string input length
   */
  static async validateStringLength(
    interaction: ChatInputCommandInteraction,
    input: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'Input'
  ): Promise<boolean> {
    if (input.length < minLength || input.length > maxLength) {
      await interaction.reply(
        ResponseBuilder.error('Invalid Input').setDescription(
          `${fieldName} must be between ${minLength} and ${maxLength} characters.`
        ).setEphemeral().build()
      );
      return false;
    }
    return true;
  }

  /**
   * Validate number is in range
   */
  static async validateNumberRange(
    interaction: ChatInputCommandInteraction,
    value: number,
    min: number,
    max: number,
    fieldName: string = 'Value'
  ): Promise<boolean> {
    if (value < min || value > max) {
      await interaction.reply(
        ResponseBuilder.error('Invalid Input').setDescription(
          `${fieldName} must be between ${min} and ${max}.`
        ).setEphemeral().build()
      );
      return false;
    }
    return true;
  }
}
