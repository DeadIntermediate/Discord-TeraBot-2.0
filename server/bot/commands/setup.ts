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
    }
  },
};

export const setupCommands = [setupCommand];
