import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, MessageFlags } from 'discord.js';
import { storage } from '../../storage';

const serverInfoCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display server information'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: 'An error occurred while fetching server information.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    try {
      const member = await storage.getServerMember(interaction.guild.id, targetUser.id);
      
      if (!member) {
        await interaction.reply({ 
          content: `${targetUser.tag} is not tracked in the leveling system yet.`, 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      try {
        const level = Number(member.level ?? 0);
        const xp = Number(member.xp ?? 0);
        
        // Validate that xp is not NaN
        if (isNaN(xp) || isNaN(level)) {
          console.error(`Invalid XP/Level for ${targetUser.id}: xp=${member.xp}, level=${member.level}`);
          await interaction.reply({ 
            content: 'Error: Invalid XP data in database. Please contact an admin.', 
            flags: MessageFlags.Ephemeral 
          });
          return;
        }

        const xpForNextLevel = Math.pow(level + 1, 2) * 100;
        const xpForCurrentLevel = Math.pow(level, 2) * 100;
        const xpNeeded = xpForNextLevel - xp;
        const progressXP = Math.max(0, xp - xpForCurrentLevel);
        const totalXPForLevel = Math.max(1, xpForNextLevel - xpForCurrentLevel);
        const progressPercent = Math.floor((progressXP / totalXPForLevel) * 100);
        
        // Create visual progress bar for overall XP
        const barLength = 20;
        const filledLength = Math.max(0, Math.min(barLength, Math.floor((progressXP / totalXPForLevel) * barLength)));
        const emptyLength = Math.max(0, barLength - filledLength);
        const progressBar = '🟩'.repeat(filledLength) + '🟥'.repeat(emptyLength);
        
        // Text XP progress
        const textLevel = Number(member.textLevel ?? 0);
        const textXp = Number(member.textXp ?? 0);
        const textXpForNextLevel = (textLevel + 1) * 100;
        const textXpForCurrentLevel = textLevel * 100;
        const textProgressXP = Math.max(0, textXp - textXpForCurrentLevel);
        const textTotalXP = Math.max(1, textXpForNextLevel - textXpForCurrentLevel);
        const textFilledLength = Math.max(0, Math.min(barLength, Math.floor((textProgressXP / textTotalXP) * barLength)));
        const textProgressBar = '🟦'.repeat(textFilledLength) + '⬜'.repeat(barLength - textFilledLength);
        const textProgressPercent = Math.floor((textProgressXP / textTotalXP) * 100);
        
        // Voice XP progress
        const voiceLevel = Number(member.voiceLevel ?? 0);
        const voiceXp = Number(member.voiceXp ?? 0);
        const voiceXpForNextLevel = (voiceLevel + 1) * 100;
        const voiceXpForCurrentLevel = voiceLevel * 100;
        const voiceProgressXP = Math.max(0, voiceXp - voiceXpForCurrentLevel);
        const voiceTotalXP = Math.max(1, voiceXpForNextLevel - voiceXpForCurrentLevel);
        const voiceFilledLength = Math.max(0, Math.min(barLength, Math.floor((voiceProgressXP / voiceTotalXP) * barLength)));
        const voiceProgressBar = '🟩'.repeat(voiceFilledLength) + '🟥'.repeat(barLength - voiceFilledLength);
        const voiceProgressPercent = Math.floor((voiceProgressXP / voiceTotalXP) * 100);

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
            { name: '💬 Messages Sent', value: String(member.messageCount ?? 0), inline: true },
            { name: '⏱️ Voice Time', value: `${Math.floor((Number(member.voiceTime ?? 0)) / 60)}h ${Number(member.voiceTime ?? 0) % 60}m`, inline: true },
            { name: '🎯 Total XP', value: `${xp.toLocaleString()}`, inline: true }
          )
          .setFooter({ text: `Requested by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (calcError) {
        console.error('Error in level calculations:', calcError, 'Member data:', member);
        await interaction.reply({ 
          content: 'Error calculating levels. Please contact an admin.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (error) {
      console.error('Error fetching level info:', error);
      await interaction.reply({ content: 'An error occurred while fetching level information.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const limit = interaction.options.getInteger('limit') || 10;
    
    try {
      const topMembers = await storage.getTopMembersByXP(interaction.guild.id, limit);
      
      if (topMembers.length === 0) {
        await interaction.reply({ content: 'No members found in the leaderboard.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: 'An error occurred while fetching the leaderboard.', flags: MessageFlags.Ephemeral });
    }
  },
};

export const utilityCommands = [
  serverInfoCommand,
  levelCommand,
  leaderboardCommand,
];
