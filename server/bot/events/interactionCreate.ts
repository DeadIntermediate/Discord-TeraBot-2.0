import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { storage } from '../../storage';
import { handleEmbedBuilderInteraction } from '../commands/embeds';
import { handleContextMenuButton, handleContextMenuModal } from '../commands/contextMenus';
import { handlePanelButton, handlePanelModal } from '../commands/panels';
import { handleGiveawayCreateModal, handleGiveawayAutocomplete } from '../commands/giveaways';
import { handleTicketAutocomplete } from '../commands/tickets';
import { handleGameAutocomplete } from '../commands/games';
import { error } from '../../utils/logger';

export async function interactionCreateHandler(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    await handleContextMenuCommand(interaction);
  } else if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
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
    error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    error('Error executing command:', err);

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

async function handleContextMenuCommand(interaction: any) {
  const command = (interaction.client as any).commands.get(interaction.commandName);

  if (!command) {
    error(`No context menu command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    error('Error executing context menu command:', err);

    const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleAutocomplete(interaction: any) {
  const commandName = interaction.commandName;

  try {
    if (commandName === 'giveaway-manage') {
      await handleGiveawayAutocomplete(interaction);
    } else if (commandName === 'ticket-manage') {
      await handleTicketAutocomplete(interaction);
    } else if (commandName === 'game') {
      await handleGameAutocomplete(interaction);
    }
  } catch (err) {
    error('Error handling autocomplete:', err);
    try { await interaction.respond([]); } catch { /* ignore */ }
  }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;

    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    if (customId.startsWith('ctx_')) {
      const handled = await handleContextMenuButton(interaction);
      if (handled) return;
    }

    if (customId.startsWith('panel_')) {
      const handled = await handlePanelButton(interaction);
      if (handled) return;
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
  } catch (err) {
    error('Error handling button interaction:', err);

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
    const customId = interaction.customId;

    if (customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    if (customId === 'giveaway_create_modal') {
      await handleGiveawayCreateModal(interaction);
      return;
    }

    if (customId.startsWith('ctx_')) {
      const handled = await handleContextMenuModal(interaction);
      if (handled) return;
    }

    if (customId.startsWith('panel_')) {
      const handled = await handlePanelModal(interaction);
      if (handled) return;
    }

  } catch (err) {
    error('Error handling modal interaction:', err);

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
    if (interaction.customId.startsWith('embed_')) {
      await handleEmbedBuilderInteraction(interaction);
      return;
    }

    if (interaction.customId.startsWith('ticket_priority_select_')) {
      await handleTicketPrioritySelect(interaction);
      return;
    }
  } catch (err) {
    error('Error handling select menu interaction:', err);

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

  setTimeout(async () => {
    try {
      const channel = interaction.guild?.channels.cache.get(ticket.channelId);
      if (channel) {
        await channel.delete('Ticket closed');
      }
    } catch (err) {
      error('Error deleting ticket channel:', err);
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
  const ticketId = interaction.customId.replace('ticket_priority_', '');
  const ticket = await storage.getTicket(ticketId);

  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_priority_select_${ticketId}`)
    .setPlaceholder('Select new priority...')
    .addOptions(
      { label: 'Low', value: 'low', emoji: '🟢', description: 'Low priority issue' },
      { label: 'Medium', value: 'medium', emoji: '🟡', description: 'Medium priority issue' },
      { label: 'High', value: 'high', emoji: '🟠', description: 'High priority issue' },
      { label: 'Urgent', value: 'urgent', emoji: '🔴', description: 'Urgent — requires immediate attention' },
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: 'Select a new priority for this ticket:',
    components: [row],
    ephemeral: true
  });
}

async function handleTicketPrioritySelect(interaction: any) {
  const ticketId = interaction.customId.replace('ticket_priority_select_', '');
  const newPriority = interaction.values[0] as string;

  const ticket = await storage.getTicket(ticketId);
  if (!ticket) {
    await interaction.update({ content: 'Ticket not found.', components: [] });
    return;
  }

  await storage.updateTicket(ticketId, { priority: newPriority as any });

  const priorityEmojis: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
  const emoji = priorityEmojis[newPriority] || '⚪';
  const label = newPriority.charAt(0).toUpperCase() + newPriority.slice(1);

  await interaction.update({
    content: `${emoji} Ticket priority updated to **${label}**.`,
    components: []
  });
}

async function handleGiveawayEntry(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This can only be used in a server.', ephemeral: true });
    return;
  }

  try {
    const giveaways = await storage.getActiveGiveaways(interaction.guild.id);
    const giveaway = giveaways.find(g => g.messageId === interaction.message.id);

    if (!giveaway) {
      await interaction.reply({ content: 'This giveaway was not found or has ended.', ephemeral: true });
      return;
    }

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Could not verify your server membership.', ephemeral: true });
      return;
    }

    const requirements = giveaway.requirements as any || {};

    if (requirements.requiredRoleId) {
      if (!member.roles.cache.has(requirements.requiredRoleId)) {
        await interaction.reply({
          content: `You need the <@&${requirements.requiredRoleId}> role to enter this giveaway.`,
          ephemeral: true
        });
        return;
      }
    }

    if (requirements.minAccountAgeDays) {
      const accountAgeDays = Math.floor((Date.now() - interaction.user.createdAt.getTime()) / 86_400_000);
      if (accountAgeDays < requirements.minAccountAgeDays) {
        await interaction.reply({
          content: `Your account must be at least ${requirements.minAccountAgeDays} days old to enter this giveaway.`,
          ephemeral: true
        });
        return;
      }
    }

    const updated = await storage.enterGiveaway(giveaway.id, interaction.user.id);
    if (!updated) {
      await interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
      return;
    }

    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed);

    const fields = updatedEmbed.data.fields || [];
    const entriesFieldIndex = fields.findIndex(field => field.name === '🎯 Entries');
    if (entriesFieldIndex !== -1) {
      fields[entriesFieldIndex].value = (updated.entries as string[]).length.toString();
    }

    await interaction.update({
      embeds: [updatedEmbed],
      components: interaction.message.components
    });

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
    } catch {
      // User has DMs disabled — silently continue
    }

  } catch (err) {
    error('Error handling giveaway entry:', err);
    await interaction.reply({
      content: 'An error occurred while entering the giveaway. Please try again.',
      ephemeral: true
    });
  }
}
