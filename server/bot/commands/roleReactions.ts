import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  TextChannel,
  MessageReaction,
  User,
  GuildMember,
  PartialMessageReaction,
  PartialUser,
  MessageFlags,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { storage } from '../../storage';
import { error as logError } from '../../utils/logger';

const roleReactionCommand = {
  data: new SlashCommandBuilder()
    .setName('rolereaction')
    .setDescription('Manage role reactions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a role reaction menu')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title for the role menu')
            .setRequired(true)
            .setMaxLength(256))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description for the role menu')
            .setRequired(false)
            .setMaxLength(2048))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post the role menu')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role-emoji pair to an existing message')
        .addStringOption(option =>
          option.setName('message-id')
            .setDescription('Message ID or message link')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to assign')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('Emoji to react with')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('attach')
        .setDescription('Attach reaction roles to any message using message link')
        .addStringOption(option =>
          option.setName('message-link')
            .setDescription('Right-click message → Copy Message Link')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to assign')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('Emoji to react with')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role reaction')
        .addStringOption(option =>
          option.setName('message-id')
            .setDescription('Message ID')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('Emoji to remove')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all role reactions'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('template')
        .setDescription('Create a role menu from preset templates')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Template type')
            .setRequired(true)
            .addChoices(
              { name: 'Gaming Roles', value: 'gaming' },
              { name: 'Notification Roles', value: 'notifications' },
              { name: 'Color Roles', value: 'colors' },
              { name: 'Hobby Roles', value: 'hobbies' }
            ))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to post the template')
            .setRequired(false))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'create':
          await handleCreateRoleMenu(interaction);
          break;
        case 'add':
          await handleAddRoleReaction(interaction);
          break;
        case 'attach':
          await handleAttachToMessage(interaction);
          break;
        case 'remove':
          await handleRemoveRoleReaction(interaction);
          break;
        case 'list':
          await handleListRoleReactions(interaction);
          break;
        case 'template':
          await handleCreateTemplate(interaction);
          break;
      }
    } catch (error) {
      logError(`Error in rolereaction ${subcommand}:`, error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

async function handleCreateRoleMenu(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description') || 'React to get roles!';
  const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .addFields({
      name: '📋 How to use',
      value: 'React with the emoji below to get the corresponding role. React again to remove the role.',
      inline: false
    })
    .setFooter({ text: 'Role reactions will be added by administrators' })
    .setTimestamp();

  try {
    const message = await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: `✅ Role menu created! Message ID: \`${message.id}\`\nUse \`/rolereaction add\` to add role-emoji pairs.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    await interaction.reply({
      content: 'Failed to create role menu. Check my permissions in the target channel.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleAddRoleReaction(interaction: ChatInputCommandInteraction) {
  const messageId = interaction.options.getString('message-id', true);
  const role = interaction.options.getRole('role', true);
  const emoji = interaction.options.getString('emoji', true);

  if (!interaction.guild) return;

  try {
    // Find the message in the current channel first, then search other channels
    let message;
    try {
      message = await (interaction.channel as TextChannel).messages.fetch(messageId);
    } catch {
      // Search in other channels
      const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
      for (const [, channel] of channels) {
        try {
          message = await (channel as TextChannel).messages.fetch(messageId);
          break;
        } catch {
          continue;
        }
      }
    }

    if (!message) {
      await interaction.reply({ content: 'Message not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Check if bot can manage this role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({ 
        content: 'I cannot assign this role because it is higher than or equal to my highest role.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    // Add reaction to message
    await message.react(emoji);

    // Save to database
    await storage.createRoleReaction({
      serverId: interaction.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      emoji: emoji,
      roleId: role.id,
    });

    // Update the embed to show the new role
    const embed = message.embeds[0];
    if (embed) {
      const updatedEmbed = EmbedBuilder.from(embed);
      
      // Add or update the roles field
      const existingFields = updatedEmbed.data.fields || [];
      let rolesField = existingFields.find(field => field.name === '🎭 Available Roles');
      
      if (!rolesField) {
        updatedEmbed.addFields({
          name: '🎭 Available Roles',
          value: `${emoji} - ${role.name}`,
          inline: false
        });
      } else {
        const currentRoles = rolesField.value;
        const newValue = `${currentRoles}\n${emoji} - ${role.name}`;
        
        // Update the field
        const fieldIndex = existingFields.findIndex(field => field.name === '🎭 Available Roles');
        if (fieldIndex !== -1 && existingFields[fieldIndex]) {
          existingFields[fieldIndex].value = newValue;
          updatedEmbed.setFields(existingFields);
        }
      }

      await message.edit({ embeds: [updatedEmbed] });
    }

    await interaction.reply({
      content: `✅ Role reaction added! ${emoji} → ${role.name}`,
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    logError('Error adding role reaction:', error);
    await interaction.reply({
      content: 'Failed to add role reaction. Make sure the emoji is valid and accessible.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleAttachToMessage(interaction: ChatInputCommandInteraction) {
  const messageLink = interaction.options.getString('message-link', true);
  const role = interaction.options.getRole('role', true);
  const emoji = interaction.options.getString('emoji', true);

  if (!interaction.guild) return;

  try {
    // Parse message link: https://discord.com/channels/GUILD_ID/CHANNEL_ID/MESSAGE_ID
    const linkParts = messageLink.split('/');
    if (linkParts.length < 7 || !linkParts.includes('channels')) {
      await interaction.reply({
        content: '❌ Invalid message link! Right-click a message and select "Copy Message Link"',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channelId = linkParts[linkParts.length - 2];
    const messageId = linkParts[linkParts.length - 1];

    if (!channelId || !messageId) {
      await interaction.reply({
        content: '❌ Could not parse message link.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Fetch the channel
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: '❌ Channel not found or is not a text channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Fetch the message
    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      await interaction.reply({
        content: '❌ Message not found in that channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Check if bot can manage this role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({ 
        content: '❌ I cannot assign this role because it is higher than or equal to my highest role.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    // Add reaction to message
    await message.react(emoji);

    // Save to database
    await storage.createRoleReaction({
      serverId: interaction.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      emoji: emoji,
      roleId: role.id,
    });

    await interaction.reply({
      content: `✅ Reaction role attached!\n**Message:** [Jump to message](${message.url})\n**Reaction:** ${emoji} → ${role}\n\nUsers can now react to get this role!`,
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    logError('Error attaching role reaction:', error);
    await interaction.reply({
      content: '❌ Failed to attach role reaction. Make sure:\n• The message link is valid\n• I have permission to read the channel\n• The emoji is valid and accessible',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleRemoveRoleReaction(interaction: ChatInputCommandInteraction) {
  const messageId = interaction.options.getString('message-id', true);
  const emoji = interaction.options.getString('emoji', true);

  if (!interaction.guild) return;

  try {
    // Get role reaction from database
    const roleReaction = await storage.getRoleReaction(messageId, emoji);
    
    if (!roleReaction) {
      await interaction.reply({ content: 'Role reaction not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Find and update the message
    let message;
    try {
      const channel = interaction.guild.channels.cache.get(roleReaction.channelId) as TextChannel;
      message = await channel.messages.fetch(messageId);
    } catch {
      await interaction.reply({ content: 'Message not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Remove bot's reaction
    const reaction = message.reactions.cache.get(emoji);
    if (reaction) {
      await reaction.users.remove(interaction.client.user.id);
    }

    // Remove from database
    await storage.deleteRoleReaction(roleReaction.id);

    await interaction.reply({
      content: `✅ Role reaction removed for ${emoji}`,
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    logError('Error removing role reaction:', error);
    await interaction.reply({
      content: 'Failed to remove role reaction.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleListRoleReactions(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  try {
    // This would need a new storage method to get all role reactions for a server
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📋 Role Reactions')
      .setDescription('No role reactions found. Use `/rolereaction create` to get started!')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    await interaction.reply({
      content: 'Failed to list role reactions.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleCreateTemplate(interaction: ChatInputCommandInteraction) {
  const templateType = interaction.options.getString('type', true);
  const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

  const templates = {
    gaming: {
      title: '🎮 Gaming Roles',
      description: 'React to get notified about your favorite games!',
      roles: [
        { emoji: '🎯', name: 'FPS Games' },
        { emoji: '⚔️', name: 'RPG Games' },
        { emoji: '🏎️', name: 'Racing Games' },
        { emoji: '🎲', name: 'Strategy Games' },
        { emoji: '🏹', name: 'Adventure Games' }
      ]
    },
    notifications: {
      title: '🔔 Notification Roles',
      description: 'Choose what notifications you want to receive!',
      roles: [
        { emoji: '📢', name: 'Announcements' },
        { emoji: '🎉', name: 'Events' },
        { emoji: '🎁', name: 'Giveaways' },
        { emoji: '📰', name: 'News' },
        { emoji: '🔔', name: 'General Updates' }
      ]
    },
    colors: {
      title: '🌈 Color Roles',
      description: 'Pick a color for your name!',
      roles: [
        { emoji: '🔴', name: 'Red' },
        { emoji: '🟠', name: 'Orange' },
        { emoji: '🟡', name: 'Yellow' },
        { emoji: '🟢', name: 'Green' },
        { emoji: '🔵', name: 'Blue' },
        { emoji: '🟣', name: 'Purple' },
        { emoji: '🩷', name: 'Pink' }
      ]
    },
    hobbies: {
      title: '🎨 Hobby Roles',
      description: 'Share your interests and hobbies!',
      roles: [
        { emoji: '🎨', name: 'Art & Design' },
        { emoji: '🎵', name: 'Music' },
        { emoji: '📚', name: 'Reading' },
        { emoji: '💻', name: 'Programming' },
        { emoji: '🏋️', name: 'Fitness' },
        { emoji: '🍳', name: 'Cooking' }
      ]
    }
  };

  const template = templates[templateType as keyof typeof templates];

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(template.title)
    .setDescription(template.description)
    .addFields(
      {
        name: '📋 How to use',
        value: 'React with the emoji below to get the corresponding role. React again to remove the role.',
        inline: false
      },
      {
        name: '🎭 Available Roles',
        value: template.roles.map(role => `${role.emoji} - ${role.name}`).join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Template created - roles need to be set up by administrators' })
    .setTimestamp();

  try {
    const message = await channel.send({ embeds: [embed] });

    // Add all reactions
    for (const role of template.roles) {
      await message.react(role.emoji);
    }

    await interaction.reply({
      content: `✅ ${template.title} template created! Message ID: \`${message.id}\`\n**Note:** You need to create the actual roles and link them using \`/rolereaction add\`.`,
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    logError('Error creating template:', error);
    await interaction.reply({
      content: 'Failed to create template.',
      flags: MessageFlags.Ephemeral
    });
  }
}

// Event handlers for role reactions
export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  // Ignore bot reactions
  if (user.bot) return;

  try {
    // Fetch partial data if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    // Get role reaction from database
    const roleReaction = await storage.getRoleReaction(reaction.message.id, reaction.emoji.name || reaction.emoji.toString());
    
    if (!roleReaction) return;

    // Get member and role
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleReaction.roleId);

    if (!role) {
      logError(`Role ${roleReaction.roleId} not found for reaction ${roleReaction.emoji}`);
      return;
    }

    // Check if member already has the role
    if (member.roles.cache.has(role.id)) {
      return; // Already has role, no need to add again
    }

    // Add role
    await member.roles.add(role, 'Role reaction');

    // Try to send DM notification
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Role Added')
        .setDescription(`You have been given the **${role.name}** role in **${guild.name}**!`)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled, continue silently
    }

  } catch (error) {
    logError('Error handling reaction add:', error);
  }
}

export async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  // Ignore bot reactions
  if (user.bot) return;

  try {
    // Fetch partial data if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    // Get role reaction from database
    const roleReaction = await storage.getRoleReaction(reaction.message.id, reaction.emoji.name || reaction.emoji.toString());
    
    if (!roleReaction) return;

    // Get member and role
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleReaction.roleId);

    if (!role) {
      logError(`Role ${roleReaction.roleId} not found for reaction ${roleReaction.emoji}`);
      return;
    }

    // Check if member has the role
    if (!member.roles.cache.has(role.id)) {
      return; // Doesn't have role, no need to remove
    }

    // Remove role
    await member.roles.remove(role, 'Role reaction removed');

    // Try to send DM notification
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('❌ Role Removed')
        .setDescription(`The **${role.name}** role has been removed from you in **${guild.name}**.`)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled, continue silently
    }

  } catch (error) {
    logError('Error handling reaction remove:', error);
  }
}

// Context menu command to attach reaction roles to any message
const attachRoleReactionCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Attach Reaction Roles')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ 
        content: 'This command can only be used in a server.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    const targetMessage = interaction.targetMessage;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📝 Attach Reaction Roles')
      .setDescription(`Selected message: [Jump to message](${targetMessage.url})\n\nUse the command below to add reaction roles to this message:`)
      .addFields({
        name: '💡 How to add reactions',
        value: `\`\`\`\n/rolereaction add message-id:${targetMessage.id} role:@Role emoji:😀\n\`\`\``,
        inline: false
      })
      .addFields({
        name: '📋 Message ID',
        value: `\`${targetMessage.id}\``,
        inline: true
      })
      .addFields({
        name: '📍 Channel',
        value: `<#${targetMessage.channel.id}>`,
        inline: true
      })
      .setFooter({ text: 'Copy the command above and fill in your role and emoji' })
      .setTimestamp();

    // Show button to quick-add a role
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`quick-add-role_${targetMessage.id}`)
          .setLabel('Quick Add Role')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➕')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  }
};

export const roleReactionCommands = [roleReactionCommand, attachRoleReactionCommand];