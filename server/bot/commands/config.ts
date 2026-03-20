import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { db } from '../../db';
import { discordServers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../../storage';
import { error } from '../../utils/logger';

// ── Settings type ─────────────────────────────────────────────────────────────

export interface ServerSettings {
  automod?: {
    spamEnabled?: boolean;
    inviteEnabled?: boolean;
    wordFilterEnabled?: boolean;
    bannedWords?: string[];
  };
  levelRolesEnabled?: boolean;
  levelUpChannelId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSettings(serverId: string): Promise<ServerSettings> {
  const [server] = await db.select().from(discordServers).where(eq(discordServers.id, serverId)).limit(1);
  return (server?.settings as ServerSettings) ?? {};
}

async function saveSettings(serverId: string, patch: ServerSettings): Promise<void> {
  const current = await getSettings(serverId);
  const merged: ServerSettings = {
    ...current,
    ...patch,
    automod: { ...current.automod, ...patch.automod },
  };
  await db.update(discordServers).set({ settings: merged }).where(eq(discordServers.id, serverId));
}

// ── /config command ───────────────────────────────────────────────────────────

export const configCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /config view
    .addSubcommand(sub =>
      sub.setName('view').setDescription('Show current server configuration'))

    // /config welcome
    .addSubcommand(sub =>
      sub.setName('welcome').setDescription('Configure welcome messages')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to send welcome messages in').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addStringOption(o => o.setName('message').setDescription('Welcome message — use {user}, {server}, {count} as placeholders').setRequired(false))
        .addBooleanOption(o => o.setName('disable').setDescription('Disable welcome messages').setRequired(false)))

    // /config stafflog
    .addSubcommand(sub =>
      sub.setName('stafflog').setDescription('Set the staff/audit log channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel for staff log messages').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addBooleanOption(o => o.setName('disable').setDescription('Disable staff log').setRequired(false)))

    // /config levelup
    .addSubcommand(sub =>
      sub.setName('levelup').setDescription('Configure level-up announcements and role rewards')
        .addChannelOption(o => o.setName('channel').setDescription('Channel for level-up announcements (leave blank to use system channel)').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addBooleanOption(o => o.setName('roles').setDescription('Enable or disable automatic level-up role rewards').setRequired(false))
        .addBooleanOption(o => o.setName('disable-channel').setDescription('Stop sending level-up announcements').setRequired(false)))

    // /config automod
    .addSubcommand(sub =>
      sub.setName('automod').setDescription('Configure auto-moderation')
        .addBooleanOption(o => o.setName('spam').setDescription('Enable/disable spam detection (5+ msgs in 5 sec)').setRequired(false))
        .addBooleanOption(o => o.setName('invites').setDescription('Enable/disable Discord invite link blocking').setRequired(false))
        .addBooleanOption(o => o.setName('wordfilter').setDescription('Enable/disable the banned word filter').setRequired(false))
        .addStringOption(o => o.setName('add-word').setDescription('Add a word to the banned word list').setRequired(false))
        .addStringOption(o => o.setName('remove-word').setDescription('Remove a word from the banned word list').setRequired(false))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case 'view':        return handleView(interaction);
        case 'welcome':     return handleWelcome(interaction);
        case 'stafflog':    return handleStaffLog(interaction);
        case 'levelup':     return handleLevelUp(interaction);
        case 'automod':     return handleAutomod(interaction);
        default:
          await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
      }
    } catch (err) {
      error('Error in /config:', err);
      const msg = { content: 'An error occurred while updating settings.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  },
};

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;

  const [server] = await db.select().from(discordServers).where(eq(discordServers.id, guild.id)).limit(1);
  const settings = (server?.settings as ServerSettings) ?? {};
  const automod = settings.automod ?? {};

  const ch = (id?: string | null) => id ? `<#${id}>` : '`not set`';
  const bool = (v?: boolean) => v ? '✅ Enabled' : '❌ Disabled';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`⚙️ Server Configuration — ${guild.name}`)
    .addFields(
      {
        name: '👋 Welcome',
        value: [
          `Channel: ${ch(server?.welcomeChannelId)}`,
          `Message: ${server?.welcomeMessage ? `\`${server.welcomeMessage.slice(0, 60)}${server.welcomeMessage.length > 60 ? '…' : ''}\`` : '`default`'}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📋 Staff Log',
        value: `Channel: ${ch(server?.staffLogChannelId)}`,
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: '⬆️ Level-Up',
        value: [
          `Announce channel: ${ch(settings.levelUpChannelId)}`,
          `Role rewards: ${bool(settings.levelRolesEnabled)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🛡️ Auto-Mod',
        value: [
          `Spam filter: ${bool(automod.spamEnabled)}`,
          `Invite filter: ${bool(automod.inviteEnabled)}`,
          `Word filter: ${bool(automod.wordFilterEnabled)}`,
          `Banned words: ${automod.bannedWords?.length ?? 0}`,
        ].join('\n'),
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleWelcome(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');
  const disable = interaction.options.getBoolean('disable');

  if (!channel && message === null && disable === null) {
    await interaction.reply({ content: 'Provide at least one option: `channel`, `message`, or `disable`.', ephemeral: true });
    return;
  }

  const updates: Partial<typeof discordServers.$inferSelect> = {};
  const lines: string[] = [];

  if (disable) {
    updates.welcomeChannelId = null;
    lines.push('Welcome messages **disabled**.');
  } else {
    if (channel) { updates.welcomeChannelId = channel.id; lines.push(`Welcome channel set to <#${channel.id}>.`); }
    if (message !== null) { updates.welcomeMessage = message; lines.push(`Welcome message updated.`); }
  }

  await db.update(discordServers).set(updates).where(eq(discordServers.id, interaction.guild!.id));
  await interaction.reply({ content: `✅ ${lines.join(' ')}`, ephemeral: true });
}

async function handleStaffLog(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');
  const disable = interaction.options.getBoolean('disable');

  if (!channel && disable === null) {
    await interaction.reply({ content: 'Provide `channel` or `disable`.', ephemeral: true });
    return;
  }

  if (disable) {
    await db.update(discordServers).set({ staffLogChannelId: null }).where(eq(discordServers.id, interaction.guild!.id));
    await interaction.reply({ content: '✅ Staff log **disabled**.', ephemeral: true });
  } else if (channel) {
    await db.update(discordServers).set({ staffLogChannelId: channel.id }).where(eq(discordServers.id, interaction.guild!.id));
    await interaction.reply({ content: `✅ Staff log channel set to <#${channel.id}>.`, ephemeral: true });
  }
}

async function handleLevelUp(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');
  const roles = interaction.options.getBoolean('roles');
  const disableChannel = interaction.options.getBoolean('disable-channel');

  if (!channel && roles === null && disableChannel === null) {
    await interaction.reply({ content: 'Provide at least one option: `channel`, `roles`, or `disable-channel`.', ephemeral: true });
    return;
  }

  const patch: ServerSettings = {};
  const lines: string[] = [];

  if (disableChannel) {
    patch.levelUpChannelId = null;
    lines.push('Level-up announcements will use the system channel (or be silent if none).');
  } else if (channel) {
    patch.levelUpChannelId = channel.id;
    lines.push(`Level-up announcements will go to <#${channel.id}>.`);
  }

  if (roles !== null) {
    patch.levelRolesEnabled = roles;
    lines.push(`Level-up role rewards **${roles ? 'enabled' : 'disabled'}**.`);
  }

  await saveSettings(interaction.guild!.id, patch);
  await interaction.reply({ content: `✅ ${lines.join(' ')}`, ephemeral: true });
}

async function handleAutomod(interaction: ChatInputCommandInteraction) {
  const spam       = interaction.options.getBoolean('spam');
  const invites    = interaction.options.getBoolean('invites');
  const wordfilter = interaction.options.getBoolean('wordfilter');
  const addWord    = interaction.options.getString('add-word')?.toLowerCase().trim();
  const removeWord = interaction.options.getString('remove-word')?.toLowerCase().trim();

  if (spam === null && invites === null && wordfilter === null && !addWord && !removeWord) {
    await interaction.reply({ content: 'Provide at least one option.', ephemeral: true });
    return;
  }

  const current = await getSettings(interaction.guild!.id);
  const automod = { ...current.automod };
  const lines: string[] = [];

  if (spam !== null)       { automod.spamEnabled = spam;             lines.push(`Spam filter **${spam ? 'enabled' : 'disabled'}**.`); }
  if (invites !== null)    { automod.inviteEnabled = invites;        lines.push(`Invite filter **${invites ? 'enabled' : 'disabled'}**.`); }
  if (wordfilter !== null) { automod.wordFilterEnabled = wordfilter; lines.push(`Word filter **${wordfilter ? 'enabled' : 'disabled'}**.`); }

  if (addWord) {
    const words = new Set(automod.bannedWords ?? []);
    words.add(addWord);
    automod.bannedWords = [...words];
    lines.push(`Added \`${addWord}\` to the word filter.`);
  }

  if (removeWord) {
    const words = new Set(automod.bannedWords ?? []);
    words.delete(removeWord);
    automod.bannedWords = [...words];
    lines.push(`Removed \`${removeWord}\` from the word filter.`);
  }

  await saveSettings(interaction.guild!.id, { automod });
  await interaction.reply({ content: `✅ ${lines.join(' ')}`, ephemeral: true });
}

// ── /levelrole command ────────────────────────────────────────────────────────

export const levelRoleCommand = {
  data: new SlashCommandBuilder()
    .setName('levelrole')
    .setDescription('Manage roles awarded at specific levels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand(sub =>
      sub.setName('add').setDescription('Award a role when a user reaches a level')
        .addIntegerOption(o => o.setName('level').setDescription('Level that triggers the role').setRequired(true).setMinValue(1))
        .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('Which XP track (default: global)').setRequired(false)
          .addChoices(
            { name: 'Global (average of text + voice)', value: 'global' },
            { name: 'Text XP', value: 'text' },
            { name: 'Voice XP', value: 'voice' },
          )))

    .addSubcommand(sub =>
      sub.setName('remove').setDescription('Remove a level role assignment')
        .addIntegerOption(o => o.setName('level').setDescription('Level to remove the role from').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('XP track (default: global)').setRequired(false)
          .addChoices(
            { name: 'Global', value: 'global' },
            { name: 'Text XP', value: 'text' },
            { name: 'Voice XP', value: 'voice' },
          )))

    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all level role assignments')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case 'add':    return handleLevelRoleAdd(interaction);
        case 'remove': return handleLevelRoleRemove(interaction);
        case 'list':   return handleLevelRoleList(interaction);
        default:
          await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
      }
    } catch (err) {
      error('Error in /levelrole:', err);
      const msg = { content: 'An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  },
};

async function handleLevelRoleAdd(interaction: ChatInputCommandInteraction) {
  const level    = interaction.options.getInteger('level', true);
  const role     = interaction.options.getRole('role', true);
  const type     = interaction.options.getString('type') ?? 'global';
  const serverId = interaction.guild!.id;

  await storage.upsertLevelRole({ serverId, level, roleId: role.id, levelType: type });

  await interaction.reply({
    content: `✅ <@&${role.id}> will be awarded when a user reaches **${type} level ${level}**.\n> Enable role rewards with \`/config levelup roles:True\` if not already on.`,
    ephemeral: true,
  });
}

async function handleLevelRoleRemove(interaction: ChatInputCommandInteraction) {
  const level  = interaction.options.getInteger('level', true);
  const type   = interaction.options.getString('type') ?? 'global';

  const deleted = await storage.deleteLevelRole(interaction.guild!.id, level, type);

  if (!deleted) {
    await interaction.reply({ content: `No role assignment found for ${type} level ${level}.`, ephemeral: true });
    return;
  }

  await interaction.reply({ content: `✅ Removed the role assignment for **${type} level ${level}**.`, ephemeral: true });
}

async function handleLevelRoleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const serverId = interaction.guild!.id;
  const rows = await storage.getLevelRoles(serverId);
  const settings = await getSettings(serverId);

  if (rows.length === 0) {
    await interaction.editReply({ content: 'No level roles configured. Use `/levelrole add` to set one up.' });
    return;
  }

  const byType: Record<string, string[]> = { global: [], text: [], voice: [] };
  for (const r of rows) {
    byType[r.levelType]?.push(`Level **${r.level}** → <@&${r.roleId}>`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🏅 Level Role Assignments')
    .setDescription(`Role rewards are currently **${settings.levelRolesEnabled ? '✅ enabled' : '❌ disabled'}**.\nToggle with \`/config levelup roles:True/False\`.`)
    .setTimestamp();

  for (const [type, lines] of Object.entries(byType)) {
    if (lines.length) embed.addFields({ name: `${type.charAt(0).toUpperCase() + type.slice(1)} XP`, value: lines.join('\n'), inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}
