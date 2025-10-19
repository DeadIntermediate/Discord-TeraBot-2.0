import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType
} from 'discord.js';
import { socialMediaAPI, SocialPost } from '../../utils/socialMediaAPI';

export const data = new SlashCommandBuilder()
  .setName('socials')
  .setDescription('Pull posts from social media accounts')
  .addSubcommand(subcommand =>
    subcommand
      .setName('bluesky')
      .setDescription('Get recent posts from a BlueSky account')
      .addStringOption(option =>
        option
          .setName('handle')
          .setDescription('BlueSky handle (e.g., user.bsky.social or @handle)')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of posts to fetch (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('x')
      .setDescription('Get recent posts from an X (Twitter) account')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('X username (e.g., @username)')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of posts to fetch (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('instagram')
      .setDescription('Get recent posts from an Instagram account')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('Instagram username')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of posts to fetch (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'bluesky':
      return await handleBlueskyCommand(interaction);
    case 'x':
      return await handleXCommand(interaction);
    case 'instagram':
      return await handleInstagramCommand(interaction);
    default:
      return await interaction.reply({
        content: '❌ Unknown subcommand!',
        flags: MessageFlags.Ephemeral
      });
  }
}

async function handleBlueskyCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const handle = interaction.options.getString('handle', true);
  const limit = interaction.options.getInteger('limit') || 5;

  try {
    console.log(`🦋 Fetching BlueSky posts from ${handle}...`);
    const posts = await socialMediaAPI.getBlueskyPosts(handle, limit);

    if (posts.length === 0) {
      return await interaction.editReply({
        content: `❌ No posts found for BlueSky account **${handle}**. Make sure the handle is correct and the account exists.`
      });
    }

    await displayPosts(interaction, posts, 'bluesky');
  } catch (error) {
    console.error('Error fetching BlueSky posts:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching BlueSky posts. Please try again later.'
    });
  }
}

async function handleXCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const username = interaction.options.getString('username', true);
  const limit = interaction.options.getInteger('limit') || 5;

  try {
    console.log(`𝕏 Fetching X posts from ${username}...`);
    
    if (!process.env.X_API_KEY) {
      return await interaction.editReply({
        content: '❌ X API integration is not configured.\n\n**Admin:** Add `X_API_KEY` to your `.env` file with a valid X API bearer token from https://developer.twitter.com'
      });
    }

    const posts = await socialMediaAPI.getXPosts(username, limit);

    if (posts.length === 0) {
      return await interaction.editReply({
        content: `❌ No posts found for X account **${username}**. Make sure the username is correct and the account exists.`
      });
    }

    await displayPosts(interaction, posts, 'x');
  } catch (error) {
    console.error('Error fetching X posts:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching X posts. Please try again later.'
    });
  }
}

async function handleInstagramCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const username = interaction.options.getString('username', true);
  const limit = interaction.options.getInteger('limit') || 5;

  try {
    if (!process.env.INSTAGRAM_API_TOKEN) {
      return await interaction.editReply({
        content: '❌ Instagram API integration is not configured.\n\n**Setup Required:**\n1. Create a Meta/Facebook Developer account\n2. Set up an Instagram Business Account\n3. Generate an API token\n4. Add `INSTAGRAM_API_TOKEN` to your `.env` file'
      });
    }

    const posts = await socialMediaAPI.getInstagramPosts(username, limit);

    if (posts.length === 0) {
      return await interaction.editReply({
        content: `❌ No posts found for Instagram account **${username}** or API is not properly configured.`
      });
    }

    await displayPosts(interaction, posts, 'instagram');
  } catch (error) {
    console.error('Error fetching Instagram posts:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching Instagram posts. Please try again later.'
    });
  }
}

async function displayPosts(
  interaction: ChatInputCommandInteraction,
  posts: SocialPost[],
  platform: 'bluesky' | 'x' | 'instagram'
) {
  if (posts.length === 1) {
    // Show single post directly
    const embed = createPostEmbed(posts[0]);
    return await interaction.editReply({ embeds: [embed] });
  }

  // Create selection menu for multiple posts
  const options = posts.map((post, index) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Post ${index + 1} • ${post.likes.toLocaleString()} ❤️`)
      .setDescription(post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''))
      .setValue(index.toString())
      .setEmoji(platform === 'bluesky' ? '🦋' : platform === 'x' ? '𝕏' : '📸')
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('post_select')
    .setPlaceholder('Select a post to view')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  const platformName = platform === 'bluesky' ? 'BlueSky' : platform === 'x' ? 'X' : 'Instagram';
  const platformEmoji = platform === 'bluesky' ? '🦋' : platform === 'x' ? '𝕏' : '📸';

  const listEmbed = new EmbedBuilder()
    .setColor(
      platform === 'bluesky' ? 0x1185FE :
      platform === 'x' ? 0x000000 :
      0xE1306C
    )
    .setTitle(`${platformEmoji} Recent Posts from ${posts[0].author}`)
    .setDescription(`Found ${posts.length} recent posts. Select one to view details.`)
    .addFields(
      posts.slice(0, 5).map((post, index) => ({
        name: `${index + 1}. ${post.content.substring(0, 60)}${post.content.length > 60 ? '...' : ''}`,
        value: `❤️ ${post.likes.toLocaleString()} • 🔄 ${post.reposts || 0} • 💬 ${post.replies || 0}`,
        inline: false
      }))
    )
    .setFooter({ text: `${platformName} • Select a post from the dropdown` });

  const response = await interaction.editReply({
    embeds: [listEmbed],
    components: [row]
  });

  // Handle selection
  try {
    const confirmation = await response.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    const selectedIndex = parseInt(confirmation.values[0]);
    const selectedPost = posts[selectedIndex];

    if (selectedPost) {
      await confirmation.deferUpdate();
      const postEmbed = createPostEmbed(selectedPost);
      await interaction.editReply({
        embeds: [postEmbed],
        components: []
      });
    }
  } catch (error) {
    // Selection timeout - disable menu
    const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu.setDisabled(true));

    await interaction.editReply({
      components: [disabledRow]
    });
  }
}

function createPostEmbed(post: SocialPost): EmbedBuilder {
  const platformEmoji = post.platform === 'bluesky' ? '🦋' : post.platform === 'x' ? '𝕏' : '📸';
  const platformColor = post.platform === 'bluesky' ? 0x1185FE : post.platform === 'x' ? 0x000000 : 0xE1306C;

  const embed = new EmbedBuilder()
    .setColor(platformColor)
    .setTitle(`${platformEmoji} ${post.author}`)
    .setURL(post.url)
    .setDescription(post.content || '*No text content*')
    .addFields(
      {
        name: '📊 Engagement',
        value: `❤️ **${post.likes.toLocaleString()}** likes\n` +
               `🔄 **${post.reposts || 0}** reposts/retweets\n` +
               `💬 **${post.replies || 0}** replies`,
        inline: false
      }
    )
    .setFooter({
      text: `@${post.authorHandle} • ${post.timestamp.toLocaleDateString()} ${post.timestamp.toLocaleTimeString()}`,
      iconURL: post.authorAvatar
    });

  // Add first media if available
  if (post.media && post.media.length > 0) {
    embed.setImage(post.media[0].url);
  }

  return embed;
}
