import { Interaction, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { handleEmbedBuilderInteraction } from '../commands/embeds';
import { handleStreamButtons, handleStreamModal } from '../commands/streams';
import { cooldownManager } from '../../utils/cooldownManager';
import { rateLimiter } from '../../utils/rateLimiter';
import { errorReporter } from '../../utils/errorReporter';
import { commandAnalytics } from '../../utils/commandAnalytics';
import { error as logError } from '../../utils/logger';

export async function interactionCreateHandler(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModalInteraction(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenuInteraction(interaction);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const command = (interaction.client as any).commands.get(interaction.commandName);

  if (!command) {
    logError(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  const startTime = Date.now();
  const userId = interaction.user.id;
  const guildId = interaction.guildId || undefined;
  const isBypassed = cooldownManager.isBypassed(userId, guildId) || rateLimiter.isBypassed(userId);

  try {
    // Check rate limit first (global limit across all commands)
    if (!isBypassed) {
      const rateLimitCheck = rateLimiter.checkLimit(userId);
      
      if (!rateLimitCheck.allowed) {
        await interaction.reply({
          content: rateLimitCheck.message,
          ephemeral: true
        });
        
        await commandAnalytics.recordCommand({
          commandName: interaction.commandName,
          userId,
          ...(guildId && { guildId }),
          success: false,
          errorMessage: 'Rate limit exceeded'
        });
        
        return;
      }
    }

    // Check cooldown (per-command limit)
    if (!isBypassed) {
      const cooldownCheck = cooldownManager.checkCooldown(userId, interaction.commandName);
      
      if (cooldownCheck.isOnCooldown) {
        await interaction.reply({
          content: `⏰ ${cooldownCheck.message}`,
          ephemeral: true
        });
        
        await commandAnalytics.recordCommand({
          commandName: interaction.commandName,
          userId,
          ...(guildId && { guildId }),
          success: false,
          errorMessage: 'Command on cooldown'
        });
        
        return;
      }
    }

    // Execute command
    await command.execute(interaction);
    
    // Record command usage for rate limiting and cooldowns
    if (!isBypassed) {
      rateLimiter.recordCommand(userId);
      cooldownManager.setCooldown(userId, interaction.commandName);
    }
    
    // Record successful command execution
    const executionTime = Date.now() - startTime;
    await commandAnalytics.recordCommand({
      commandName: interaction.commandName,
      userId,
      ...(guildId && { guildId }),
      success: true,
      executionTime
    });
  } catch (error) {
    logError('Error executing command:', error);
    
    // Report and record error
    if (error instanceof Error) {
      await errorReporter.reportCommandError(
        error,
        interaction.commandName,
        userId,
        guildId
      );
      
      const executionTime = Date.now() - startTime;
      await commandAnalytics.recordCommand({
        commandName: interaction.commandName,
        userId,
        ...(guildId && { guildId }),
        success: false,
        executionTime,
        errorMessage: error.message
      });
    }
    
    // Reply to user
    const errorMessage = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

/**
 * Helper function to safely reply with error messages
 */
async function replyWithError(interaction: any, message: string) {
  const errorMessage = { content: message, ephemeral: true };
  
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(errorMessage);
  } else {
    await interaction.reply(errorMessage);
  }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  try {
    const { customId } = interaction;

    // Route to appropriate handler
    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
    } else if (customId.startsWith('stream_add_')) {
      await handleStreamButtons(interaction);
    } else if (customId.startsWith('ticket_close_')) {
      await handleTicketClose(interaction);
    } else if (customId.startsWith('ticket_assign_')) {
      await handleTicketAssign(interaction);
    } else if (customId.startsWith('ticket_priority_')) {
      await handleTicketPriority(interaction);
    } else if (customId === 'giveaway_enter') {
      await handleGiveawayEntry(interaction);
    }
  } catch (error) {
    logError('Error handling button interaction:', error);
    await replyWithError(interaction, 'There was an error while processing this action!');
  }
}

async function handleModalInteraction(interaction: ModalSubmitInteraction) {
  try {
    const { customId } = interaction;

    // Route to appropriate handler
    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
    } else if (customId.startsWith('stream_modal_')) {
      await handleStreamModal(interaction);
    }
  } catch (error) {
    logError('Error handling modal interaction:', error);
    await replyWithError(interaction, 'There was an error while processing this modal!');
  }
}

async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
  try {
    const { customId } = interaction;

    // Route to appropriate handler
    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
    }
  } catch (error) {
    logError('Error handling select menu interaction:', error);
    await replyWithError(interaction, 'There was an error while processing this selection!');
  }
}

async function handleTicketClose(interaction: ButtonInteraction) {
  const ticketId = interaction.customId.replace('ticket_close_', '');
  const ticket = await storage.getTicket(ticketId);

  if (!ticket) {
    await replyWithError(interaction, 'Ticket not found.');
    return;
  }

  if (ticket.status === 'closed') {
    await replyWithError(interaction, 'This ticket is already closed.');
    return;
  }

  // Update ticket status
  await storage.updateTicket(ticket.id, {
    status: 'closed',
    closedAt: new Date(),
  });

  const closeEmbed = new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket has been closed by ${interaction.user.toString()}`)
    .addFields(
      { name: 'Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [closeEmbed] });

  // Delete channel after 10 seconds
  setTimeout(async () => {
    try {
      const channel = interaction.guild?.channels.cache.get(ticket.channelId);
      if (channel) {
        await channel.delete('Ticket closed');
      }
    } catch (error) {
      logError('Error deleting ticket channel:', error);
    }
  }, 10000);
}

async function handleTicketAssign(interaction: ButtonInteraction) {
  const ticketId = interaction.customId.replace('ticket_assign_', '');
  const ticket = await storage.getTicket(ticketId);

  if (!ticket) {
    await replyWithError(interaction, 'Ticket not found.');
    return;
  }

  if (ticket.assignedTo === interaction.user.id) {
    await replyWithError(interaction, 'This ticket is already assigned to you.');
    return;
  }

  await storage.updateTicket(ticket.id, {
    assignedTo: interaction.user.id,
  });

  const assignEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('👤 Ticket Assigned')
    .setDescription(`This ticket has been assigned to ${interaction.user.toString()}`)
    .setTimestamp();

  await interaction.reply({ embeds: [assignEmbed] });
}

async function handleTicketPriority(interaction: ButtonInteraction) {
  await replyWithError(
    interaction,
    'Priority change feature is not yet implemented. Use `/ticket-manage` for now.'
  );
}

async function handleGiveawayEntry(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await replyWithError(interaction, 'This can only be used in a server.');
    return;
  }

  try {
    // Find the giveaway by message ID
    const giveaways = await storage.getActiveGiveaways(interaction.guild.id);
    const giveaway = giveaways.find(g => g.messageId === interaction.message.id);

    if (!giveaway || !giveaway.isActive) {
      await replyWithError(interaction, 'This giveaway was not found or has ended.');
      return;
    }

    // Get member and validate
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) {
      await replyWithError(interaction, 'Could not verify your server membership.');
      return;
    }

    // Check requirements
    const requirements = (giveaway.requirements as any) || {};
    
    if (requirements.requiredRoleId && !member.roles.cache.has(requirements.requiredRoleId)) {
      await replyWithError(
        interaction,
        `You need the <@&${requirements.requiredRoleId}> role to enter this giveaway.`
      );
      return;
    }

    if (requirements.minAccountAgeDays) {
      const accountAgeDays = Math.floor(
        (Date.now() - interaction.user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (accountAgeDays < requirements.minAccountAgeDays) {
        await replyWithError(
          interaction,
          `Your account must be at least ${requirements.minAccountAgeDays} days old to enter this giveaway.`
        );
        return;
      }
    }

    // Check if user already entered
    const currentEntries = (giveaway.entries as string[]) || [];
    if (currentEntries.includes(interaction.user.id)) {
      await replyWithError(interaction, 'You have already entered this giveaway!');
      return;
    }

    // Add user to entries
    const newEntries = [...currentEntries, interaction.user.id];
    await storage.updateGiveaway(giveaway.id, { entries: newEntries });

    // Update the embed with new entry count
    const currentEmbed = interaction.message.embeds[0];
    if (currentEmbed) {
      const updatedEmbed = EmbedBuilder.from(currentEmbed);
      
      // Update entries field
      const fields = updatedEmbed.data.fields || [];
      const entriesField = fields.find(field => field.name === '🎯 Entries');
      if (entriesField) {
        entriesField.value = newEntries.length.toString();
      }

      await interaction.update({
        embeds: [updatedEmbed],
        components: interaction.message.components
      });
    }

    // Send confirmation DM
    try {
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Giveaway Entry Confirmed!')
        .setDescription(`You have successfully entered the giveaway for **${giveaway.prize}**!`)
        .addFields(
          { name: 'Server', value: interaction.guild.name, inline: true },
          { name: 'Ends', value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

      await interaction.user.send({ embeds: [confirmEmbed] });
    } catch (dmError) {
      // User has DMs disabled, that's okay
    }

  } catch (error) {
    logError('Error handling giveaway entry:', error);
    await replyWithError(interaction, 'An error occurred while entering the giveaway. Please try again.');
  }
}
