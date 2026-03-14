import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { storage } from '../../storage';
import { error } from '../../utils/logger';

const createTicketCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a support ticket')
    .addStringOption(option =>
      option.setName('subject')
        .setDescription('Brief description of your issue')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(option =>
      option.setName('priority')
        .setDescription('Priority level of your ticket')
        .setRequired(false)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        ))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Detailed description of your issue')
        .setRequired(false)
        .setMaxLength(1000)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const subject = interaction.options.getString('subject', true);
    const priority = interaction.options.getString('priority') || 'medium';
    const description = interaction.options.getString('description') || 'No additional details provided.';

    try {
      // Check if user already has an open ticket
      const existingTickets = await storage.getServerTickets(interaction.guild.id, 'open');
      const userHasOpenTicket = existingTickets.some(ticket => ticket.userId === interaction.user.id);

      if (userHasOpenTicket) {
        await interaction.reply({
          content: 'You already have an open ticket. Please close your existing ticket before creating a new one.',
          ephemeral: true
        });
        return;
      }

      // Get server settings for ticket category
      const server = await storage.getDiscordServer(interaction.guild.id);
      const ticketCategoryId = (server as any)?.settings?.ticketCategoryId;

      let ticketChannel: TextChannel;

      // Create ticket channel
      const channelName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`;

      ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategoryId || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id, // Ticket creator
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: interaction.client.user.id, // Bot
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      // Add support role permissions if configured
      const supportRoleId = (server as any)?.settings?.supportRoleId;
      if (supportRoleId) {
        await ticketChannel.permissionOverwrites.create(supportRoleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
        });
      }

      // Create ticket in database
      const ticket = await storage.createTicket({
        serverId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: ticketChannel.id,
        subject: subject,
        priority: priority as any,
      });

      // Create ticket embed
      const priorityColors = {
        low: 0x00ff00,
        medium: 0xffff00,
        high: 0xff8800,
        urgent: 0xff0000,
      };

      const ticketEmbed = new EmbedBuilder()
        .setColor(priorityColors[priority as keyof typeof priorityColors])
        .setTitle(`🎫 Support Ticket #${ticket.id.slice(-8)}`)
        .setDescription(`**Subject:** ${subject}\n\n**Description:** ${description}`)
        .addFields(
          { name: '👤 Created by', value: interaction.user.toString(), inline: true },
          { name: '📅 Created at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '⚡ Priority', value: priority.charAt(0).toUpperCase() + priority.slice(1), inline: true },
          { name: '📊 Status', value: 'Open', inline: true },
          { name: '👥 Assigned to', value: 'Unassigned', inline: true },
          { name: '🆔 Ticket ID', value: `\`${ticket.id}\``, inline: true }
        )
        .setFooter({ text: 'Support team will respond shortly' })
        .setTimestamp();

      // Create action buttons
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticket.id}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId(`ticket_assign_${ticket.id}`)
            .setLabel('Assign to Me')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId(`ticket_priority_${ticket.id}`)
            .setLabel('Change Priority')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚡')
        );

      // Send ticket message
      await ticketChannel.send({
        content: `${interaction.user.toString()} Welcome to your support ticket!${supportRoleId ? ` <@&${supportRoleId}>` : ''}`,
        embeds: [ticketEmbed],
        components: [actionRow]
      });

      // Notify user
      await interaction.reply({
        content: `✅ Ticket created successfully! Check ${ticketChannel.toString()}`,
        ephemeral: true
      });

      // Log to staff channel if configured
      const staffLogChannelId = server?.staffLogChannelId;
      if (staffLogChannelId) {
        const staffLogChannel = interaction.guild.channels.cache.get(staffLogChannelId) as TextChannel;
        if (staffLogChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle('📝 New Ticket Created')
            .setDescription(`${interaction.user.toString()} created a new ticket`)
            .addFields(
              { name: 'Subject', value: subject, inline: true },
              { name: 'Priority', value: priority, inline: true },
              { name: 'Channel', value: ticketChannel.toString(), inline: true }
            )
            .setTimestamp();

          await staffLogChannel.send({ embeds: [logEmbed] });
        }
      }

    } catch (err) {
      error('Error creating ticket:', err);
      await interaction.reply({
        content: 'An error occurred while creating your ticket. Please try again or contact an administrator.',
        ephemeral: true
      });
    }
  }
};

const ticketManageCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-manage')
    .setDescription('Manage support tickets (Staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a ticket')
        .addStringOption(option =>
          option.setName('ticket-id')
            .setDescription('Ticket ID to close')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for closing the ticket')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('assign')
        .setDescription('Assign a ticket to a staff member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Staff member to assign the ticket to')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('ticket-id')
            .setDescription('Ticket ID to assign')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all tickets')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Open', value: 'open' },
              { name: 'Closed', value: 'closed' },
              { name: 'All', value: 'all' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('transcript')
        .setDescription('Generate a transcript of a ticket')
        .addStringOption(option =>
          option.setName('ticket-id')
            .setDescription('Ticket ID to generate transcript for')
            .setRequired(false)
            .setAutocomplete(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'close':
          await handleCloseTicket(interaction);
          break;
        case 'assign':
          await handleAssignTicket(interaction);
          break;
        case 'list':
          await handleListTickets(interaction);
          break;
        case 'transcript':
          await handleTicketTranscript(interaction);
          break;
      }
    } catch (err) {
      error(`Error in ticket-manage ${subcommand}:`, err);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
};

async function handleCloseTicket(interaction: ChatInputCommandInteraction) {
  const ticketId = interaction.options.getString('ticket-id');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  // If no ticket ID provided, try to get from current channel
  let ticket;
  if (ticketId) {
    ticket = await storage.getTicket(ticketId);
  } else {
    // Check if current channel is a ticket channel
    const channelTickets = await storage.getServerTickets(interaction.guild!.id, 'open');
    ticket = channelTickets.find(t => t.channelId === interaction.channel?.id);
  }

  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found or already closed.', ephemeral: true });
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

  // Create closing embed
  const closeEmbed = new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket has been closed by ${interaction.user.toString()}`)
    .addFields(
      { name: 'Reason', value: reason, inline: false },
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
    } catch (err) {
      error('Error deleting ticket channel:', err);
    }
  }, 10000);
}

async function handleAssignTicket(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const ticketId = interaction.options.getString('ticket-id');

  let ticket;
  if (ticketId) {
    ticket = await storage.getTicket(ticketId);
  } else {
    const channelTickets = await storage.getServerTickets(interaction.guild!.id, 'open');
    ticket = channelTickets.find(t => t.channelId === interaction.channel?.id);
  }

  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }

  await storage.updateTicket(ticket.id, {
    assignedTo: user.id,
  });

  const assignEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('👤 Ticket Assigned')
    .setDescription(`This ticket has been assigned to ${user.toString()}`)
    .setTimestamp();

  await interaction.reply({ embeds: [assignEmbed] });
}

async function handleListTickets(interaction: ChatInputCommandInteraction) {
  const status = interaction.options.getString('status') || 'open';

  const tickets = status === 'all'
    ? await storage.getServerTickets(interaction.guild!.id)
    : await storage.getServerTickets(interaction.guild!.id, status);

  if (tickets.length === 0) {
    await interaction.reply({ content: `No ${status} tickets found.`, ephemeral: true });
    return;
  }

  const ticketList = tickets.slice(0, 10).map(ticket => {
    const statusEmoji = ticket.status === 'open' ? '🟢' : '🔴';
    const priorityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      urgent: '🔴'
    }[String(ticket.priority) || 'normal'] || '⚪';

    return `${statusEmoji} **${ticket.subject}** | ${priorityEmoji} ${ticket.priority} | <#${ticket.channelId}> | \`${ticket.id.slice(-8)}\``;
  }).join('\n');

  const listEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋 Tickets (${status})`)
    .setDescription(ticketList)
    .setFooter({ text: `Showing ${Math.min(tickets.length, 10)} of ${tickets.length} tickets` })
    .setTimestamp();

  await interaction.reply({ embeds: [listEmbed], ephemeral: true });
}

async function handleTicketTranscript(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.options.getString('ticket-id');

  let ticket;
  if (ticketId) {
    ticket = await storage.getTicket(ticketId);
  } else {
    // Try to resolve from current channel
    const channelTickets = await storage.getServerTickets(interaction.guild!.id);
    ticket = channelTickets.find(t => t.channelId === interaction.channel?.id);
  }

  if (!ticket) {
    await interaction.editReply({ content: 'Ticket not found. Provide a ticket ID or run this command inside a ticket channel.' });
    return;
  }

  // Fetch the ticket channel's messages (up to 100)
  const ticketChannel = interaction.guild!.channels.cache.get(ticket.channelId) as TextChannel | undefined;
  if (!ticketChannel) {
    await interaction.editReply({ content: 'Ticket channel not found — it may have already been deleted.' });
    return;
  }

  const messages = await ticketChannel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Build plain-text transcript
  const lines: string[] = [
    `=== Ticket Transcript ===`,
    `Ticket ID : ${ticket.id}`,
    `Subject   : ${ticket.subject}`,
    `Priority  : ${ticket.priority}`,
    `Status    : ${ticket.status}`,
    `Created   : ${ticket.createdAt ? new Date(ticket.createdAt).toUTCString() : 'Unknown'}`,
    `Server    : ${interaction.guild!.name}`,
    ``,
    `--- Messages (${sorted.length}) ---`,
    ``,
  ];

  for (const msg of sorted) {
    const timestamp = new Date(msg.createdTimestamp).toUTCString();
    const author = `${msg.author.username}#${msg.author.discriminator}`;
    const content = msg.content || (msg.embeds.length > 0 ? '[Embed]' : '[No content]');
    lines.push(`[${timestamp}] ${author}: ${content}`);

    for (const attachment of msg.attachments.values()) {
      lines.push(`  [Attachment] ${attachment.name}: ${attachment.url}`);
    }
  }

  if (sorted.length === 100) {
    lines.push('');
    lines.push('(Only the most recent 100 messages are included in this transcript.)');
  }

  const transcriptText = lines.join('\n');
  const buffer = Buffer.from(transcriptText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, {
    name: `transcript-${ticket.id.slice(-8)}.txt`,
    description: `Transcript for ticket ${ticket.id.slice(-8)}`
  });

  await interaction.editReply({
    content: `📄 Transcript for ticket \`${ticket.id.slice(-8)}\` (${sorted.length} messages):`,
    files: [attachment]
  });
}

export async function handleTicketAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.respond([]); return; }
  const focused = interaction.options.getFocused().toLowerCase();

  try {
    const tickets = await storage.getServerTickets(interaction.guild.id, 'open');
    const choices = tickets
      .filter(t => t.subject.toLowerCase().includes(focused) || t.id.includes(focused))
      .slice(0, 25)
      .map(t => ({
        name: `#${t.id.slice(-8)} — ${t.subject}`,
        value: t.id
      }));

    await interaction.respond(choices);
  } catch (err) {
    error('Error in ticket autocomplete:', err);
    await interaction.respond([]);
  }
}

export const ticketCommands = [createTicketCommand, ticketManageCommand];
