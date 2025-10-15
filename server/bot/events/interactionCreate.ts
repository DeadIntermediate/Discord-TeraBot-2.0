import { Interaction, ChatInputCommandInteraction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { handleEmbedBuilderInteraction } from '../commands/embeds';

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
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    
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

async function handleButtonInteraction(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;

    // Check for embed builder interactions first
    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    if (customId.startsWith('ticket_close_')) {
      await handleTicketClose(interaction);
    } else if (customId.startsWith('ticket_assign_')) {
      await handleTicketAssign(interaction);
    } else if (customId.startsWith('ticket_priority_')) {
      await handleTicketPriority(interaction);
    } else if (customId === 'giveaway_enter') {
      await handleGiveawayEntry(interaction);
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    
    const errorMessage = { 
      content: 'There was an error while processing this action!', 
      ephemeral: true 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleModalInteraction(interaction: any) {
  try {
    // Check for embed builder modals
    if (interaction.customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    // Handle other modals here
  } catch (error) {
    console.error('Error handling modal interaction:', error);
    
    const errorMessage = { 
      content: 'There was an error while processing this modal!', 
      ephemeral: true 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleSelectMenuInteraction(interaction: any) {
  try {
    // Check for embed builder select menus
    if (interaction.customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    // Handle other select menus here
  } catch (error) {
    console.error('Error handling select menu interaction:', error);
    
    const errorMessage = { 
      content: 'There was an error while processing this selection!', 
      ephemeral: true 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleTicketClose(interaction: ButtonInteraction) {
  const ticketId = interaction.customId.replace('ticket_close_', '');
  const ticket = await storage.getTicket(ticketId);

  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }

  if (ticket.status === 'closed') {
    await interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
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
      console.error('Error deleting ticket channel:', error);
    }
  }, 10000);
}

async function handleTicketAssign(interaction: ButtonInteraction) {
  const ticketId = interaction.customId.replace('ticket_assign_', '');
  const ticket = await storage.getTicket(ticketId);

  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }

  if (ticket.assignedTo === interaction.user.id) {
    await interaction.reply({ content: 'This ticket is already assigned to you.', ephemeral: true });
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
  // For now, just acknowledge the interaction
  // TODO: Implement priority change modal
  await interaction.reply({ 
    content: 'Priority change feature is not yet implemented. Use `/ticket-manage` for now.', 
    ephemeral: true 
  });
}

async function handleGiveawayEntry(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This can only be used in a server.', ephemeral: true });
    return;
  }

  try {
    // Find the giveaway by message ID
    const giveaways = await storage.getActiveGiveaways(interaction.guild.id);
    const giveaway = giveaways.find(g => g.messageId === interaction.message.id);

    if (!giveaway) {
      await interaction.reply({ content: 'This giveaway was not found or has ended.', ephemeral: true });
      return;
    }

    if (!giveaway.isActive) {
      await interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
      return;
    }

    // Check requirements
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Could not verify your server membership.', ephemeral: true });
      return;
    }

    const requirements = giveaway.requirements as any || {};
    
    // Check required role
    if (requirements.requiredRoleId) {
      if (!member.roles.cache.has(requirements.requiredRoleId)) {
        await interaction.reply({ 
          content: `You need the <@&${requirements.requiredRoleId}> role to enter this giveaway.`, 
          ephemeral: true 
        });
        return;
      }
    }

    // Check account age
    if (requirements.minAccountAgeDays) {
      const accountAge = Date.now() - interaction.user.createdAt.getTime();
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      
      if (accountAgeDays < requirements.minAccountAgeDays) {
        await interaction.reply({ 
          content: `Your account must be at least ${requirements.minAccountAgeDays} days old to enter this giveaway.`, 
          ephemeral: true 
        });
        return;
      }
    }

    // Check if user already entered
    const currentEntries = giveaway.entries as string[] || [];
    if (currentEntries.includes(interaction.user.id)) {
      await interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
      return;
    }

    // Add user to entries
    const newEntries = [...currentEntries, interaction.user.id];
    await storage.updateGiveaway(giveaway.id, {
      entries: newEntries
    });

    // Update the embed with new entry count
    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed);
    
    // Find and update the entries field
    const fields = updatedEmbed.data.fields || [];
    const entriesFieldIndex = fields.findIndex(field => field.name === '🎯 Entries');
    if (entriesFieldIndex !== -1) {
      fields[entriesFieldIndex].value = newEntries.length.toString();
    }

    await interaction.update({
      embeds: [updatedEmbed],
      components: interaction.message.components
    });

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
    } catch (error) {
      // User has DMs disabled, silently continue
    }

  } catch (error) {
    console.error('Error handling giveaway entry:', error);
    await interaction.reply({ 
      content: 'An error occurred while entering the giveaway. Please try again.', 
      ephemeral: true 
    });
  }
}
