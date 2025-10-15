import { GuildMember, EmbedBuilder, TextChannel, PartialGuildMember } from 'discord.js';
import { storage } from '../../storage';

export async function guildMemberRemoveHandler(member: GuildMember | PartialGuildMember) {
  try {
    // Get server settings
    const server = await storage.getDiscordServer(member.guild.id);
    
    if (!server || !server.welcomeChannelId) {
      return; // No welcome/leave channel configured
    }

    // Update server member record with leave date
    await storage.updateServerMember(member.guild.id, member.id, {
      leftAt: new Date(),
    });

    // Send leave message if enabled in server settings
    const showLeaveMessages = server.settings?.showLeaveMessages !== false; // Default to true
    
    if (showLeaveMessages) {
      const channel = member.guild.channels.cache.get(server.welcomeChannelId) as TextChannel;
      
      if (channel) {
        const leaveMessage = server.settings?.leaveMessage || 
          `**{username}** has left the server. We'll miss you!`;

        // Replace placeholders
        const formattedMessage = leaveMessage
          .replace('{username}', member.user?.username || 'Unknown User')
          .replace('{displayName}', member.displayName || member.user?.username || 'Unknown User')
          .replace('{tag}', member.user?.tag || 'Unknown User')
          .replace('{memberCount}', member.guild.memberCount.toString());

        const embed = new EmbedBuilder()
          .setColor(0xff6b6b) // Red color for leave messages
          .setTitle('👋 Member Left')
          .setDescription(formattedMessage)
          .setThumbnail(member.user?.displayAvatarURL() || null)
          .addFields(
            { name: '📊 Member Count', value: `${member.guild.memberCount} members`, inline: true },
            { name: '📅 Account Age', value: member.user?.createdAt ? `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>` : 'Unknown', inline: true }
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    // Update server member count
    await storage.updateDiscordServer(member.guild.id, {
      memberCount: member.guild.memberCount,
    });

    console.log(`Member left ${member.guild.name}: ${member.user?.tag || 'Unknown User'}`);
  } catch (error) {
    console.error('Error handling guild member remove:', error);
  }
}