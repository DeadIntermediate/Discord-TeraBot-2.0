import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { storage } from '../../storage.js';

const setupCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('🔧 Setup command - Configure bot for this server')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create_role')
        .setDescription('Create the Tera Bot role and assign it to the bot')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check_permissions')
        .setDescription('Check if the bot has proper permissions in this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('configure_logging')
        .setDescription('Set up live logging to a text channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The text channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName('log_errors')
            .setDescription('Log error messages')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('log_warnings')
            .setDescription('Log warning messages')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('log_info')
            .setDescription('Log info messages')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('log_debug')
            .setDescription('Log debug messages (verbose)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup_create')
        .setDescription('Create a backup of guild roles and channels')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Name for this backup')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Optional description for this backup')
            .setRequired(false)
            .setMaxLength(500)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup_list')
        .setDescription('List all available backups for this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup_restore')
        .setDescription('Restore a backup of roles and channels')
        .addStringOption(option =>
          option
            .setName('backup_id')
            .setDescription('ID of the backup to restore')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName('restore_roles')
            .setDescription('Restore roles (default: true)')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('restore_channels')
            .setDescription('Restore channels (default: true)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup_delete')
        .setDescription('Delete a backup')
        .addStringOption(option =>
          option
            .setName('backup_id')
            .setDescription('ID of the backup to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'check_permissions') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const botMember = await interaction.guild.members.fetch(interaction.client.user?.id || '');
        
        const permissions = {
          manageRoles: botMember.permissions.has(PermissionFlagsBits.ManageRoles),
          administrator: botMember.permissions.has(PermissionFlagsBits.Administrator),
          sendMessages: botMember.permissions.has(PermissionFlagsBits.SendMessages),
          embedLinks: botMember.permissions.has(PermissionFlagsBits.EmbedLinks),
          manageMessages: botMember.permissions.has(PermissionFlagsBits.ManageMessages),
          moderateMembers: botMember.permissions.has(PermissionFlagsBits.ModerateMembers),
          kickMembers: botMember.permissions.has(PermissionFlagsBits.KickMembers),
          banMembers: botMember.permissions.has(PermissionFlagsBits.BanMembers),
          manageChannels: botMember.permissions.has(PermissionFlagsBits.ManageChannels),
        };

        const embed = new EmbedBuilder()
          .setColor(permissions.manageRoles ? 0x4caf50 : 0xff9800)
          .setTitle('🔐 Bot Permissions Check')
          .setDescription(`Checking permissions for **${interaction.guild.name}**`)
          .addFields(
            { 
              name: '✅ Critical Permissions', 
              value: `
                ${ permissions.manageRoles ? '✅' : '❌'} Manage Roles
                ${permissions.administrator ? '✅' : '❌'} Administrator
                ${permissions.sendMessages ? '✅' : '❌'} Send Messages
                ${permissions.embedLinks ? '✅' : '❌'} Embed Links
              `, 
              inline: false 
            },
            {
              name: '⚙️ Other Permissions',
              value: `
                ${permissions.manageMessages ? '✅' : '❌'} Manage Messages
                ${permissions.moderateMembers ? '✅' : '❌'} Moderate Members
                ${permissions.kickMembers ? '✅' : '❌'} Kick Members
                ${permissions.banMembers ? '✅' : '❌'} Ban Members
                ${permissions.manageChannels ? '✅' : '❌'} Manage Channels
              `,
              inline: false
            }
          );

        if (!permissions.manageRoles && !permissions.administrator) {
          embed.addFields({
            name: '⚠️ Action Required',
            value: 'The bot does not have the **Manage Roles** permission. Please:\n' +
                   '1. Go to Server Settings → Roles\n' +
                   '2. Find the "Tera Bot" role (or create one)\n' +
                   '3. Enable the "Manage Roles" permission\n' +
                   '4. Try `/setup create_role` again',
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error checking permissions:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while checking permissions.' 
        });
      }
      return;
    }

    if (subcommand === 'configure_logging') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Check if this is the Tera Bot guild
      const TERA_BOT_GUILD_ID = process.env.TERA_BOT_GUILD_ID;
      if (interaction.guild.id !== TERA_BOT_GUILD_ID) {
        await interaction.reply({ 
          content: '🚫 This command is only available in the **Tera Bot** guild for security purposes.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ 
          content: '❌ You need Administrator permissions to use this command.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const channel = interaction.options.getChannel('channel', true) as any;
        
        if (!channel.isText?.()) {
          await interaction.editReply({ 
            content: '❌ The channel must be a text channel.' 
          });
          return;
        }

        const logErrors = interaction.options.getBoolean('log_errors') ?? true;
        const logWarnings = interaction.options.getBoolean('log_warnings') ?? true;
        const logInfo = interaction.options.getBoolean('log_info') ?? true;
        const logDebug = interaction.options.getBoolean('log_debug') ?? false;

        // Create webhook for logging
        const webhook = await channel.createWebhook({
          name: '📋 Tera Bot Logger',
          avatar: interaction.client.user?.avatarURL() || undefined,
        });

        // Save logging config to database
        const existingConfig = await storage.getLoggingConfig(interaction.guild.id);
        
        if (existingConfig) {
          await storage.updateLoggingConfig(interaction.guild.id, {
            channelId: channel.id,
            webhookUrl: webhook.url,
            logErrors,
            logWarnings,
            logInfo,
            logDebug,
            isActive: true,
          });
        } else {
          await storage.createLoggingConfig({
            serverId: interaction.guild.id,
            channelId: channel.id,
            webhookUrl: webhook.url,
            logErrors,
            logWarnings,
            logInfo,
            logDebug,
            isActive: true,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x4caf50)
          .setTitle('✅ Logging Configured')
          .setDescription(`Live logging has been set up for **${interaction.guild.name}**`)
          .addFields(
            { name: '📺 Channel', value: `<#${channel.id}>`, inline: true },
            { name: '🔴 Log Errors', value: logErrors ? '✅ Yes' : '❌ No', inline: true },
            { name: '🟠 Log Warnings', value: logWarnings ? '✅ Yes' : '❌ No', inline: true },
            { name: '🔵 Log Info', value: logInfo ? '✅ Yes' : '❌ No', inline: true },
            { name: '⚪ Log Debug', value: logDebug ? '✅ Yes' : '❌ No', inline: true },
            { name: '📝 Test Message', value: 'A test log entry has been sent to the channel!', inline: false }
          )
          .setFooter({ text: 'Logging is now active' });

        // Send test message to the logging channel
        try {
          await webhook.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2196f3)
                .setTitle('ℹ️ INFO - System')
                .setDescription('✅ Logging system initialized and ready!')
                .setTimestamp(new Date())
                .setFooter({ text: 'Tera Bot Logger' })
            ],
            username: '📋 Tera Bot Logs',
          });
        } catch (err) {
          console.error('Failed to send test message:', err);
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error configuring logging:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while setting up logging. Make sure I have permission to manage webhooks in that channel.' 
        });
      }
      return;
    }

    if (subcommand === 'create_role') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Check if user has permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ 
          content: '❌ You need Administrator permissions to use this command.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply();

      try {
        // Check if role already exists
        const existingRole = interaction.guild.roles.cache.find(r => r.name === 'Tera Bot');
        
        if (existingRole) {
          // Just assign it to the bot if not already assigned
          const botMember = interaction.guild.members.cache.get(interaction.client.user?.id || '');
          if (botMember && !botMember.roles.cache.has(existingRole.id)) {
            await botMember.roles.add(existingRole);
          }
          
          const embed = new EmbedBuilder()
            .setColor(0x4caf50)
            .setTitle('✅ Tera Bot Role Already Exists')
            .setDescription(`The "Tera Bot" role already exists in this server!`)
            .addFields(
              { name: 'Role', value: `<@&${existingRole.id}>`, inline: true },
              { name: 'Color', value: `#${existingRole.color.toString(16).padStart(6, '0').toUpperCase()}`, inline: true }
            )
            .setFooter({ text: 'No changes needed!' });
          
          return await interaction.editReply({ embeds: [embed] });
        }

        // Create the role
        const botRole = await interaction.guild.roles.create({
          name: 'Tera Bot',
          color: 0x4caf50, // Green
          hoist: true,
          mentionable: false,
          permissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendTTSMessages,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.MentionEveryone,
          ],
        });

        // Assign to bot
        const botMember = interaction.guild.members.cache.get(interaction.client.user?.id || '');
        if (botMember) {
          await botMember.roles.add(botRole);
        }

        const embed = new EmbedBuilder()
          .setColor(0x4caf50)
          .setTitle('✅ Tera Bot Role Created')
          .setDescription(`Successfully created and assigned the "Tera Bot" role!`)
          .addFields(
            { name: 'Role', value: `<@&${botRole.id}>`, inline: true },
            { name: 'Color', value: `#${botRole.color.toString(16).padStart(6, '0').toUpperCase()}`, inline: true },
            { name: 'Hoisted', value: 'Yes (shows separately)', inline: true },
            { name: 'Assigned To', value: '✅ Tera Bot', inline: true }
          )
          .setFooter({ text: 'The bot is now properly configured!' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error creating bot role:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while creating the role. Make sure the bot has the "Manage Roles" permission.' 
        });
      }
      return;
    }

    if (subcommand === 'backup_create') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (interaction.guild.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ Only the server owner can create backups.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const { createGuildBackup } = await import('../../utils/backupManager.js');
        const name = interaction.options.getString('name', true);
        const description = interaction.options.getString('description', false) || undefined;
        const userId = interaction.user.id;

        const backupId = await createGuildBackup(interaction.guild, userId, name, description);

        if (!backupId) {
          await interaction.editReply({ 
            content: '❌ Failed to create backup. Check bot logs for details.' 
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x4caf50)
          .setTitle('✅ Backup Created Successfully')
          .setDescription(`A new backup of **${interaction.guild.name}** has been created.`)
          .addFields(
            { name: '📋 Backup Name', value: name, inline: true },
            { name: '🆔 Backup ID', value: `\`${backupId}\``, inline: true },
            { name: '👤 Created By', value: `<@${userId}>`, inline: true },
            { name: '⏰ Timestamp', value: new Date().toLocaleString(), inline: false }
          );

        if (description) {
          embed.addFields({ name: '📝 Description', value: description });
        }

        embed.setFooter({ text: 'Use /setup backup_restore to restore this backup' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error creating backup:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while creating the backup.' 
        });
      }
      return;
    }

    if (subcommand === 'backup_list') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (interaction.guild.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ Only the server owner can view backups.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const backups = await storage.getGuildBackups(interaction.guild.id, 50);

        if (backups.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0x2196f3)
            .setTitle('📚 Guild Backups')
            .setDescription('No backups found for this server.')
            .setFooter({ text: 'Use /setup backup_create to create a new backup' });

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x2196f3)
          .setTitle(`📚 Guild Backups (${backups.length})`)
          .setDescription('Available backups for this server:');

        for (const backup of backups.slice(0, 25)) {
          const metadata = backup.metadata as { guildName: string; timestamp: string; memberCount: number } | null;
          const timestamp = metadata?.timestamp ? new Date(metadata.timestamp).toLocaleString() : 'Unknown';
          const fields = backup.rolesData ? Object.keys(backup.rolesData).length : 0;

          embed.addFields({
            name: `📦 ${backup.name}`,
            value: `**ID:** \`${backup.id}\`\n**Created:** ${timestamp}\n**Description:** ${backup.description || 'None'}\n**Data Snapshot:** ${fields} fields`,
            inline: false
          });
        }

        embed.setFooter({ 
          text: backups.length > 25 ? `Showing 25 of ${backups.length} backups` : 'Use backup IDs to restore or delete' 
        });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error listing backups:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while retrieving backups.' 
        });
      }
      return;
    }

    if (subcommand === 'backup_restore') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (interaction.guild.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ Only the server owner can restore backups.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const { restoreGuildBackup } = await import('../../utils/backupManager.js');
        const backupId = interaction.options.getString('backup_id', true);
        const restoreRoles = interaction.options.getBoolean('restore_roles') ?? true;
        const restoreChannels = interaction.options.getBoolean('restore_channels') ?? true;
        const userId = interaction.user.id;

        const result = await restoreGuildBackup(interaction.guild, backupId, userId, restoreRoles, restoreChannels);

        const embed = new EmbedBuilder()
          .setColor(result.success ? 0x4caf50 : 0xff9800)
          .setTitle(result.success ? '✅ Backup Restored' : '⚠️ Backup Restore Completed with Issues')
          .setDescription(`Restore process completed for **${interaction.guild.name}**`)
          .addFields(
            { name: '✅ Restored', value: String(result.restored), inline: true },
            { name: '❌ Failed', value: String(result.failed), inline: true },
            { name: '📥 Restore Roles', value: restoreRoles ? 'Yes' : 'No', inline: true },
            { name: '📥 Restore Channels', value: restoreChannels ? 'Yes' : 'No', inline: true }
          );

        if (result.errors.length > 0) {
          const errorText = result.errors.slice(0, 5).join('\n');
          embed.addFields({
            name: `⚠️ Errors (${result.errors.length})`,
            value: `\`\`\`${errorText}${result.errors.length > 5 ? '\n...' : ''}\`\`\``
          });
        }

        embed.setFooter({ text: 'Some items may have been skipped if they already exist' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error restoring backup:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while restoring the backup.' 
        });
      }
      return;
    }

    if (subcommand === 'backup_delete') {
      if (!interaction.guild) {
        await interaction.reply({ 
          content: 'This command can only be used in a server.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      if (interaction.guild.ownerId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ Only the server owner can delete backups.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const backupId = interaction.options.getString('backup_id', true);
        const success = await storage.deleteGuildBackup(backupId);

        if (!success) {
          await interaction.editReply({ 
            content: '❌ Backup not found or could not be deleted.' 
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xff5722)
          .setTitle('✅ Backup Deleted')
          .setDescription('The backup has been permanently deleted.')
          .addFields(
            { name: '🆔 Backup ID', value: `\`${backupId}\`` }
          )
          .setFooter({ text: 'This action cannot be undone' });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error deleting backup:', error);
        await interaction.editReply({ 
          content: '❌ An error occurred while deleting the backup.' 
        });
      }
    }
  },
};

export const setupCommands = [setupCommand];
