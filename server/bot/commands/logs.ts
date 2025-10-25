import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { storage } from '../../storage.js';

const logsCommand = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('📋 View recent bot logs')
    .addStringOption(option =>
      option
        .setName('level')
        .setDescription('Filter by log level')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Errors', value: 'error' },
          { name: 'Warnings', value: 'warn' },
          { name: 'Info', value: 'info' },
          { name: 'Debug', value: 'debug' }
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter by category')
        .addChoices(
          { name: 'Bot', value: 'Bot' },
          { name: 'Commands', value: 'Commands' },
          { name: 'Voice', value: 'Voice' },
          { name: 'Streams', value: 'Streams' },
          { name: 'Moderation', value: 'Moderation' },
          { name: 'System', value: 'System' }
        )
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of logs to display (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const level = interaction.options.getString('level') || 'all';
      const category = interaction.options.getString('category') || undefined;
      const limit = interaction.options.getInteger('limit') || 10;

      let logs = await storage.getBotLogs(interaction.guild.id, limit);

      // Filter by level if not 'all'
      if (level !== 'all') {
        logs = logs.filter(log => log.level === level);
      }

      // Filter by category if specified
      if (category) {
        logs = logs.filter(log => log.category === category);
      }

      if (logs.length === 0) {
        await interaction.editReply({
          content: '📭 No logs found matching your filters.'
        });
        return;
      }

      // Create embeds for logs (up to 10 embeds max)
      const embeds: EmbedBuilder[] = [];
      const colors = {
        error: 0xf44336,
        warn: 0xff9800,
        info: 0x2196f3,
        debug: 0x9e9e9e,
      };

      const icons = {
        error: '❌',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🔍',
      };

      logs.forEach(log => {
        const embed = new EmbedBuilder()
          .setColor(colors[log.level as keyof typeof colors] || 0x2196f3)
          .setTitle(`${icons[log.level as keyof typeof icons] || '📋'} ${log.level.toUpperCase()} - ${log.category}`)
          .setDescription(log.message)
          .addFields(
            {
              name: '⏰ Time',
              value: log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown',
              inline: true
            },
            {
              name: '📊 Sent to Discord',
              value: log.sentToDiscord ? '✅ Yes' : '❌ No',
              inline: true
            }
          );

        if (log.details && Object.keys(log.details).length > 0) {
          const detailsStr = Object.entries(log.details)
            .slice(0, 3) // Limit to 3 details to avoid too long fields
            .map(([key, value]) => `**${key}**: \`${JSON.stringify(value).substring(0, 50)}\``)
            .join('\n');

          if (detailsStr) {
            embed.addFields({ name: '📋 Details', value: detailsStr, inline: false });
          }
        }

        if (log.userId) {
          embed.addFields({
            name: '👤 User',
            value: `<@${log.userId}>`,
            inline: true
          });
        }

        embeds.push(embed);
      });

      // Split into groups of 10 if necessary
      const embed_groups = [];
      for (let i = 0; i < embeds.length; i += 10) {
        embed_groups.push(embeds.slice(i, i + 10));
      }

      // Send first group
      await interaction.editReply({
        embeds: embed_groups[0],
        content: `📋 **Recent Logs** (showing ${logs.length})`
      });

      // If there are more groups, send them as follow-ups
      for (let i = 1; i < embed_groups.length; i++) {
        await interaction.followUp({
          embeds: embed_groups[i],
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching logs.'
      });
    }
  }
};

export const logsCommands = [logsCommand];
