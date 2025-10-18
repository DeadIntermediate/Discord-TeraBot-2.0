import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display all available commands and features')

export async function execute(interaction: ChatInputCommandInteraction) {
  const mainEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Tera Bot - Help & Commands')
    .setDescription('Welcome to Tera Bot! Here are all available commands organized by category.')
    .addFields(
      {
        name: '📊 Leveling & XP',
        value: '`/profile` - View your or another user\'s profile with XP progress\n`/leaderboard` - See top users by level or XP\n**Features:** Text XP from messages, Voice XP from voice channels',
        inline: false
      },
      {
        name: '🎮 Games & Fun',
        value: '`/games` - Play games like trivia, number guess, word scramble',
        inline: false
      },
      {
        name: '🎁 Giveaways',
        value: '`/giveaway create` - Start a new giveaway\n`/giveaway end` - End a giveaway early\n`/giveaway reroll` - Reroll a giveaway winner',
        inline: false
      },
      {
        name: '🎬 Stream Notifications',
        value: '`/stream addme` - Auto-add your connected streaming platforms\n`/stream add` - Manually add a streamer to track\n`/stream remove` - Stop tracking a streamer\n`/stream list` - View all tracked streamers\n`/stream setup` - Configure notification channel',
        inline: false
      },
      {
        name: '🎫 Tickets',
        value: '`/ticket setup` - Configure ticket system\n`/ticket close` - Close a ticket\n`/ticket add` - Add user to ticket\n`/ticket remove` - Remove user from ticket',
        inline: false
      },
      {
        name: '🎨 Custom Embeds',
        value: '`/embed create` - Create a custom embed message\n`/embed edit` - Edit an existing embed\n**Features:** Custom colors, images, fields, and more',
        inline: false
      },
      {
        name: '🔨 Moderation',
        value: '`/ban` - Ban a user from the server\n`/kick` - Kick a user from the server\n`/warn` - Warn a user\n`/mute` - Mute a user\n`/unmute` - Unmute a user',
        inline: false
      },
      {
        name: '🎭 Role Reactions',
        value: '`/rolereaction setup` - Create role reaction messages\n**Features:** Users can react to get/remove roles automatically',
        inline: false
      },
      {
        name: 'ℹ️ Utility',
        value: '`/serverinfo` - Display server information\n`/ping` - Check bot latency',
        inline: false
      }
    )
    .setFooter({ text: 'Tera Bot v2.0 • Node.js' })
    .setTimestamp()

  // XP System Info Embed
  const xpEmbed = new EmbedBuilder()
    .setColor(0x4CAF50)
    .setTitle('📊 XP & Leveling System')
    .setDescription('Tera Bot features a dual XP system that tracks both text and voice activity!')
    .addFields(
      {
        name: '📝 Text XP',
        value: '• Earn XP by sending messages\n• Random XP between 15-25 per message\n• 60 second cooldown between XP gains\n• Track your progress with `/profile`',
        inline: true
      },
      {
        name: '🎤 Voice XP',
        value: '• Earn 2 XP per minute in voice channels\n• Automatically tracked when you join voice\n• AFK channel excluded\n• View voice time in your profile',
        inline: true
      },
      {
        name: '🏆 Global Level',
        value: 'Your global level is the average of your text and voice levels, representing your overall activity!',
        inline: false
      },
      {
        name: '📈 Level Formula',
        value: '`XP Required = 100 × Current Level`\nExample: Level 1→2 needs 100 XP, Level 5→6 needs 500 XP',
        inline: false
      }
    )

  // Stream System Info Embed
  const streamEmbed = new EmbedBuilder()
    .setColor(0x9146FF)
    .setTitle('🎬 Stream Notification System')
    .setDescription('Get notified when your favorite streamers go live!')
    .addFields(
      {
        name: '🎮 Supported Platforms',
        value: '✅ **Twitch** - Full support\n✅ **YouTube** - Full support\n✅ **Kick** - Full support',
        inline: false
      },
      {
        name: '⚡ Auto-Detection',
        value: 'Use `/stream addme` to automatically detect and add all streaming platforms connected to your Discord profile!',
        inline: false
      },
      {
        name: '🔔 Notifications Include',
        value: '• Stream title and game/category\n• Live thumbnail\n• Viewer count\n• Direct link to stream\n• Optional role pings',
        inline: false
      },
      {
        name: '⚙️ Setup',
        value: '1. Use `/stream setup` to set notification channel\n2. Add streamers with `/stream addme` or `/stream add`\n3. Bot checks every 5 minutes for live streams',
        inline: false
      }
    )

  // Features Embed
  const featuresEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('✨ Bot Features & Info')
    .addFields(
      {
        name: '🚀 Performance',
        value: '• Auto-sharding enabled for unlimited server scaling\n• PostgreSQL database for reliable data storage\n• Real-time event processing\n• Optimized for Raspberry Pi',
        inline: false
      },
      {
        name: '🎮 Interactive Systems',
        value: '• Role reactions for self-assignable roles\n• Ticket system for support channels\n• Custom embeds with rich formatting\n• Giveaway system with fair random selection',
        inline: false
      },
      {
        name: '🎲 Games',
        value: '• Trivia questions with multiple difficulties\n• Number guessing game (1-100)\n• Word scramble challenges',
        inline: false
      },
      {
        name: '🔒 Moderation',
        value: '• Full moderation suite (ban, kick, warn, mute)\n• Moderation logs stored in database\n• Temporary and permanent actions\n• Permission-based command access',
        inline: false
      },
      {
        name: '📊 Stats Tracking',
        value: '• Message count per user\n• Voice time tracking\n• Separate XP for text and voice\n• Server-wide leaderboards',
        inline: false
      }
    )
    .setFooter({ text: 'Made with ❤️ using Discord.js & Node.js' })

  try {
    await interaction.reply({ 
      embeds: [mainEmbed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('help_menu')
              .setPlaceholder('📚 Select a category for more info')
              .addOptions([
                {
                  label: 'Main Commands',
                  description: 'View all available commands',
                  value: 'main',
                  emoji: '🤖'
                },
                {
                  label: 'XP & Leveling System',
                  description: 'Learn about the XP system',
                  value: 'xp',
                  emoji: '📊'
                },
                {
                  label: 'Stream Notifications',
                  description: 'Stream notification system info',
                  value: 'stream',
                  emoji: '🎬'
                },
                {
                  label: 'Features & Info',
                  description: 'Bot features and capabilities',
                  value: 'features',
                  emoji: '✨'
                }
              ])
          )
      ]
    })

    // Handle select menu interactions
    const collector = interaction.channel?.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId === 'help_menu',
      time: 300000 // 5 minutes
    })

    collector?.on('collect', async (i) => {
      if (!i.isStringSelectMenu()) return

      const selected = i.values[0]
      let embedToSend: EmbedBuilder

      switch (selected) {
        case 'main':
          embedToSend = mainEmbed
          break
        case 'xp':
          embedToSend = xpEmbed
          break
        case 'stream':
          embedToSend = streamEmbed
          break
        case 'features':
          embedToSend = featuresEmbed
          break
        default:
          embedToSend = mainEmbed
      }

      await i.update({ embeds: [embedToSend] })
    })

    collector?.on('end', async () => {
      try {
        await interaction.editReply({ components: [] })
      } catch (error) {
        // Message might be deleted, ignore error
      }
    })

  } catch (error) {
    console.error('Error executing help command:', error)
    await interaction.reply({ 
      content: 'An error occurred while displaying the help menu.', 
      ephemeral: true 
    })
  }
}
