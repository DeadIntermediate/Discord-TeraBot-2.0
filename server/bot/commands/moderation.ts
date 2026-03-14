import { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { info, error } from '../../utils/logger';

const kickCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.kickable) {
        await interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
        return;
      }

      await member.kick(reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'kick',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('User Kicked')
        .setDescription(`${user.tag} has been kicked from the server.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      error('Error kicking user:', error);
      await interaction.reply({ content: 'An error occurred while kicking the user.', ephemeral: true });
    }
  },
};

const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_messages')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      await interaction.guild.bans.create(user.id, {
        reason,
        deleteMessageDays,
      });

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'ban',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff4757)
        .setTitle('User Banned')
        .setDescription(`${user.tag} has been banned from the server.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      error('Error banning user:', error);
      await interaction.reply({ content: 'An error occurred while banning the user.', ephemeral: true });
    }
  },
};

const muteCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)) // 28 days max
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.moderatable) {
        await interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });
        return;
      }

      const timeoutEnd = new Date(Date.now() + duration * 60000);
      await member.timeout(duration * 60000, reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'mute',
        reason,
        duration,
        channelId: interaction.channel?.id,
        expiresAt: timeoutEnd,
      });

      const embed = new EmbedBuilder()
        .setColor(0xffa502)
        .setTitle('User Timed Out')
        .setDescription(`${user.tag} has been timed out.`)
        .addFields(
          { name: 'Duration', value: `${duration} minutes`, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      error('Error timing out user:', error);
      await interaction.reply({ content: 'An error occurred while timing out the user.', ephemeral: true });
    }
  },
};

const clearCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    
    if (!interaction.channel || !('bulkDelete' in interaction.channel)) {
      await interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
      return;
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);

      // Log to database
      if (interaction.guild) {
        await storage.createModerationLog({
          serverId: interaction.guild.id,
          moderatorId: interaction.user.id,
          targetUserId: interaction.user.id, // Self for bulk delete
          action: 'clear',
          reason: `Cleared ${deleted.size} messages`,
          channelId: interaction.channel.id,
        });
      }

      await interaction.reply({ 
        content: `Successfully deleted ${deleted.size} messages.`, 
        ephemeral: true 
      });
    } catch (error) {
      error('Error clearing messages:', error);
      await interaction.reply({ 
        content: 'An error occurred while clearing messages.', 
        ephemeral: true 
      });
    }
  },
};

const jailCommand = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail a user (restrict to jail channel only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to jail')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for jailing')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes (leave empty for permanent)')
        .setRequired(false)
        .setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const duration = interaction.options.getInteger('duration');
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.moderatable) {
        await interaction.reply({ content: 'I cannot jail this user.', ephemeral: true });
        return;
      }

      // Get server settings for jail role and channel
      const server = await storage.getDiscordServer(interaction.guild.id);
  const jailRoleId = (server as any)?.settings?.jailRoleId;
  const jailChannelId = (server as any)?.settings?.jailChannelId;

      if (!jailRoleId) {
        await interaction.reply({ 
          content: 'Jail role not configured. Please set up a jail role in server settings.', 
          ephemeral: true 
        });
        return;
      }

      const jailRole = interaction.guild.roles.cache.get(jailRoleId);
      if (!jailRole) {
        await interaction.reply({ 
          content: 'Jail role not found. Please reconfigure the jail role.', 
          ephemeral: true 
        });
        return;
      }

      // Add jail role
      await member.roles.add(jailRole, reason);

      // Calculate expiration if duration is provided
      let expiresAt: Date | undefined;
      if (duration) {
        expiresAt = new Date(Date.now() + duration * 60000);
      }

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'jail',
        reason,
        duration,
        channelId: interaction.channel?.id,
        expiresAt,
      });

      const embed = new EmbedBuilder()
        .setColor(0x8b4513) // Brown color for jail
        .setTitle('🔒 User Jailed')
        .setDescription(`${user.tag} has been jailed.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Duration', value: duration ? `${duration} minutes` : 'Permanent', inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      if (jailChannelId) {
        embed.addFields({ 
          name: 'Jail Channel', 
          value: `<#${jailChannelId}>`, 
          inline: true 
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Schedule unjail if duration is set
      if (duration && expiresAt) {
        scheduleAutoUnjail(
          interaction.client,
          interaction.guild.id,
          user.id,
          jailRoleId,
          duration * 60000,
          interaction.channel?.id,
        );
      }

    } catch (error) {
      error('Error jailing user:', error);
      await interaction.reply({ content: 'An error occurred while jailing the user.', ephemeral: true });
    }
  },
};

const unjailCommand = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Remove a user from jail')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to unjail')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unjailing')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      // Get server settings for jail role
      const server = await storage.getDiscordServer(interaction.guild.id);
  const jailRoleId = (server as any)?.settings?.jailRoleId;

      if (!jailRoleId) {
        await interaction.reply({ 
          content: 'Jail role not configured.', 
          ephemeral: true 
        });
        return;
      }

      const jailRole = interaction.guild.roles.cache.get(jailRoleId);
      if (!jailRole) {
        await interaction.reply({ 
          content: 'Jail role not found.', 
          ephemeral: true 
        });
        return;
      }

      if (!member.roles.cache.has(jailRoleId)) {
        await interaction.reply({ 
          content: 'This user is not jailed.', 
          ephemeral: true 
        });
        return;
      }

      // Remove jail role
      await member.roles.remove(jailRole, reason);

      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'unjail',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00) // Green for success
        .setTitle('🔓 User Unjailed')
        .setDescription(`${user.tag} has been released from jail.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      error('Error unjailing user:', error);
      await interaction.reply({ content: 'An error occurred while unjailing the user.', ephemeral: true });
    }
  },
};

const warnCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      // Log to database
      await storage.createModerationLog({
        serverId: interaction.guild.id,
        moderatorId: interaction.user.id,
        targetUserId: user.id,
        action: 'warn',
        reason,
        channelId: interaction.channel?.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xffff00) // Yellow for warning
        .setTitle('⚠️ User Warned')
        .setDescription(`${user.tag} has been warned.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Try to send DM to the warned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xffff00)
          .setTitle('⚠️ Warning Received')
          .setDescription(`You have received a warning in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (error) {
        // User has DMs disabled, continue silently
      }

    } catch (error) {
      error('Error warning user:', error);
      await interaction.reply({ content: 'An error occurred while warning the user.', ephemeral: true });
    }
  },
};

const modHistoryCommand = {
  data: new SlashCommandBuilder()
    .setName('modhistory')
    .setDescription('View moderation history for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check history for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const history = await storage.getUserModerationHistory(user.id, interaction.guild.id);

      if (history.length === 0) {
        await interaction.reply({ 
          content: `${user.tag} has no moderation history.`, 
          ephemeral: true 
        });
        return;
      }

      const historyList = history.slice(0, 10).map(log => {
        const actionEmoji = {
          warn: '⚠️',
          mute: '🔇',
          jail: '🔒',
          unjail: '🔓',
          kick: '👢',
          ban: '🔨',
          clear: '🧹'
        }[log.action] || '📝';

  const dateStr = new Date(log.createdAt ?? Date.now()).toLocaleDateString();
        return `${actionEmoji} **${log.action.toUpperCase()}** - ${log.reason} (${dateStr})`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 Moderation History: ${user.tag}`)
        .setDescription(historyList)
        .setFooter({ text: `Showing ${Math.min(history.length, 10)} of ${history.length} entries` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      error('Error fetching moderation history:', error);
      await interaction.reply({ 
        content: 'An error occurred while fetching moderation history.', 
        ephemeral: true 
      });
    }
  },
};

export function scheduleAutoUnjail(
  client: Client,
  guildId: string,
  userId: string,
  jailRoleId: string,
  delayMs: number,
  channelId?: string,
) {
  setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      const jailRole = guild.roles.cache.get(jailRoleId);
      if (!jailRole || !member.roles.cache.has(jailRoleId)) return;
      await member.roles.remove(jailRole, 'Jail duration expired');
      await storage.createModerationLog({
        serverId: guildId,
        moderatorId: client.user!.id,
        targetUserId: userId,
        action: 'unjail',
        reason: 'Jail duration expired (automatic)',
        channelId,
      });
    } catch (err) {
      error('Error auto-unjailing user:', err);
    }
  }, delayMs);
}

export async function recoverJails(client: Client): Promise<void> {
  const activeJails = await storage.getActiveFutureJails();
  let scheduled = 0;

  for (const jailLog of activeJails) {
    const server = await storage.getDiscordServer(jailLog.serverId);
    const jailRoleId = (server as any)?.settings?.jailRoleId;
    if (!jailRoleId || !jailLog.expiresAt) continue;

    const delayMs = jailLog.expiresAt.getTime() - Date.now();
    if (delayMs <= 0) {
      // Already expired — unjail immediately
      scheduleAutoUnjail(client, jailLog.serverId, jailLog.targetUserId, jailRoleId, 0, jailLog.channelId ?? undefined);
    } else {
      scheduleAutoUnjail(client, jailLog.serverId, jailLog.targetUserId, jailRoleId, delayMs, jailLog.channelId ?? undefined);
    }
    scheduled++;
  }

  info(`🔒 Jail recovery: ${scheduled} active jail(s) rescheduled`);
}

export const moderationCommands = [
  kickCommand,
  banCommand,
  muteCommand,
  clearCommand,
  jailCommand,
  unjailCommand,
  warnCommand,
  modHistoryCommand,
];
