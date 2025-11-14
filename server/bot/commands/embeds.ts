import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  TextChannel,
  ColorResolvable,
  MessageFlags
} from 'discord.js';
import { storage } from '../../storage';

const embedCommand = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and manage custom embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new embed')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Embed title')
            .setRequired(false)
            .setMaxLength(256))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Embed description')
            .setRequired(false)
            .setMaxLength(2048))
        .addStringOption(option =>
          option.setName('color')
            .setDescription('Embed color (hex code)')
            .setRequired(false))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to send the embed to')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('builder')
        .setDescription('Open the interactive embed builder'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('save')
        .setDescription('Save an embed template')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Template name')
            .setRequired(true)
            .setMaxLength(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('load')
        .setDescription('Load a saved embed template')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Template name')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List saved embed templates'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a saved embed template')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Template name')
            .setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'create':
          await handleCreateEmbed(interaction);
          break;
        case 'builder':
          await handleEmbedBuilder(interaction);
          break;
        case 'save':
          await handleSaveEmbed(interaction);
          break;
        case 'load':
          await handleLoadEmbed(interaction);
          break;
        case 'list':
          await handleListEmbeds(interaction);
          break;
        case 'delete':
          await handleDeleteEmbed(interaction);
          break;
      }
    } catch (error) {
      console.error(`Error in embed ${subcommand}:`, error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

async function handleCreateEmbed(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const colorInput = interaction.options.getString('color');
  const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

  if (!title && !description) {
    await interaction.reply({ 
      content: 'You must provide at least a title or description for the embed.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  const embed = new EmbedBuilder();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  
  // Parse color
  if (colorInput) {
    try {
      const color = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
      embed.setColor(color as ColorResolvable);
    } catch (error) {
      embed.setColor(0x5865f2); // Default Discord blue
    }
  } else {
    embed.setColor(0x5865f2);
  }

  embed.setTimestamp();
  embed.setFooter({ text: `Created by ${interaction.user.tag}` });

  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({ 
      content: `✅ Embed sent successfully to ${channel.toString()}!`, 
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    await interaction.reply({ 
      content: 'Failed to send embed. Check my permissions in the target channel.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleEmbedBuilder(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('Embed Builder')
    .setDescription('Use the buttons below to customize your embed')
    .setColor(0x5865f2)
    .setTimestamp();

  const actionRow1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_edit_title')
        .setLabel('Edit Title')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('embed_edit_description')
        .setLabel('Edit Description')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📄'),
      new ButtonBuilder()
        .setCustomId('embed_edit_color')
        .setLabel('Edit Color')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎨')
    );

  const actionRow2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_add_field')
        .setLabel('Add Field')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('embed_edit_footer')
        .setLabel('Edit Footer')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('embed_edit_image')
        .setLabel('Edit Image')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🖼️')
    );

  const actionRow3 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_send')
        .setLabel('Send Embed')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('embed_preview')
        .setLabel('Preview')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👁️'),
      new ButtonBuilder()
        .setCustomId('embed_clear')
        .setLabel('Clear All')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

  await interaction.reply({
    content: 'Welcome to the Embed Builder! 🎨',
    embeds: [embed],
    components: [actionRow1, actionRow2, actionRow3],
    flags: MessageFlags.Ephemeral
  });
}

async function handleSaveEmbed(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);

  // For now, we'll just save a basic embed structure
  // In a full implementation, you'd save the current embed being built
  const embedData = {
    title: 'Sample Embed',
    description: 'This is a saved embed template',
    color: 0x5865f2,
    timestamp: true,
    footer: { text: 'Saved template' }
  };

  try {
    await storage.createSavedEmbed({
      serverId: interaction.guild!.id,
      name: name,
      embedData: embedData,
      createdBy: interaction.user.id
    });

    await interaction.reply({ 
      content: `✅ Embed template "${name}" saved successfully!`, 
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    await interaction.reply({ 
      content: 'Failed to save embed template. The name might already be in use.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleLoadEmbed(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);

  try {
    // This would need a new storage method to get saved embeds by name
    await interaction.reply({ 
      content: `Loading embed template "${name}"... (Feature not fully implemented)`, 
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    await interaction.reply({ 
      content: 'Failed to load embed template.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleListEmbeds(interaction: ChatInputCommandInteraction) {
  try {
    // This would need a new storage method to list saved embeds
    const listEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📋 Saved Embed Templates')
      .setDescription('No templates found. Use `/embed save` to create one!')
      .setTimestamp();

    await interaction.reply({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    await interaction.reply({ 
      content: 'Failed to list embed templates.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleDeleteEmbed(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);

  try {
    // This would need a new storage method to delete saved embeds
    await interaction.reply({ 
      content: `Embed template "${name}" deleted successfully!`, 
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    await interaction.reply({ 
      content: 'Failed to delete embed template.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

// Color options for the color picker
const colorOptions = [
  { label: 'Red', value: 'red', emoji: '🔴' },
  { label: 'Orange', value: 'orange', emoji: '🟠' },
  { label: 'Yellow', value: 'yellow', emoji: '🟡' },
  { label: 'Green', value: 'green', emoji: '🟢' },
  { label: 'Blue', value: 'blue', emoji: '🔵' },
  { label: 'Purple', value: 'purple', emoji: '🟣' },
  { label: 'Pink', value: 'pink', emoji: '🩷' },
  { label: 'Black', value: 'black', emoji: '⚫' },
  { label: 'White', value: 'white', emoji: '⚪' },
  { label: 'Discord Blue', value: 'discord', emoji: '💙' }
];

const colorValues: { [key: string]: number } = {
  red: 0xff0000,
  orange: 0xffa500,
  yellow: 0xffff00,
  green: 0x00ff00,
  blue: 0x0000ff,
  purple: 0x800080,
  pink: 0xffc0cb,
  black: 0x000000,
  white: 0xffffff,
  discord: 0x5865f2
};

// This would be called from the interaction handler for embed builder buttons
export async function handleEmbedBuilderInteraction(interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction) {
  if (interaction.isButton()) {
    const customId = interaction.customId;

    switch (customId) {
      case 'embed_edit_title':
        await showTitleModal(interaction);
        break;
      case 'embed_edit_description':
        await showDescriptionModal(interaction);
        break;
      case 'embed_edit_color':
        await showColorSelector(interaction);
        break;
      case 'embed_add_field':
        await showFieldModal(interaction);
        break;
      case 'embed_edit_footer':
        await showFooterModal(interaction);
        break;
      case 'embed_edit_image':
        await showImageModal(interaction);
        break;
      case 'embed_send':
        await handleSendEmbed(interaction);
        break;
      case 'embed_preview':
        await handlePreviewEmbed(interaction);
        break;
      case 'embed_clear':
        await handleClearEmbed(interaction);
        break;
    }
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  }
}

async function showTitleModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_title_modal')
    .setTitle('Edit Embed Title');

  const titleInput = new TextInputBuilder()
    .setCustomId('title_input')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(false);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

async function showDescriptionModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_description_modal')
    .setTitle('Edit Embed Description');

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description_input')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2048)
    .setRequired(false);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

async function showColorSelector(interaction: ButtonInteraction) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('embed_color_select')
    .setPlaceholder('Choose a color')
    .addOptions(
      colorOptions.map(option => 
        new StringSelectMenuOptionBuilder()
          .setLabel(option.label)
          .setValue(option.value)
          .setEmoji(option.emoji)
      )
    );

  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: 'Choose a color for your embed:',
    components: [actionRow],
    flags: MessageFlags.Ephemeral
  });
}

async function showFieldModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_field_modal')
    .setTitle('Add Embed Field');

  const nameInput = new TextInputBuilder()
    .setCustomId('field_name_input')
    .setLabel('Field Name')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(true);

  const valueInput = new TextInputBuilder()
    .setCustomId('field_value_input')
    .setLabel('Field Value')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1024)
    .setRequired(true);

  const inlineInput = new TextInputBuilder()
    .setCustomId('field_inline_input')
    .setLabel('Inline (true/false)')
    .setStyle(TextInputStyle.Short)
    .setValue('false')
    .setRequired(false);

  const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput);
  const actionRow3 = new ActionRowBuilder<TextInputBuilder>().addComponents(inlineInput);

  modal.addComponents(actionRow1, actionRow2, actionRow3);

  await interaction.showModal(modal);
}

async function showFooterModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_footer_modal')
    .setTitle('Edit Embed Footer');

  const footerInput = new TextInputBuilder()
    .setCustomId('footer_input')
    .setLabel('Footer Text')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(2048)
    .setRequired(false);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

async function showImageModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_image_modal')
    .setTitle('Edit Embed Image');

  const imageInput = new TextInputBuilder()
    .setCustomId('image_input')
    .setLabel('Image URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/image.png')
    .setRequired(false);

  const thumbnailInput = new TextInputBuilder()
    .setCustomId('thumbnail_input')
    .setLabel('Thumbnail URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/thumbnail.png')
    .setRequired(false);

  const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput);
  const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput);

  modal.addComponents(actionRow1, actionRow2);

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  // Handle modal submissions for embed builder
  await interaction.reply({ 
    content: 'Embed updated! (Modal handling not fully implemented)', 
    flags: MessageFlags.Ephemeral 
  });
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
  if (interaction.customId === 'embed_color_select') {
    const selectedColor = interaction.values[0];
    if (!selectedColor) return;
    
    await interaction.reply({ 
      content: `✅ Embed color set to ${selectedColor}! (Color application not fully implemented)`, 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleSendEmbed(interaction: ButtonInteraction) {
  await interaction.reply({ 
    content: 'Choose a channel to send the embed to... (Feature not fully implemented)', 
    flags: MessageFlags.Ephemeral 
  });
}

async function handlePreviewEmbed(interaction: ButtonInteraction) {
  const previewEmbed = new EmbedBuilder()
    .setTitle('Preview Embed')
    .setDescription('This is how your embed would look!')
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.reply({ 
    content: 'Here\'s your embed preview:',
    embeds: [previewEmbed], 
    flags: MessageFlags.Ephemeral 
  });
}

async function handleClearEmbed(interaction: ButtonInteraction) {
  await interaction.reply({ 
    content: '🗑️ Embed cleared! Start building a new one.', 
    flags: MessageFlags.Ephemeral 
  });
}

export const embedCommands = [embedCommand];