/**
 * CommandManager - Centralized command handling and registration
 * Provides utilities for command execution, error handling, and permissions
 */

import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  PermissionResolvable,
  EmbedBuilder,
  PermissionsBitField,
  InteractionReplyOptions
} from 'discord.js';
import { error, warn, debug } from '../../utils/logger';

export interface Command {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  cooldown?: number; // milliseconds
  requiredPermissions?: PermissionResolvable[];
}

/**
 * Centralized command execution with built-in error handling
 */
export class CommandManager {
  private cooldowns = new Map<string, Map<string, number>>();

  async executeCommand(command: Command, interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check permissions
      if (command.requiredPermissions && interaction.member) {
        const perms = interaction.member.permissions;
        if (typeof perms !== 'string' && !perms.has(command.requiredPermissions)) {
          await this.sendPermissionError(interaction, command.requiredPermissions.toString());
          return;
        }
      }

      // Check cooldown
      if (command.cooldown && !await this.checkCooldown(command, interaction)) {
        return;
      }

      // Execute command
      await command.execute(interaction);

      // Set cooldown
      if (command.cooldown) {
        this.setCooldown(command, interaction.user.id);
      }

      debug(`✅ Command executed: ${interaction.commandName} by ${interaction.user.tag}`);
    } catch (err) {
      await this.handleCommandError(interaction, err);
    }
  }

  private async checkCooldown(command: Command, interaction: ChatInputCommandInteraction): Promise<boolean> {
    const commandName = command.data.name;
    const userId = interaction.user.id;

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const now = Date.now();
    const userCooldown = this.cooldowns.get(commandName)!;

      if (userCooldown.has(userId)) {
        const expirationTime = userCooldown.get(userId)!;
        if (now < expirationTime) {
          const remainingTime = ((expirationTime - now) / 1000).toFixed(1);
          await interaction.reply({
            content: `⏱️ Please wait ${remainingTime}s before using this command again.`,
            ephemeral: true,
          });
          return false;
        }
      }    return true;
  }

  private setCooldown(command: Command, userId: string): void {
    const commandName = command.data.name;
    const now = Date.now();
    const cooldownAmount = command.cooldown || 3000;

    const expirationTime = now + cooldownAmount;
    this.cooldowns.get(commandName)?.set(userId, expirationTime);

    // Clean up expired cooldowns
    setTimeout(() => {
      this.cooldowns.get(commandName)?.delete(userId);
    }, cooldownAmount);
  }

  private async sendPermissionError(
    interaction: ChatInputCommandInteraction,
    permission: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Permission Denied')
      .setDescription(`You need the \`${permission}\` permission to use this command.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleCommandError(
    interaction: ChatInputCommandInteraction,
    err: any
  ): Promise<void> {
    error(`❌ Error executing command ${interaction.commandName}:`, err);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Command Error')
      .setDescription('An error occurred while executing this command.')
      .addFields({
        name: 'Error Details',
        value: err instanceof Error ? err.message : 'Unknown error',
        inline: false,
      })
      .setTimestamp();

    const errorMessage: InteractionReplyOptions = { embeds: [embed], ephemeral: true };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyErr) {
      error('Failed to send error message:', replyErr);
    }
  }
}

export const commandManager = new CommandManager();
