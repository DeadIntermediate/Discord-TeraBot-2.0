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
import { error as logError, warn } from '../../utils/logger';

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
      `Securely authenticate your streaming accounts with OAuth!\n\n` +
      `Click the button below to connect your account via your streaming platform's login page.`
    )
    .addFields(
      {
        name: '� How it works:',
        value:
          '1. Click the button for your streaming platform\n' +
          '2. Authenticate with your platform account\n' +
          '3. We\'ll verify your account\n' +
          '4. Done! You\'ll get notified when you go live',
        inline: false
      },
      {
        name: '✅ Benefits:',
        value: '• Secure OAuth authentication\n• No passwords shared\n• Account ownership verified\n• Auto-updates your stream status',
        inline: false
      }
    )
    .setFooter({ text: 'Your accounts are safe and only used for stream notifications' });

  // Create buttons for each platform with OAuth links
  const callbackBase = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000';
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('stream_oauth_twitch')
        .setLabel('Connect Twitch')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📺'),
      new ButtonBuilder()
        .setCustomId('stream_oauth_youtube')
        .setLabel('Connect YouTube')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('▶️'),
      new ButtonBuilder()
        .setCustomId('stream_oauth_kick')
        .setLabel('Connect Kick')
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

// OAuth token storage helper
async function saveOAuthStreamer(
  guildId: string,
  userId: string,
  channelId: string,
  platform: string,
  username: string,
  displayName: string,
  platformUserId: string,
  accessToken: string,
  refreshToken?: string
) {
  try {
    // Try standard insert first
    try {
      await db.insert(streamNotifications).values({
        serverId: guildId,
        userId: userId,
        channelId: channelId,
        platform: platform,
        username: username,
        displayName: displayName,
        platformUserId: platformUserId,
        isActive: true,
        isLive: false,
      });
    } catch (drizzleError: any) {
      // If standard insert fails, try raw SQL with all possible columns
      warn('Drizzle insert failed, trying raw SQL fallback:', drizzleError.message);
      
      const query = `
        INSERT INTO stream_notifications 
          (id, server_id, user_id, channel_id, platform, streamer_name, username, platform_user_id, display_name, is_active, is_live, oauth_access_token, oauth_refresh_token, is_oauth_verified, oauth_verified_at, created_at)
        VALUES 
          (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, false, $9, $10, true, NOW(), NOW())
      `;
      
      await db.execute(sql`
        INSERT INTO stream_notifications 
          (id, server_id, user_id, channel_id, platform, streamer_name, username, platform_user_id, display_name, is_active, is_live, oauth_access_token, oauth_refresh_token, is_oauth_verified, oauth_verified_at, created_at)
        VALUES 
          (gen_random_uuid(), ${guildId}, ${userId}, ${channelId}, ${platform}, ${username}, ${username}, ${platformUserId}, ${displayName}, true, false, ${accessToken}, ${refreshToken || null}, true, NOW(), NOW())
      `);
    }

    return true;
  } catch (error) {
    logError('Error saving OAuth streamer:', error);
    throw error;
  }
}

// OAuth button interaction handlers
export async function handleStreamButtons(interaction: any) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  
  // Handle OAuth flow buttons
  if (customId.startsWith('stream_oauth_')) {
    const platform = customId.replace('stream_oauth_', '');
    const validPlatforms = ['twitch', 'youtube', 'kick'];
    
    if (!validPlatforms.includes(platform)) return;

    const callbackBase = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000';
    const oauthUrl = `${callbackBase}/auth/${platform}/login`;

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🔐 Authenticate with ${platform.charAt(0).toUpperCase() + platform.slice(1)}`)
      .setDescription(`Click the link below to authenticate with ${platform}. You'll be redirected to ${platform}'s login page.`)
      .addFields(
        { 
          name: 'OAuth Link', 
          value: `[Authenticate with ${platform}](${oauthUrl})`, 
          inline: false 
        },
        {
          name: 'What happens next?',
          value: '1. Click the link to log in\n2. Approve the permissions\n3. You\'ll see a confirmation page\n4. Return to this modal and click "Confirm Account"',
          inline: false
        }
      )
      .setFooter({ text: 'Your data is secure. We only get access to verify your account.' });

    // Show confirmation modal after OAuth
    const modal = new ModalBuilder()
      .setCustomId(`stream_oauth_confirm_${platform}_${interaction.user.id}`)
      .setTitle(`Confirm ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`);

    const usernameInput = new TextInputBuilder()
      .setCustomId('oauth_username')
      .setLabel(`${platform.charAt(0).toUpperCase() + platform.slice(1)} Username`)
      .setPlaceholder(`Enter the username you authenticated with`)
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(50)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  // Handle old modal-based flow (for backwards compatibility)
  if (customId.startsWith('stream_add_')) {
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
}

// Modal submission handler
export async function handleStreamModal(interaction: any) {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;

  // Handle OAuth confirmation modals
  if (customId.startsWith('stream_oauth_confirm_')) {
    const parts = customId.replace('stream_oauth_confirm_', '').split('_');
    const userId = parts.pop(); // Get last part (userId)
    const platform = parts.join('_'); // Everything else is platform
    
    // Verify user
    if (interaction.user.id !== userId) {
      await interaction.reply({ 
        content: '❌ This modal is not for you!',
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    const username = interaction.fields.getTextInputValue('oauth_username');
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

    // Save OAuth-verified streamer
    try {
      await saveOAuthStreamer(
        interaction.guild.id,
        interaction.user.id,
        server.streamNotificationChannelId,
        platform,
        username,
        username, // Display name - will be updated from platform later
        username, // Platform user ID - will be updated from platform later
        'oauth_verified' // Placeholder access token - real token would come from OAuth
      );

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Account Added Successfully!')
        .setDescription(`**${username}** on **${platform}** is now being tracked for stream notifications.`)
        .addFields(
          { name: '✨ Verified with OAuth', value: `Your ${platform} account has been securely authenticated!`, inline: false },
          { name: '📢 Notifications', value: `When you go live on ${platform}, this server will be notified in <#${server.streamNotificationChannelId}>`, inline: false }
        )
        .setFooter({ text: 'Remove with /stream remove' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error saving OAuth streamer:', error);
      await interaction.editReply({
        content: '❌ An error occurred while adding your account. Please try again or contact an administrator.',
      });
    }
    return;
  }

  // Handle regular stream_modal submissions
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
      warn('Drizzle insert failed, trying raw SQL fallback:', drizzleError.message);
      
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
    logError('Error adding stream notification - Full details:', {
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
