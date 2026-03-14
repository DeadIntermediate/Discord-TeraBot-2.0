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
  PartialUser
} from 'discord.js';
import { storage } from '../../storage';
import { error } from '../../utils/logger';

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
            .setDescription('Message ID to add reaction to')
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
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
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
      error(`Error in rolereaction ${subcommand}:`, error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
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
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({
      content: 'Failed to create role menu. Check my permissions in the target channel.',
      ephemeral: true
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
      await interaction.reply({ content: 'Message not found.', ephemeral: true });
      return;
    }

    // Check if bot can manage this role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({ 
        content: 'I cannot assign this role because it is higher than or equal to my highest role.', 
        ephemeral: true 
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
        existingFields[fieldIndex].value = newValue;
        updatedEmbed.setFields(existingFields);
      }

      await message.edit({ embeds: [updatedEmbed] });
    }

    await interaction.reply({
      content: `✅ Role reaction added! ${emoji} → ${role.name}`,
      ephemeral: true
    });

  } catch (error) {
    error('Error adding role reaction:', error);
    await interaction.reply({
      content: 'Failed to add role reaction. Make sure the emoji is valid and accessible.',
      ephemeral: true
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
      await interaction.reply({ content: 'Role reaction not found.', ephemeral: true });
      return;
    }

    // Find and update the message
    let message;
    try {
      const channel = interaction.guild.channels.cache.get(roleReaction.channelId) as TextChannel;
      message = await channel.messages.fetch(messageId);
    } catch {
      await interaction.reply({ content: 'Message not found.', ephemeral: true });
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
      ephemeral: true
    });

  } catch (error) {
    error('Error removing role reaction:', error);
    await interaction.reply({
      content: 'Failed to remove role reaction.',
      ephemeral: true
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

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    await interaction.reply({
      content: 'Failed to list role reactions.',
      ephemeral: true
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
      ephemeral: true
    });

  } catch (error) {
    error('Error creating template:', error);
    await interaction.reply({
      content: 'Failed to create template.',
      ephemeral: true
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
      error(`Role ${roleReaction.roleId} not found for reaction ${roleReaction.emoji}`);
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
    error('Error handling reaction add:', error);
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
      error(`Role ${roleReaction.roleId} not found for reaction ${roleReaction.emoji}`);
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
    error('Error handling reaction remove:', error);
  }
}

export const roleReactionCommands = [roleReactionCommand];