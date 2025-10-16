import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { storage } from '../../storage';

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
      // Fetch additional guild data
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
    } catch (error) {
      console.error('Error fetching server info:', error);
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
          content: `${targetUser.tag} is not tracked in the leveling system yet.`, 
          ephemeral: true 
        });
        return;
      }

      const xpForNextLevel = Math.pow(member.level + 1, 2) * 100
      const xpForCurrentLevel = Math.pow(member.level, 2) * 100
      const xpNeeded = xpForNextLevel - member.xp
      const progressXP = member.xp - xpForCurrentLevel
      const totalXPForLevel = xpForNextLevel - xpForCurrentLevel
      const progressPercent = Math.floor((progressXP / totalXPForLevel) * 100)
      
      // Create visual progress bar for overall XP
      const barLength = 20
      const filledLength = Math.floor((progressXP / totalXPForLevel) * barLength)
      const emptyLength = barLength - filledLength
      const progressBar = '🟩'.repeat(filledLength) + '🟥'.repeat(emptyLength)
      
      // Text XP progress
      const textXpForNextLevel = (member.textLevel + 1) * 100
      const textXpForCurrentLevel = member.textLevel * 100
      const textProgressXP = member.textXp - textXpForCurrentLevel
      const textTotalXP = textXpForNextLevel - textXpForCurrentLevel
      const textFilledLength = Math.floor((textProgressXP / textTotalXP) * barLength)
      const textProgressBar = '🟦'.repeat(textFilledLength) + '⬜'.repeat(barLength - textFilledLength)
      const textProgressPercent = Math.floor((textProgressXP / textTotalXP) * 100)
      
      // Voice XP progress
      const voiceXpForNextLevel = (member.voiceLevel + 1) * 100
      const voiceXpForCurrentLevel = member.voiceLevel * 100
      const voiceProgressXP = member.voiceXp - voiceXpForCurrentLevel
      const voiceTotalXP = voiceXpForNextLevel - voiceXpForCurrentLevel
      const voiceFilledLength = Math.floor((voiceProgressXP / voiceTotalXP) * barLength)
      const voiceProgressBar = '�'.repeat(voiceFilledLength) + '🟥'.repeat(barLength - voiceFilledLength)
      const voiceProgressPercent = Math.floor((voiceProgressXP / voiceTotalXP) * 100)

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle(`📊 ${targetUser.tag}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`**Global Level ${member.globalLevel}**`)
        .addFields(
          { name: '📝 Text Level', value: `Level ${member.textLevel}`, inline: true },
          { name: '🎤 Voice Level', value: `Level ${member.voiceLevel}`, inline: true },
          { name: '📈 Legacy Level', value: `Level ${member.level}`, inline: true },
          { name: '📝 Text XP Progress', value: `\`${textProgressBar}\` ${textProgressPercent}%\n${textProgressXP}/${textTotalXP} XP`, inline: false },
          { name: '🎤 Voice XP Progress', value: `\`${voiceProgressBar}\` ${voiceProgressPercent}%\n${voiceProgressXP}/${voiceTotalXP} XP`, inline: false },
          { name: '💬 Messages Sent', value: member.messageCount.toLocaleString(), inline: true },
          { name: '⏱️ Voice Time', value: `${Math.floor(member.voiceTime / 60)}h ${member.voiceTime % 60}m`, inline: true },
          { name: '🎯 Total XP', value: `${member.xp.toLocaleString()}`, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp()

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching level info:', error);
      await interaction.reply({ content: 'An error occurred while fetching level information.', ephemeral: true });
    }
  },
};

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard')
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

    const limit = interaction.options.getInteger('limit') || 10;
    
    try {
      const topMembers = await storage.getTopMembersByXP(interaction.guild.id, limit);
      
      if (topMembers.length === 0) {
        await interaction.reply({ content: 'No members found in the leaderboard.', ephemeral: true });
        return;
      }

      const leaderboardText = topMembers.map((member, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} <@${member.userId}> - Level ${member.level} (${member.xp} XP)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 Server Leaderboard')
        .setDescription(leaderboardText)
        .setFooter({ text: `Showing top ${topMembers.length} members` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.reply({ content: 'An error occurred while fetching the leaderboard.', ephemeral: true });
    }
  },
};

export const utilityCommands = [
  serverInfoCommand,
  levelCommand,
  leaderboardCommand,
];
