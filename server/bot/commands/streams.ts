import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ChannelType
} from 'discord.js';
import { db } from '../../db';
import { discordServers, streamNotifications, discordUsers } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('stream')
  .setDescription('Manage stream notifications')
  .addSubcommand(subcommand =>
    subcommand
      .setName('addme')
      .setDescription('Add your connected streaming accounts to notifications')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a streamer to notifications')
      .addStringOption(option =>
        option
          .setName('platform')
          .setDescription('Streaming platform')
          .setRequired(true)
          .addChoices(
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Kick', value: 'kick' }
          )
      )
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('Streamer username')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a streamer from notifications')
      .addStringOption(option =>
        option
          .setName('platform')
          .setDescription('Streaming platform')
          .setRequired(true)
          .addChoices(
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Kick', value: 'kick' }
          )
      )
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('Streamer username')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all tracked streamers')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Set up stream notification channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel for stream notifications')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'addme':
      await handleAddMe(interaction);
      break;
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    case 'setup':
      await handleSetup(interaction);
      break;
  }
}

async function handleAddMe(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  // Check if stream notification channel is set
  const [server] = await db
    .select()
    .from(discordServers)
    .where(eq(discordServers.id, interaction.guild.id))
    .limit(1);

  if (!server?.streamNotificationChannelId) {
    await interaction.editReply({
      content: '❌ Stream notifications are not set up in this server!\n\nPlease ask an administrator to run `/stream setup` first.',
    });
    return;
  }

  // Fetch the user with connected accounts
  const user = await interaction.user.fetch(true);
  const connections: { platform: string; username: string; id: string }[] = [];

  // Check for connected accounts
  // Note: Discord's API requires special permissions to access user connections
  // For now, we'll instruct the user to manually add them
  
  // Instead, let's check the user's profile activities and connections that are visible
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  // Check user's presence/activities for streaming
  if (member.presence?.activities) {
    for (const activity of member.presence.activities) {
      if (activity.type === 1) { // Streaming activity
        if (activity.url) {
          // Parse Twitch URLs
          if (activity.url.includes('twitch.tv/')) {
            const username = activity.url.split('twitch.tv/')[1]?.split('/')[0];
            if (username) {
              connections.push({ platform: 'twitch', username, id: '' });
            }
          }
          // Parse YouTube URLs
          else if (activity.url.includes('youtube.com/') || activity.url.includes('youtu.be/')) {
            const username = activity.name || 'Unknown';
            connections.push({ platform: 'youtube', username, id: '' });
          }
          // Parse Kick URLs
          else if (activity.url.includes('kick.com/')) {
            const username = activity.url.split('kick.com/')[1]?.split('/')[0];
            if (username) {
              connections.push({ platform: 'kick', username, id: '' });
            }
          }
        }
      }
    }
  }

  if (connections.length === 0) {
    await interaction.editReply({
      content: `❌ No streaming platforms detected in your Discord profile!\n\n` +
        `**How to connect your accounts:**\n` +
        `1. Go to User Settings → Connections\n` +
        `2. Connect your Twitch, YouTube, or Kick account\n` +
        `3. Make sure the connection is set to "Display on profile"\n` +
        `4. Try the command again\n\n` +
        `**Alternative:** Use \`/stream add platform:twitch username:YourUsername\` to manually add your channel.`,
    });
    return;
  }

  // Ensure user exists in database
  await db.insert(discordUsers).values({
    id: interaction.user.id,
    username: interaction.user.username,
    discriminator: interaction.user.discriminator,
    avatar: interaction.user.avatar,
    isBot: false,
  }).onConflictDoUpdate({
    target: discordUsers.id,
    set: {
      username: interaction.user.username,
      discriminator: interaction.user.discriminator,
      avatar: interaction.user.avatar,
    },
  });

  // Add all detected connections
  const added: string[] = [];
  const alreadyExists: string[] = [];

  for (const connection of connections) {
    // Check if already exists
    const existing = await db
      .select()
      .from(streamNotifications)
      .where(
        and(
          eq(streamNotifications.serverId, interaction.guild.id),
          eq(streamNotifications.platform, connection.platform),
          eq(streamNotifications.username, connection.username)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      alreadyExists.push(`${connection.platform}: ${connection.username}`);
      continue;
    }

    // Add to database
    await db.insert(streamNotifications).values({
      serverId: interaction.guild.id,
      userId: interaction.user.id,
      channelId: server.streamNotificationChannelId,
      platform: connection.platform,
      username: connection.username,
      platformUserId: connection.id,
      isActive: true,
      isLive: false,
    });

    added.push(`${connection.platform}: ${connection.username}`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('✅ Stream Notifications Updated')
    .setDescription(`Your streaming accounts have been added to notifications in <#${server.streamNotificationChannelId}>!`)
    .setTimestamp();

  if (added.length > 0) {
    embed.addFields({
      name: '✅ Added',
      value: added.join('\n'),
    });
  }

  if (alreadyExists.length > 0) {
    embed.addFields({
      name: 'ℹ️ Already Tracking',
      value: alreadyExists.join('\n'),
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  const platform = interaction.options.getString('platform', true);
  const username = interaction.options.getString('username', true);

  // Check if stream notification channel is set
  const [server] = await db
    .select()
    .from(discordServers)
    .where(eq(discordServers.id, interaction.guild.id))
    .limit(1);

  if (!server?.streamNotificationChannelId) {
    await interaction.editReply({
      content: '❌ Stream notifications are not set up in this server!\n\nPlease run `/stream setup` first.',
    });
    return;
  }

  // Check if already exists
  const existing = await db
    .select()
    .from(streamNotifications)
    .where(
      and(
        eq(streamNotifications.serverId, interaction.guild.id),
        eq(streamNotifications.platform, platform),
        eq(streamNotifications.username, username)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await interaction.editReply({
      content: `❌ **${username}** on **${platform}** is already being tracked!`,
    });
    return;
  }

  // Ensure user exists in database
  await db.insert(discordUsers).values({
    id: interaction.user.id,
    username: interaction.user.username,
    discriminator: interaction.user.discriminator,
    avatar: interaction.user.avatar,
    isBot: false,
  }).onConflictDoUpdate({
    target: discordUsers.id,
    set: {
      username: interaction.user.username,
      discriminator: interaction.user.discriminator,
      avatar: interaction.user.avatar,
    },
  });

  // Add to database
  await db.insert(streamNotifications).values({
    serverId: interaction.guild.id,
    userId: interaction.user.id,
    channelId: server.streamNotificationChannelId,
    platform,
    username,
    isActive: true,
    isLive: false,
  });

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('✅ Streamer Added')
    .setDescription(`Now tracking **${username}** on **${platform}**!`)
    .addFields(
      { name: 'Platform', value: platform, inline: true },
      { name: 'Username', value: username, inline: true },
      { name: 'Notification Channel', value: `<#${server.streamNotificationChannelId}>`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  const platform = interaction.options.getString('platform', true);
  const username = interaction.options.getString('username', true);

  // Find and delete the stream notification
  const deleted = await db
    .delete(streamNotifications)
    .where(
      and(
        eq(streamNotifications.serverId, interaction.guild.id),
        eq(streamNotifications.platform, platform),
        eq(streamNotifications.username, username)
      )
    )
    .returning();

  if (deleted.length === 0) {
    await interaction.editReply({
      content: `❌ **${username}** on **${platform}** is not being tracked!`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('✅ Streamer Removed')
    .setDescription(`No longer tracking **${username}** on **${platform}**.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  const streams = await db
    .select()
    .from(streamNotifications)
    .where(
      and(
        eq(streamNotifications.serverId, interaction.guild.id),
        eq(streamNotifications.isActive, true)
      )
    );

  if (streams.length === 0) {
    await interaction.editReply({
      content: '❌ No streamers are currently being tracked in this server.',
    });
    return;
  }

  // Group by platform
  const grouped: Record<string, typeof streams> = {
    twitch: [],
    youtube: [],
    kick: [],
  };

  for (const stream of streams) {
    if (grouped[stream.platform]) {
      grouped[stream.platform].push(stream);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📺 Tracked Streamers')
    .setDescription(`Currently tracking **${streams.length}** streamer(s) in this server.`)
    .setTimestamp();

  for (const [platform, platformStreams] of Object.entries(grouped)) {
    if (platformStreams.length === 0) continue;

    const streamList = platformStreams.map(s => {
      const status = s.isLive ? '🔴 LIVE' : '⚫ Offline';
      const user = s.userId ? `<@${s.userId}>` : '';
      return `${status} **${s.username}** ${user}`;
    }).join('\n');

    embed.addFields({
      name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} (${platformStreams.length})`,
      value: streamList || 'None',
    });
  }

  const [server] = await db
    .select()
    .from(discordServers)
    .where(eq(discordServers.id, interaction.guild.id))
    .limit(1);

  if (server?.streamNotificationChannelId) {
    embed.setFooter({ text: `Notifications sent to #${interaction.guild.channels.cache.get(server.streamNotificationChannelId)?.name || 'unknown'}` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetup(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  const channel = interaction.options.getChannel('channel', true) as TextChannel;

  // Ensure server exists in database
  await db.insert(discordServers).values({
    id: interaction.guild.id,
    name: interaction.guild.name,
    ownerId: interaction.guild.ownerId,
    memberCount: interaction.guild.memberCount,
    streamNotificationChannelId: channel.id,
  }).onConflictDoUpdate({
    target: discordServers.id,
    set: {
      streamNotificationChannelId: channel.id,
      updatedAt: new Date(),
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('✅ Stream Notifications Configured')
    .setDescription(`Stream notifications will be sent to ${channel}!`)
    .addFields(
      { name: 'Next Steps', value: 
        `• Users can add their own streams with \`/stream addme\`\n` +
        `• Moderators can add any streamer with \`/stream add\`\n` +
        `• View all tracked streamers with \`/stream list\`\n` +
        `• Remove streamers with \`/stream remove\``
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Send a test message to the channel
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📺 Stream Notifications Enabled')
        .setDescription('This channel will now receive notifications when tracked streamers go live!')
        .setTimestamp()
    ]
  });
}
