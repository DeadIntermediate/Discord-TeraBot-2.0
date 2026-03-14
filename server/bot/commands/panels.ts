import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { storage } from '../../storage';
import { endGiveaway } from './giveaways';
import { error } from '../../utils/logger';

// ── /panel command ────────────────────────────────────────────────────────────

export const panelCommand = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create interactive persistent panels in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('ticket')
        .setDescription('Post a ticket-opening panel members can click'))
    .addSubcommand(sub =>
      sub.setName('giveaway')
        .setDescription('Post a live control panel for a giveaway')
        .addStringOption(opt =>
          opt.setName('giveaway-id')
            .setDescription('Giveaway to control')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('staff')
        .setDescription('Post a staff overview panel with quick-action buttons')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'ticket')   await createTicketPanel(interaction);
      if (sub === 'giveaway') await createGiveawayPanel(interaction);
      if (sub === 'staff')    await createStaffPanel(interaction);
    } catch (err) {
      error(`Panel error (${sub}):`, err);
      const msg = { content: 'Failed to create the panel.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  },
};

// ── Panel builders ────────────────────────────────────────────────────────────

async function createTicketPanel(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Support Tickets')
    .setDescription(
      'Need help from our team? Click the button below to open a private support ticket.\n\n' +
      '**Before opening a ticket:**\n' +
      '• Check if your question is in the FAQ\n' +
      '• Only one open ticket per user\n' +
      '• Be as descriptive as possible'
    )
    .setFooter({ text: `${interaction.guild!.name} Support` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_ticket_open')
      .setLabel('Open a Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫'),
  );

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Ticket panel posted!', ephemeral: true });
}

async function createGiveawayPanel(interaction: ChatInputCommandInteraction) {
  const giveawayId = interaction.options.getString('giveaway-id', true);
  const giveaway = await storage.getGiveaway(giveawayId);

  if (!giveaway) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  const embed = buildGiveawayEmbed(giveaway);
  const row = buildGiveawayRow(giveaway);

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Giveaway panel posted!', ephemeral: true });
}

async function createStaffPanel(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  const embed = await buildStaffEmbed(guild.id, guild.name, guild.memberCount);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('panel_staff_tickets').setLabel('Open Tickets').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
    new ButtonBuilder().setCustomId('panel_staff_giveaways').setLabel('Active Giveaways').setStyle(ButtonStyle.Secondary).setEmoji('🎉'),
    new ButtonBuilder().setCustomId('panel_staff_modlog').setLabel('Mod Log').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    new ButtonBuilder().setCustomId('panel_staff_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔃'),
  );

  await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Staff panel posted!', ephemeral: true });
}

// ── Embed/row helpers ─────────────────────────────────────────────────────────

function buildGiveawayEmbed(giveaway: any): EmbedBuilder {
  const entries = (giveaway.entries as string[] || []).length;
  return new EmbedBuilder()
    .setColor(giveaway.isActive ? 0x00aaff : 0x808080)
    .setTitle('🎉 Giveaway Control Panel')
    .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
    .addFields(
      { name: '🏆 Winners', value: String(giveaway.winnerCount), inline: true },
      { name: '🎯 Entries', value: String(entries), inline: true },
      { name: '📊 Status', value: giveaway.isActive ? '🟢 Active' : '🔴 Ended', inline: true },
      { name: '⏰ Ends', value: `<t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: `ID: ${String(giveaway.id).slice(-8)} — Last refreshed` })
    .setTimestamp();
}

function buildGiveawayRow(giveaway: any): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`panel_giveaway_end_${giveaway.id}`)
      .setLabel('End Now')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏹️')
      .setDisabled(!giveaway.isActive),
    new ButtonBuilder()
      .setCustomId(`panel_giveaway_reroll_${giveaway.id}`)
      .setLabel('Reroll')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄')
      .setDisabled(!!giveaway.isActive),
    new ButtonBuilder()
      .setCustomId(`panel_giveaway_refresh_${giveaway.id}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔃'),
  );
}

async function buildStaffEmbed(guildId: string, guildName: string, memberCount: number): Promise<EmbedBuilder> {
  const openTickets    = (await storage.getServerTickets(guildId, 'open')).length;
  const activeGiveaways = (await storage.getActiveGiveaways(guildId)).length;
  const recentMods     = await storage.getModerationLogs(guildId, 5);

  const actionEmojis: Record<string, string> = { warn: '⚠️', ban: '🔨', kick: '👢', mute: '🔇', timeout: '⏱️' };
  const recentModList = recentMods.length > 0
    ? recentMods.map(l => {
        const emoji = actionEmojis[l.action] ?? '📝';
        const ts = Math.floor(new Date(l.createdAt!).getTime() / 1000);
        return `${emoji} **${l.action.toUpperCase()}** <@${l.targetUserId}> — <t:${ts}:R>`;
      }).join('\n')
    : '*No recent actions*';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`⚙️ Staff Panel — ${guildName}`)
    .addFields(
      { name: '🎫 Open Tickets',       value: String(openTickets),     inline: true },
      { name: '🎉 Active Giveaways',   value: String(activeGiveaways), inline: true },
      { name: '👥 Members',            value: String(memberCount),      inline: true },
      { name: '📋 Recent Mod Actions', value: recentModList },
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();
}

// ── Exported button handler ───────────────────────────────────────────────────

export async function handlePanelButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId } = interaction;

  if (customId === 'panel_ticket_open') {
    await showTicketModal(interaction);
    return true;
  }

  if (customId.startsWith('panel_giveaway_end_')) {
    await handleGiveawayEnd(interaction, customId.slice('panel_giveaway_end_'.length));
    return true;
  }
  if (customId.startsWith('panel_giveaway_reroll_')) {
    await handleGiveawayReroll(interaction, customId.slice('panel_giveaway_reroll_'.length));
    return true;
  }
  if (customId.startsWith('panel_giveaway_refresh_')) {
    await handleGiveawayRefresh(interaction, customId.slice('panel_giveaway_refresh_'.length));
    return true;
  }

  if (customId === 'panel_staff_tickets')   { await handleStaffTickets(interaction);   return true; }
  if (customId === 'panel_staff_giveaways') { await handleStaffGiveaways(interaction); return true; }
  if (customId === 'panel_staff_modlog')    { await handleStaffModLog(interaction);    return true; }
  if (customId === 'panel_staff_refresh')   { await handleStaffRefresh(interaction);   return true; }

  return false;
}

// ── Exported modal handler ────────────────────────────────────────────────────

export async function handlePanelModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (interaction.customId === 'panel_ticket_modal') {
    await createTicketFromPanel(interaction);
    return true;
  }
  return false;
}

// ── Ticket panel flow ─────────────────────────────────────────────────────────

async function showTicketModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('panel_ticket_modal')
    .setTitle('Open a Support Ticket');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('subject')
        .setLabel('Subject')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Brief description of your issue')
        .setMaxLength(100)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe your issue in detail...')
        .setMaxLength(1000)
        .setRequired(false),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('priority')
        .setLabel('Priority  (low / medium / high / urgent)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('medium')
        .setRequired(false),
    ),
  );

  await interaction.showModal(modal);
}

async function createTicketFromPanel(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const subject     = interaction.fields.getTextInputValue('subject');
  const description = interaction.fields.getTextInputValue('description') || 'No additional details.';
  const priorityRaw = interaction.fields.getTextInputValue('priority').toLowerCase().trim() || 'medium';
  const priority    = ['low', 'medium', 'high', 'urgent'].includes(priorityRaw) ? priorityRaw : 'medium';

  const existing = await storage.getServerTickets(interaction.guild.id, 'open');
  if (existing.some(t => t.userId === interaction.user.id)) {
    await interaction.reply({ content: 'You already have an open ticket. Please close it before opening a new one.', ephemeral: true });
    return;
  }

  const server         = await storage.getDiscordServer(interaction.guild.id);
  const supportRoleId  = (server as any)?.settings?.supportRoleId;
  const categoryId     = (server as any)?.settings?.ticketCategoryId;

  const ticketChannel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
    type: ChannelType.GuildText,
    parent: categoryId || null,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
    ],
  }) as TextChannel;

  if (supportRoleId) {
    await ticketChannel.permissionOverwrites.create(supportRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  }

  const priorityColors: Record<string, number> = { low: 0x00ff00, medium: 0xffff00, high: 0xff8800, urgent: 0xff0000 };

  const ticket = await storage.createTicket({
    serverId: interaction.guild.id,
    userId: interaction.user.id,
    channelId: ticketChannel.id,
    subject,
    priority: priority as any,
  });

  const embed = new EmbedBuilder()
    .setColor(priorityColors[priority])
    .setTitle(`🎫 Ticket #${ticket.id.slice(-8)}`)
    .setDescription(`**Subject:** ${subject}\n\n${description}`)
    .addFields(
      { name: '👤 Opened by', value: interaction.user.toString(), inline: true },
      { name: '⚡ Priority', value: priority.charAt(0).toUpperCase() + priority.slice(1), inline: true },
      { name: '🆔 Ticket ID', value: `\`${ticket.id}\``, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${ticket.id}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId(`ticket_assign_${ticket.id}`).setLabel('Assign to Me').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId(`ticket_priority_${ticket.id}`).setLabel('Change Priority').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
  );

  await ticketChannel.send({
    content: `${interaction.user.toString()} Welcome!${supportRoleId ? ` <@&${supportRoleId}>` : ''}`,
    embeds: [embed],
    components: [row],
  });

  await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel.toString()}`, ephemeral: true });
}

// ── Giveaway panel handlers ───────────────────────────────────────────────────

async function handleGiveawayEnd(interaction: ButtonInteraction, giveawayId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)) {
    await interaction.reply({ content: 'You need **Manage Events** to end giveaways.', ephemeral: true });
    return;
  }

  const giveaway = await storage.getGiveaway(giveawayId);
  if (!giveaway?.isActive) {
    await interaction.reply({ content: 'Giveaway not found or already ended.', ephemeral: true });
    return;
  }

  await endGiveaway(interaction.client, giveawayId);

  const updated = await storage.getGiveaway(giveawayId);
  if (updated) {
    await interaction.update({ embeds: [buildGiveawayEmbed(updated)], components: [buildGiveawayRow(updated)] });
  }

  await interaction.followUp({ content: '⏹️ Giveaway ended!', ephemeral: true });
}

async function handleGiveawayReroll(interaction: ButtonInteraction, giveawayId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)) {
    await interaction.reply({ content: 'You need **Manage Events** to reroll.', ephemeral: true });
    return;
  }

  const giveaway = await storage.getGiveaway(giveawayId);
  if (!giveaway || giveaway.isActive) {
    await interaction.reply({ content: 'Giveaway not found or still active.', ephemeral: true });
    return;
  }

  const entries = [...new Set(giveaway.entries as string[] || [])];
  if (entries.length === 0) {
    await interaction.reply({ content: 'No entries to reroll.', ephemeral: true });
    return;
  }

  const count = Math.min(Number(giveaway.winnerCount || 1), entries.length);
  const pool = [...entries];
  const winners: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  await storage.updateGiveaway(giveawayId, { winners });

  const channel = interaction.guild?.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
  if (channel) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🔄 Giveaway Rerolled!')
          .setDescription(`**Prize:** ${giveaway.prize}\n\n**New Winners:** ${winners.map(id => `<@${id}>`).join(', ')}`)
          .setTimestamp(),
      ],
    });
  }

  await interaction.reply({ content: `🔄 Rerolled! New winners: ${winners.map(id => `<@${id}>`).join(', ')}`, ephemeral: true });
}

async function handleGiveawayRefresh(interaction: ButtonInteraction, giveawayId: string) {
  const giveaway = await storage.getGiveaway(giveawayId);
  if (!giveaway) return;

  await interaction.update({
    embeds: [buildGiveawayEmbed(giveaway)],
    components: [buildGiveawayRow(giveaway)],
  });
}

// ── Staff panel handlers ──────────────────────────────────────────────────────

async function handleStaffTickets(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const tickets = await storage.getServerTickets(interaction.guild.id, 'open');
  const priorityEmoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
  const list = tickets.slice(0, 10)
    .map(t => `${priorityEmoji[String(t.priority)] ?? '⚪'} **${t.subject}** — <#${t.channelId}>`)
    .join('\n') || '*No open tickets*';

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🎫 Open Tickets').setDescription(list).setTimestamp()],
    ephemeral: true,
  });
}

async function handleStaffGiveaways(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const giveaways = await storage.getActiveGiveaways(interaction.guild.id);
  const list = giveaways.slice(0, 10)
    .map(g => {
      const entries = (g.entries as string[] || []).length;
      return `🟢 **${g.prize}** — ${entries} entries — ends <t:${Math.floor(new Date(g.endsAt).getTime() / 1000)}:R>`;
    })
    .join('\n') || '*No active giveaways*';

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x00aaff).setTitle('🎉 Active Giveaways').setDescription(list).setTimestamp()],
    ephemeral: true,
  });
}

async function handleStaffModLog(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const logs = await storage.getModerationLogs(interaction.guild.id, 10);
  const actionEmojis: Record<string, string> = { warn: '⚠️', ban: '🔨', kick: '👢', mute: '🔇', timeout: '⏱️' };
  const list = logs
    .map(l => `${actionEmojis[l.action] ?? '📝'} **${l.action.toUpperCase()}** <@${l.targetUserId}> — <t:${Math.floor(new Date(l.createdAt!).getTime() / 1000)}:R>`)
    .join('\n') || '*No recent actions*';

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xff6b6b).setTitle('📋 Recent Mod Actions').setDescription(list).setTimestamp()],
    ephemeral: true,
  });
}

async function handleStaffRefresh(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const { id, name, memberCount } = interaction.guild;
  const embed = await buildStaffEmbed(id, name, memberCount);
  await interaction.update({ embeds: [embed] });
}
