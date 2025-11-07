import { ChatInputCommandInteraction, BaseInteraction } from 'discord.js';

/**
 * Centralized response message templates
 * Eliminates duplicate ephemeral response patterns
 */
export const ResponseMessages = {
  // Success messages
  SUCCESS: (msg: string) => ({ content: `✅ ${msg}`, ephemeral: true }),
  
  // Error messages
  ERROR: (msg: string) => ({ content: `❌ ${msg}`, ephemeral: true }),
  COMMAND_ERROR: () => ({
    content: '❌ An error occurred while processing your request.',
    ephemeral: true
  }),
  
  // Info messages
  INFO: (msg: string) => ({ content: `ℹ️ ${msg}`, ephemeral: true }),
  WARNING: (msg: string) => ({ content: `⚠️ ${msg}`, ephemeral: true }),
  
  // Common command errors
  GUILD_ONLY: () => ({ 
    content: '❌ This command can only be used in a server.', 
    ephemeral: true 
  }),
  CHANNEL_ONLY: (type: string) => ({
    content: `❌ This command can only be used in ${type} channels.`,
    ephemeral: true
  }),
  PERMISSIONS_MISSING: (permission: string) => ({
    content: `❌ You need the ${permission} permission to use this command.`,
    ephemeral: true
  }),
  BOT_PERMISSIONS_MISSING: (permission: string) => ({
    content: `❌ I need the ${permission} permission to execute this command.`,
    ephemeral: true
  }),
  
  // Database errors
  DB_ERROR: () => ({
    content: '❌ Database error. Please try again later.',
    ephemeral: true
  }),
  DB_NOT_AVAILABLE: () => ({
    content: '❌ Database connection not available!',
    ephemeral: true
  }),
  
  // API errors
  API_ERROR: (service: string = 'external service') => ({
    content: `❌ Failed to connect to ${service}. Please try again later.`,
    ephemeral: true
  }),
} as const;

/**
 * Helper to send error reply with proper deferred state handling
 */
export async function replyError(
  interaction: ChatInputCommandInteraction | BaseInteraction,
  message: string = 'Command failed'
): Promise<void> {
  const response = ResponseMessages.ERROR(message);
  
  if (interaction instanceof ChatInputCommandInteraction) {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
}

/**
 * Helper to send success reply with proper deferred state handling
 */
export async function replySuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const response = ResponseMessages.SUCCESS(message);
  
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
  } else {
    await interaction.reply(response);
  }
}

/**
 * Helper to edit deferred reply (for long-running operations)
 */
export async function editReplyError(
  interaction: ChatInputCommandInteraction,
  message: string = 'Command failed'
): Promise<void> {
  await interaction.editReply({ content: `❌ ${message}` });
}

export async function editReplySuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.editReply({ content: `✅ ${message}` });
}
