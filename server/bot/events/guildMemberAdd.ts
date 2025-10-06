import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { storage } from '../../storage';

export async function guildMemberAddHandler(member: GuildMember) {
  try {
    // Get server settings
    const server = await storage.getDiscordServer(member.guild.id);
    
    if (!server || !server.welcomeChannelId) {
      return; // No welcome channel configured
    }

    // Create or update Discord user
    let discordUser = await storage.getDiscordUser(member.id);
    if (!discordUser) {
      discordUser = await storage.createDiscordUser({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        isBot: member.user.bot,
      });
    }

    // Create server member record
    await storage.createServerMember({
      serverId: member.guild.id,
      userId: member.id,
    });

    // Send welcome message
    const channel = member.guild.channels.cache.get(server.welcomeChannelId) as TextChannel;
    
    if (channel) {
      const welcomeMessage = server.welcomeMessage || 
        `Welcome to the server, ${member}! We're excited to have you here!`;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('👋 Welcome to the Server!')
        .setDescription(welcomeMessage)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '📋 Server Rules', value: 'Check out the rules channel for guidelines', inline: true },
          { name: '💬 Get Started', value: 'Introduce yourself and start chatting!', inline: true },
          { name: '🎮 Have Fun', value: 'Join voice channels and participate in activities', inline: true }
        )
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

      await channel.send({ 
        content: `Welcome ${member}!`,
        embeds: [embed] 
      });
    }

    // Update server member count
    await storage.updateDiscordServer(member.guild.id, {
      memberCount: member.guild.memberCount,
    });

    console.log(`New member joined ${member.guild.name}: ${member.user.tag}`);
  } catch (error) {
    console.error('Error handling guild member add:', error);
  }
}
