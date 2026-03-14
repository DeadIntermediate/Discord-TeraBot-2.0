import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { storage } from '../../storage';
import { calculateLevel } from '../../utils/xp';
import { error } from '../../utils/logger';

const serverInfoCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display server information'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;

    try {
      const owner = await guild.fetchOwner();
      const channels = guild.channels.cache;
      const textChannels = channels.filter(channel => channel.type === ChannelType.GuildText).size;
      const voiceChannels = channels.filter(channel => channel.type === ChannelType.GuildVoice).size;
      const members = guild.members.cache;
      const humanCount = members.filter(member => !member.user.bot).size;
      const botCount = members.filter(member => member.user.bot).size;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Server Information')
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Server Name', value: guild.name, inline: true },
          { name: 'Server ID', value: guild.id, inline: true },
          { name: 'Owner', value: owner.user.tag, inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Members', value: `${guild.memberCount} (${humanCount} humans, ${botCount} bots)`, inline: true },
          { name: 'Channels', value: `${textChannels} text, ${voiceChannels} voice`, inline: true },
          { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
          { name: 'Boost Count', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: 'Verification Level', value: guild.verificationLevel.toString(), inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      error('Error fetching server info:', err);
      await interaction.reply({ content: 'An error occurred while fetching server information.', ephemeral: true });
    }
  },
};

const levelCommand = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your or another user\'s level')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check')
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const member = await storage.getServerMember(interaction.guild.id, targetUser.id);

      if (!member) {
        await interaction.reply({
          content: `${targetUser.tag} hasn't earned any XP yet.`,
          ephemeral: true
        });
        return;
      }

      const textXp = Number(member.textXp ?? 0);
      const voiceXp = Number(member.voiceXp ?? 0);
      const globalLevel = Number(member.globalLevel ?? 1);

      const textInfo = calculateLevel(textXp);
      const voiceInfo = calculateLevel(voiceXp);

      const BAR = 20;
      const textFilled = Math.floor((textInfo.xpInLevel / textInfo.xpForNext) * BAR);
      const voiceFilled = Math.floor((voiceInfo.xpInLevel / voiceInfo.xpForNext) * BAR);

      const textBar = '🟦'.repeat(textFilled) + '⬜'.repeat(BAR - textFilled);
      const voiceBar = '🟩'.repeat(voiceFilled) + '⬜'.repeat(BAR - voiceFilled);

      const voiceMinutes = Number(member.voiceTime ?? 0);
      const voiceHours = Math.floor(voiceMinutes / 60);
      const voiceRemainingMin = voiceMinutes % 60;
      const voiceTimeStr = voiceHours > 0
        ? `${voiceHours}h ${voiceRemainingMin}m`
        : `${voiceRemainingMin}m`;

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle(`📊 ${targetUser.tag}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`**Global Level ${globalLevel}**`)
        .addFields(
          { name: '📝 Text Level', value: `Level ${textInfo.level}`, inline: true },
          { name: '🎤 Voice Level', value: `Level ${voiceInfo.level}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          {
            name: '📝 Text XP',
            value: `\`${textBar}\`\n${textInfo.xpInLevel} / ${textInfo.xpForNext} XP to next level`,
            inline: false
          },
          {
            name: '🎤 Voice XP',
            value: `\`${voiceBar}\`\n${voiceInfo.xpInLevel} / ${voiceInfo.xpForNext} XP to next level`,
            inline: false
          },
          { name: '💬 Messages', value: String(member.messageCount ?? 0), inline: true },
          { name: '⏱️ Voice Time', value: voiceTimeStr, inline: true },
          { name: '🎯 Total XP', value: (textXp + voiceXp).toLocaleString(), inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      error('Error fetching level info:', err);
      await interaction.reply({ content: 'An error occurred while fetching level information.', ephemeral: true });
    }
  },
};

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'Total XP', value: 'total' },
          { name: 'Text XP', value: 'text' },
          { name: 'Voice XP', value: 'voice' },
        ))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of users to show (1-25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const type = interaction.options.getString('type') || 'total';
    const limit = interaction.options.getInteger('limit') || 10;

    try {
      const topMembers = await storage.getTopMembersByXP(interaction.guild.id, limit, type as any);

      if (topMembers.length === 0) {
        await interaction.reply({ content: 'No members found in the leaderboard yet.', ephemeral: true });
        return;
      }

      const typeLabels: Record<string, string> = { total: 'Total XP', text: 'Text XP', voice: 'Voice XP' };

      const leaderboardText = topMembers.map((member, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const textXp = Number(member.textXp ?? 0);
        const voiceXp = Number(member.voiceXp ?? 0);
        const totalXp = textXp + voiceXp;
        const { level } = calculateLevel(type === 'voice' ? voiceXp : type === 'text' ? textXp : totalXp);
        const xpDisplay = type === 'voice' ? voiceXp : type === 'text' ? textXp : totalXp;
        return `${medal} <@${member.userId}> — Level ${level} (${xpDisplay.toLocaleString()} XP)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏆 Leaderboard — ${typeLabels[type]}`)
        .setDescription(leaderboardText)
        .setFooter({ text: `Top ${topMembers.length} members` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      error('Error fetching leaderboard:', err);
      await interaction.reply({ content: 'An error occurred while fetching the leaderboard.', ephemeral: true });
    }
  },
};

export const utilityCommands = [
  serverInfoCommand,
  levelCommand,
  leaderboardCommand,
];
