import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { db } from '../../db';
import { discordServers, streamNotifications, discordUsers } from '../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

  // Create embed with instructions
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎬 Add Your Streaming Accounts')
    .setDescription(
      `To get stream notifications, you need to add your streaming accounts.\n\n` +
      `**Note:** Discord's API doesn't allow bots to read your connected accounts directly for privacy reasons.\n\n` +
      `Click below to add your streaming accounts manually (it's quick!):`
    )
    .addFields(
      {
        name: '📝 How it works:',
        value:
          '1. Click the button for your streaming platform\n' +
          '2. Enter your username\n' +
          '3. Done! We\'ll notify when you go live',
        inline: false
      },
      {
        name: '🎥 Supported Platforms:',
        value: '• Twitch\n• YouTube\n• Kick',
        inline: false
      }
    )
    .setFooter({ text: 'Your accounts are safe and only used for stream notifications' });

  // Create buttons for each platform
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('stream_add_twitch')
        .setLabel('Add Twitch')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📺'),
      new ButtonBuilder()
        .setCustomId('stream_add_youtube')
        .setLabel('Add YouTube')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('▶️'),
      new ButtonBuilder()
        .setCustomId('stream_add_kick')
        .setLabel('Add Kick')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎮')
    );

  await interaction.editReply({ 
    embeds: [embed],
    components: [row]
  });
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    const streamList = platformStreams.map((s: any) => {
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

// Button interaction handlers
export async function handleStreamButtons(interaction: any) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  if (!customId.startsWith('stream_add_')) return;

  const platform = customId.replace('stream_add_', '');
  const validPlatforms = ['twitch', 'youtube', 'kick'];
  
  if (!validPlatforms.includes(platform)) return;

  // Show modal for username input
  const modal = new ModalBuilder()
    .setCustomId(`stream_modal_${platform}_${interaction.user.id}`)
    .setTitle(`Add ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`);

  const usernameInput = new TextInputBuilder()
    .setCustomId('stream_username')
    .setLabel(`${platform.charAt(0).toUpperCase() + platform.slice(1)} Username`)
    .setPlaceholder(`Enter your ${platform} username`)
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(50)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

// Modal submission handler
export async function handleStreamModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;
  if (!customId.startsWith('stream_modal_')) return;

  // Extract platform and userId from customId: stream_modal_{platform}_{userId}
  const parts = customId.replace('stream_modal_', '').split('_');
  const userId = parts.pop(); // Get last part (userId)
  const platform = parts.join('_'); // Everything else is platform (in case platform has underscores)
  
  // Verify user
  if (interaction.user.id !== userId) {
    await interaction.reply({ 
      content: '❌ This modal is not for you!',
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  const username = interaction.fields.getTextInputValue('stream_username');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server!');
    return;
  }

  // Get server
  const [server] = await db
    .select()
    .from(discordServers)
    .where(eq(discordServers.id, interaction.guild.id))
    .limit(1);

  if (!server?.streamNotificationChannelId) {
    await interaction.editReply({
      content: '❌ Stream notifications are not set up in this server!',
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
      content: `ℹ️ **${username}** on **${platform}** is already being tracked!`,
    });
    return;
  }

  // Add to database
  try {
    // Try standard insert first
    try {
      await db.insert(streamNotifications).values({
        serverId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: server.streamNotificationChannelId,
        platform: platform,
        username: username,
        displayName: username,
        platformUserId: username,
        isActive: true,
        isLive: false,
      });
    } catch (drizzleError: any) {
      // If standard insert fails, try raw SQL with the actual database column names
      console.warn('Drizzle insert failed, trying raw SQL fallback:', drizzleError.message);
      
      // The database has both streamer_name and username columns
      await db.execute(sql`
        INSERT INTO stream_notifications 
          (id, server_id, user_id, channel_id, platform, streamer_name, username, is_active, is_live, created_at)
        VALUES 
          (gen_random_uuid(), ${interaction.guild.id}, ${interaction.user.id}, ${server.streamNotificationChannelId}, ${platform}, ${username}, ${username}, true, false, NOW())
      `);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Account Added Successfully!')
      .setDescription(`**${username}** on **${platform}** is now being tracked for stream notifications.`)
      .addFields(
        { name: '📢 Notifications', value: `When you go live on ${platform}, this server will be notified in <#${server.streamNotificationChannelId}>`, inline: false }
      )
      .setFooter({ text: 'Remove with /stream remove' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error adding stream notification - Full details:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      username,
      platform,
      guildId: interaction.guild?.id,
    });
    await interaction.editReply({
      content: '❌ An error occurred while adding your account. Please try again or contact an administrator.',
    });
  }
}
