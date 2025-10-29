import { GuildMember, EmbedBuilder, TextChannel, PartialGuildMember } from 'discord.js';
import { storage } from '../../storage';
import { info, error } from '../../utils/logger';

export async function guildMemberRemoveHandler(member: GuildMember | PartialGuildMember) {
  try {
    // Get server settings
    const server = await storage.getDiscordServer(member.guild.id);
    
    if (!server || !server.welcomeChannelId) {
      return; // No welcome/leave channel configured
    }

    // Update server member record with leave date
    try {
      await storage.updateServerMember(member.guild.id, member.id, {
        leftAt: new Date(),
      });
    } catch (dbError: any) {
      // Silently continue if update fails - leave announcement will still work
      const { error: logError } = await import('../../utils/logger');
      logError('Error updating member leave date:', dbError);
    }

    // Send leave message if enabled in server settings
    const showLeaveMessages = (server as any).settings?.showLeaveMessages !== false; // Default to true
    
    if (showLeaveMessages) {
      const channel = member.guild.channels.cache.get(server.welcomeChannelId) as TextChannel;
      
      if (channel) {
        // Get member stats for the guild
        const guildMembers = await member.guild.members.fetch();
        const totalMembers = guildMembers.size;
        const botCount = guildMembers.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const username = member.user?.username || 'Unknown User';
        const userTag = member.user?.tag || 'Unknown User';
        const userId = member.id;
        const avatarUrl = member.user?.displayAvatarURL({ size: 256 }) || null;

        const embed = new EmbedBuilder()
          .setColor(0xff6b6b) // Red color for leave messages
          .setTitle('👋 Member Left')
          .setDescription(`**${username}** has left **${member.guild.name}**. We'll miss you!`)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: '� Member Name', value: `${username}`, inline: true },
            { name: '🏷️ Account Created', value: member.user?.createdAt ? `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
            { name: '🆔 User ID', value: `\`${userId}\``, inline: true },
            { name: '👥 Member Count', value: `${humanCount} members`, inline: true },
            { name: '🤖 Bot Count', value: `${botCount} bots`, inline: true },
            { name: '📊 Total Count', value: `${totalMembers} total`, inline: true }
          )
          .setFooter({ text: `User ID: ${userId} • ${member.guild.name}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    // Update server member count
    await storage.updateDiscordServer(member.guild.id, {
      memberCount: member.guild.memberCount,
    });

    info(`Member left ${member.guild.name}: ${member.user?.tag || 'Unknown User'}`);
  } catch (error) {
    const { error: logError } = await import('../../utils/logger');
    logError('Error handling guild member remove:', error);
  }
}