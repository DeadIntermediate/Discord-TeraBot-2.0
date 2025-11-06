import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
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
        // Voice levels: to advance from level N to N+1 requires N*100 XP
        // Calculate XP needed for NEXT level: (voiceLevel + 1) * 100
        // Calculate progress within current level by subtracting all XP spent on previous levels
        let xpSpentOnPreviousLevels = 0;
        for (let i = 1; i < voiceLevel; i++) {
          xpSpentOnPreviousLevels += i * 100;
        }
        const voiceXpInCurrentLevel = Math.max(0, voiceXp - xpSpentOnPreviousLevels);
        const voiceXpNeededForNextLevel = (voiceLevel + 1) * 100;
        const voiceProgressXP = Math.max(0, Math.min(voiceXpInCurrentLevel, voiceXpNeededForNextLevel));
        const voiceTotalXP = Math.max(1, voiceXpNeededForNextLevel);
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

const voiceXpMigrationCommand = {
  data: new SlashCommandBuilder()
    .setName('migrate_voice_xp')
    .setDescription('🔧 ADMIN: Migrate existing voice time to voice XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Check if user is admin
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    try {
      // Get all members for this server
      const members = await storage.getServerMembers(interaction.guild.id);
      
      if (!members || members.length === 0) {
        return await interaction.editReply('❌ No members found in the database.');
      }

      let migratedCount = 0;
      let xpAwardedTotal = 0;

      const VOICE_XP_PER_MINUTE = 2;
      const XP_PER_LEVEL = 100;

      for (const member of members) {
        const voiceTimeMinutes = Number(member.voiceTime ?? 0);
        const currentVoiceXp = Number(member.voiceXp ?? 0);

        // Only migrate if they have voice time but no (or low) XP
        if (voiceTimeMinutes > 0 && currentVoiceXp < voiceTimeMinutes * VOICE_XP_PER_MINUTE) {
          const calculatedXp = voiceTimeMinutes * VOICE_XP_PER_MINUTE;
          const xpGain = calculatedXp - currentVoiceXp;

          // Calculate new level
          let newVoiceLevel = 1;
          let remainingXp = calculatedXp;

          while (remainingXp >= XP_PER_LEVEL * newVoiceLevel) {
            remainingXp -= XP_PER_LEVEL * newVoiceLevel;
            newVoiceLevel++;
          }

          // Calculate new global level
          const textLevel = Number(member.textLevel ?? 1);
          const newGlobalLevel = Math.floor((textLevel + newVoiceLevel) / 2);

          // Update member
          await storage.updateServerMember(interaction.guild.id, member.userId, {
            voiceXp: calculatedXp,
            voiceLevel: newVoiceLevel,
            globalLevel: newGlobalLevel,
          });

          migratedCount++;
          xpAwardedTotal += xpGain;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle('✅ Voice XP Migration Complete')
        .addFields(
          { name: 'Members Migrated', value: String(migratedCount), inline: true },
          { name: 'Total XP Awarded', value: String(xpAwardedTotal), inline: true },
          { name: 'Members Processed', value: String(members.length), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error during voice XP migration:', error);
      await interaction.editReply('❌ An error occurred during migration. Please check the server logs.');
    }
  },
};

const debugToggleCommand = {
  data: new SlashCommandBuilder()
    .setName('debug')
    .setDescription('🔧 BOT OWNER ONLY: Toggle debug mode on/off')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Set debug mode')
        .setRequired(false)
        .addChoices(
          { name: 'Enable', value: 'debug' },
          { name: 'Disable', value: 'info' },
          { name: 'Show Current', value: 'show' }
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const botOwnerId = process.env.BOT_OWNER;
    
    // Check if user is bot owner
    if (!botOwnerId || interaction.user.id !== botOwnerId) {
      await interaction.reply({ 
        content: '❌ Only the bot owner can use this command.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    const mode = interaction.options.getString('mode') || 'show';
    
    try {
      const { setLogLevel, getLogLevel } = await import('../../utils/logger');
      
      if (mode === 'show') {
        const currentLevel = getLogLevel();
        const embed = new EmbedBuilder()
          .setColor(0x00AAFF)
          .setTitle('🔍 Debug Status')
          .setDescription(`Current log level: **${currentLevel}**`)
          .addFields(
            { name: 'Debug Mode', value: currentLevel === 'DEBUG' ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Info', value: currentLevel !== 'ERROR' ? '✅ Logging' : '❌ Silent', inline: true }
          )
          .setFooter({ text: 'Use /debug with mode option to change' })
          .setTimestamp();
        
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      setLogLevel(mode);
      const newLevel = getLogLevel();
      
      const embed = new EmbedBuilder()
        .setColor(mode === 'debug' ? 0x00FF00 : 0xFF6600)
        .setTitle('🔧 Debug Mode Updated')
        .setDescription(`Log level changed to: **${newLevel}**`)
        .addFields(
          { name: 'Status', value: mode === 'debug' ? '🟢 Debug Enabled' : '🟠 Debug Disabled', inline: false },
          { name: 'Will Show', value: mode === 'debug' ? 'Errors, Warnings, Info, & Debug messages' : 'Errors, Warnings, & Info messages', inline: false }
        )
        .setFooter({ text: 'All console output will reflect this change immediately' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error toggling debug mode:', error);
      await interaction.reply({ 
        content: '❌ An error occurred while toggling debug mode.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  },
};

const memberInfoCommand = {
  data: new SlashCommandBuilder()
    .setName('memberinfo')
    .setDescription('Display detailed information about a member')
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
      const member = await interaction.guild.members.fetch(targetUser.id);
      
      let textLevel = 0;
      let voiceLevel = 0;
      let globalLevel = 0;
      let textXp = 0;
      let voiceXp = 0;
      let messageCount = 0;
      let voiceTime = 0;
      let firstJoinedAt: Date | undefined = undefined;

      // Try to fetch server member data, but handle schema mismatches gracefully
      try {
        const serverMember = await storage.getServerMember(interaction.guild.id, targetUser.id);
        if (serverMember) {
          textLevel = Number(serverMember.textLevel ?? 0);
          voiceLevel = Number(serverMember.voiceLevel ?? 0);
          globalLevel = Number(serverMember.globalLevel ?? 0);
          textXp = Number(serverMember.textXp ?? 0);
          voiceXp = Number(serverMember.voiceXp ?? 0);
          messageCount = Number(serverMember.messageCount ?? 0);
          voiceTime = Number(serverMember.voiceTime ?? 0);
          if (serverMember.joinedAt) {
            firstJoinedAt = serverMember.joinedAt;
          }
        }
      } catch (dbError: any) {
        // Database schema might be incomplete - continue with defaults
        console.error('Database schema incomplete, using default values:', dbError.message);
      }

      const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
      const joinedServer = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : Math.floor(Date.now() / 1000);
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild?.id) // Filter out @everyone
        .map(role => role.toString())
        .join(', ') || 'None';

      const voiceHours = Math.floor(voiceTime / 60);
      const voiceMinutes = voiceTime % 60;

      const firstJoinedValue = firstJoinedAt
        ? `<t:${Math.floor(firstJoinedAt.getTime() / 1000)}:F>`
        : 'Not tracked';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👤 ${member.user.tag}`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
          { name: '🤖 Bot', value: member.user.bot ? '✅ Yes' : '❌ No', inline: true },
          { name: '⏸️ Status', value: member.presence?.status ? member.presence.status.toUpperCase() : 'Offline', inline: true },
          { name: '📅 Account Created', value: `<t:${accountCreated}:F>\n(<t:${accountCreated}:R>)`, inline: false },
          { name: '✅ Joined Server', value: `<t:${joinedServer}:F>\n(<t:${joinedServer}:R>)`, inline: false },
          { name: '🗓️ First Join Recorded', value: firstJoinedValue, inline: false },
          { name: '🎯 Roles', value: roles.length > 1024 ? roles.substring(0, 1021) + '...' : roles, inline: false },
          { name: '📊 Overall Level', value: `**${globalLevel}**`, inline: true },
          { name: '📝 Text Level', value: `**${textLevel}** (${textXp.toLocaleString()} XP)`, inline: true },
          { name: '🎤 Voice Level', value: `**${voiceLevel}** (${voiceXp.toLocaleString()} XP)`, inline: true },
          { name: '💬 Messages Sent', value: String(messageCount), inline: true },
          { name: '�️ Voice Time', value: `${voiceHours}h ${voiceMinutes}m`, inline: true },
          { name: '🔔 Boosts', value: member.premiumSince ? `Since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>` : 'Not boosting', inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching member info:', error);
      if (error instanceof Error && error.message.includes('Unknown User')) {
        await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: 'An error occurred while fetching member information.', flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export const utilityCommands = [
  serverInfoCommand,
  levelCommand,
  leaderboardCommand,
  memberInfoCommand,
  voiceXpMigrationCommand,
  debugToggleCommand,
];
