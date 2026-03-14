import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { storage } from '../../storage';
import { error } from '../../utils/logger';

// ── User context menus ────────────────────────────────────────────────────────

export const moderateUserMenu = {
  data: new ContextMenuCommandBuilder()
    .setName('Moderate User')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: UserContextMenuCommandInteraction) {
    const targetUser = interaction.targetUser;
    const targetMember = interaction.guild?.members.cache.get(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`⚠️ Moderate: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 User', value: targetUser.toString(), inline: true },
        { name: '🆔 ID', value: targetUser.id, inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '📥 Joined Server', value: targetMember?.joinedAt ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
      )
      .setFooter({ text: 'Select an action below' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ctx_mod_warn_${targetUser.id}`).setLabel('Warn').setStyle(ButtonStyle.Secondary).setEmoji('⚠️'),
      new ButtonBuilder().setCustomId(`ctx_mod_timeout_${targetUser.id}`).setLabel('Timeout').setStyle(ButtonStyle.Primary).setEmoji('⏱️'),
      new ButtonBuilder().setCustomId(`ctx_mod_kick_${targetUser.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger).setEmoji('👢'),
      new ButtonBuilder().setCustomId(`ctx_mod_ban_${targetUser.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
    );

    const historyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ctx_mod_history_${targetUser.id}`).setLabel('View Mod History').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    );

    await interaction.reply({ embeds: [embed], components: [actionRow, historyRow], ephemeral: true });
  },
};

export const modHistoryMenu = {
  data: new ContextMenuCommandBuilder()
    .setName('Mod History')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: UserContextMenuCommandInteraction) {
    await replyModHistory(interaction, interaction.targetUser.id);
  },
};

// ── Message context menus ─────────────────────────────────────────────────────

export const createTicketFromMessageMenu = {
  data: new ContextMenuCommandBuilder()
    .setName('Create Ticket')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const message = interaction.targetMessage;

    const modal = new ModalBuilder()
      .setCustomId(`ctx_ticket_msg_${message.id}`)
      .setTitle('Open a Ticket');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('subject')
          .setLabel('Subject')
          .setStyle(TextInputStyle.Short)
          .setValue(message.content.slice(0, 100) || 'Issue from message')
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Additional details')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(`Message from ${message.author.username}: "${message.content.slice(0, 400)}"`)
          .setMaxLength(1000)
          .setRequired(false),
      ),
    );

    await interaction.showModal(modal);
  },
};

export const reportMessageMenu = {
  data: new ContextMenuCommandBuilder()
    .setName('Report Message')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId(`ctx_report_${interaction.targetMessage.id}_${interaction.channelId}`)
      .setTitle('Report Message');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Why are you reporting this message?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true),
      ),
    );

    await interaction.showModal(modal);
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

async function replyModHistory(
  interaction: UserContextMenuCommandInteraction | ButtonInteraction,
  targetUserId: string,
) {
  if (!interaction.guild) return;

  const logs = await storage.getUserModerationHistory(targetUserId, interaction.guild.id);

  if (logs.length === 0) {
    const reply = { content: `No moderation history found for <@${targetUserId}>.`, ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
    return;
  }

  const actionEmojis: Record<string, string> = {
    warn: '⚠️', ban: '🔨', kick: '👢', mute: '🔇',
    timeout: '⏱️', unmute: '🔊', unban: '✅', jail: '🔒', unjail: '🔓',
  };

  const entries = logs.slice(0, 10).map(log => {
    const emoji = actionEmojis[log.action] ?? '📝';
    const ts = Math.floor(new Date(log.createdAt!).getTime() / 1000);
    return `${emoji} **${log.action.toUpperCase()}** — <t:${ts}:R>\n> ${log.reason ?? 'No reason given'}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋 Mod History — ${interaction.guild.members.cache.get(targetUserId)?.user.username ?? targetUserId}`)
    .setDescription(entries.join('\n\n'))
    .setFooter({ text: `Showing ${Math.min(logs.length, 10)} of ${logs.length} records` })
    .setTimestamp();

  const reply = { embeds: [embed], ephemeral: true };
  if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
  else await interaction.reply(reply);
}

function buildModModal(action: 'warn' | 'timeout' | 'kick' | 'ban', targetUserId: string): ModalBuilder {
  const titles = { warn: '⚠️ Warn User', timeout: '⏱️ Timeout User', kick: '👢 Kick User', ban: '🔨 Ban User' };
  const modal = new ModalBuilder()
    .setCustomId(`ctx_modal_${action}_${targetUserId}`)
    .setTitle(titles[action]);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(true),
    ),
  );

  if (action === 'timeout') {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (e.g. 10m, 1h, 2d — max 28d)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1h')
          .setRequired(true),
      ),
    );
  }

  if (action === 'ban') {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('delete_days')
          .setLabel('Delete message history (0–7 days)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0')
          .setRequired(false),
      ),
    );
  }

  return modal;
}

function parseDurationMs(str: string): number | null {
  const match = str.trim().match(/^(\d+)\s*(m|min|h|hr|d|day|w|week)?s?$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = (match[2] ?? 'h').toLowerCase();
  const multipliers: Record<string, number> = {
    m: 60_000, min: 60_000,
    h: 3_600_000, hr: 3_600_000,
    d: 86_400_000, day: 86_400_000,
    w: 604_800_000, week: 604_800_000,
  };
  return value * (multipliers[unit] ?? 3_600_000);
}

// ── Exported button handler ───────────────────────────────────────────────────

export async function handleContextMenuButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId } = interaction;

  if (customId.startsWith('ctx_mod_warn_')) {
    await interaction.showModal(buildModModal('warn', customId.slice('ctx_mod_warn_'.length)));
    return true;
  }
  if (customId.startsWith('ctx_mod_timeout_')) {
    await interaction.showModal(buildModModal('timeout', customId.slice('ctx_mod_timeout_'.length)));
    return true;
  }
  if (customId.startsWith('ctx_mod_kick_')) {
    await interaction.showModal(buildModModal('kick', customId.slice('ctx_mod_kick_'.length)));
    return true;
  }
  if (customId.startsWith('ctx_mod_ban_')) {
    await interaction.showModal(buildModModal('ban', customId.slice('ctx_mod_ban_'.length)));
    return true;
  }
  if (customId.startsWith('ctx_mod_history_')) {
    await replyModHistory(interaction, customId.slice('ctx_mod_history_'.length));
    return true;
  }

  return false;
}

// ── Exported modal handler ────────────────────────────────────────────────────

export async function handleContextMenuModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId } = interaction;

  if (customId.startsWith('ctx_modal_warn_')) {
    await executeWarn(interaction, customId.slice('ctx_modal_warn_'.length));
    return true;
  }
  if (customId.startsWith('ctx_modal_timeout_')) {
    await executeTimeout(interaction, customId.slice('ctx_modal_timeout_'.length));
    return true;
  }
  if (customId.startsWith('ctx_modal_kick_')) {
    await executeKick(interaction, customId.slice('ctx_modal_kick_'.length));
    return true;
  }
  if (customId.startsWith('ctx_modal_ban_')) {
    await executeBan(interaction, customId.slice('ctx_modal_ban_'.length));
    return true;
  }
  if (customId.startsWith('ctx_ticket_msg_')) {
    await createTicketFromMessage(interaction);
    return true;
  }
  if (customId.startsWith('ctx_report_')) {
    await sendReport(interaction);
    return true;
  }

  return false;
}

// ── Moderation action executors ───────────────────────────────────────────────

async function executeWarn(interaction: ModalSubmitInteraction, targetUserId: string) {
  if (!interaction.guild) return;
  const reason = interaction.fields.getTextInputValue('reason');

  await storage.createModerationLog({
    serverId: interaction.guild.id,
    moderatorId: interaction.user.id,
    targetUserId,
    action: 'warn',
    reason,
  });

  const target = await interaction.guild.members.fetch(targetUserId).catch(() => null);

  try {
    await target?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffcc00)
          .setTitle('⚠️ You have been warned')
          .setDescription(`**Server:** ${interaction.guild.name}\n**Reason:** ${reason}`)
          .setTimestamp(),
      ],
    });
  } catch { /* DMs closed */ }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('⚠️ Warning Issued')
        .setDescription(`Warned ${target?.toString() ?? `<@${targetUserId}>`}`)
        .addFields({ name: 'Reason', value: reason })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

async function executeTimeout(interaction: ModalSubmitInteraction, targetUserId: string) {
  if (!interaction.guild) return;
  const reason = interaction.fields.getTextInputValue('reason');
  const durationStr = interaction.fields.getTextInputValue('duration');
  const durationMs = parseDurationMs(durationStr);
  const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

  if (!durationMs || durationMs > MAX_TIMEOUT_MS) {
    await interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `1h`, `2d` (max 28d).', ephemeral: true });
    return;
  }

  const target = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!target) {
    await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    return;
  }

  await target.timeout(durationMs, reason);

  await storage.createModerationLog({
    serverId: interaction.guild.id,
    moderatorId: interaction.user.id,
    targetUserId,
    action: 'timeout',
    reason,
    duration: String(Math.floor(durationMs / 1000)),
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff8800)
        .setTitle('⏱️ User Timed Out')
        .setDescription(`Timed out ${target.toString()} for **${durationStr}**`)
        .addFields({ name: 'Reason', value: reason })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

async function executeKick(interaction: ModalSubmitInteraction, targetUserId: string) {
  if (!interaction.guild) return;
  const reason = interaction.fields.getTextInputValue('reason');

  const target = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!target) {
    await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    return;
  }

  await target.kick(reason);

  await storage.createModerationLog({
    serverId: interaction.guild.id,
    moderatorId: interaction.user.id,
    targetUserId,
    action: 'kick',
    reason,
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('👢 User Kicked')
        .setDescription(`Kicked ${target.toString()} from the server`)
        .addFields({ name: 'Reason', value: reason })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

async function executeBan(interaction: ModalSubmitInteraction, targetUserId: string) {
  if (!interaction.guild) return;
  const reason = interaction.fields.getTextInputValue('reason');
  const deleteDays = Math.min(parseInt(interaction.fields.getTextInputValue('delete_days') || '0') || 0, 7);

  await interaction.guild.bans.create(targetUserId, { reason, deleteMessageSeconds: deleteDays * 86400 });

  await storage.createModerationLog({
    serverId: interaction.guild.id,
    moderatorId: interaction.user.id,
    targetUserId,
    action: 'ban',
    reason,
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🔨 User Banned')
        .setDescription(`Banned <@${targetUserId}> from the server`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'Messages Deleted', value: `${deleteDays} day(s)`, inline: true },
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

async function createTicketFromMessage(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const subject = interaction.fields.getTextInputValue('subject');
  const description = interaction.fields.getTextInputValue('description') || 'No additional details.';

  const existing = await storage.getServerTickets(interaction.guild.id, 'open');
  if (existing.some(t => t.userId === interaction.user.id)) {
    await interaction.reply({ content: 'You already have an open ticket. Close it before opening a new one.', ephemeral: true });
    return;
  }

  const server = await storage.getDiscordServer(interaction.guild.id);
  const supportRoleId = (server as any)?.settings?.supportRoleId;
  const ticketCategoryId = (server as any)?.settings?.ticketCategoryId;

  const ticketChannel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
    type: ChannelType.GuildText,
    parent: ticketCategoryId || null,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
    ],
  }) as TextChannel;

  if (supportRoleId) {
    await ticketChannel.permissionOverwrites.create(supportRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  }

  const ticket = await storage.createTicket({
    serverId: interaction.guild.id,
    userId: interaction.user.id,
    channelId: ticketChannel.id,
    subject,
    priority: 'medium',
  });

  const embed = new EmbedBuilder()
    .setColor(0xffff00)
    .setTitle(`🎫 Ticket #${ticket.id.slice(-8)}`)
    .setDescription(`**Subject:** ${subject}\n\n${description}`)
    .addFields(
      { name: '👤 Opened by', value: interaction.user.toString(), inline: true },
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

  await interaction.reply({ content: `✅ Ticket created: ${ticketChannel.toString()}`, ephemeral: true });
}

async function sendReport(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;
  const reason = interaction.fields.getTextInputValue('reason');

  // Extract messageId and channelId from customId (ctx_report_<messageId>_<channelId>)
  const parts = interaction.customId.split('_');
  const messageId = parts[2];
  const channelId = parts[3];
  const messageLink = `https://discord.com/channels/${interaction.guild.id}/${channelId}/${messageId}`;

  const server = await storage.getDiscordServer(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🚨 Message Reported')
    .addFields(
      { name: '📢 Reported by', value: interaction.user.toString(), inline: true },
      { name: '📍 Message', value: `[Jump to message](${messageLink})`, inline: true },
      { name: '❓ Reason', value: reason },
    )
    .setTimestamp();

  if (server?.staffLogChannelId) {
    const staffChannel = interaction.guild.channels.cache.get(server.staffLogChannelId) as TextChannel | undefined;
    if (staffChannel) await staffChannel.send({ embeds: [embed] });
  }

  await interaction.reply({ content: '✅ Your report has been submitted to the moderation team.', ephemeral: true });
}

export const contextMenuCommands = [moderateUserMenu, modHistoryMenu, createTicketFromMessageMenu, reportMessageMenu];
