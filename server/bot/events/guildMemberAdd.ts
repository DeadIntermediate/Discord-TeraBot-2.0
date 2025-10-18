import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { storage } from '../../storage';
import { info, error } from '../../utils/logger';

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
        `Welcome to **{serverName}**, {mention}! We're excited to have you here!`;

      // Replace placeholders in welcome message
      const formattedMessage = welcomeMessage
        .replace('{mention}', member.toString())
        .replace('{username}', member.user.username)
        .replace('{displayName}', member.displayName)
        .replace('{tag}', member.user.tag)
        .replace('{serverName}', member.guild.name)
        .replace('{memberCount}', member.guild.memberCount.toString());

      // Check account age for potential security warnings
      const accountAge = Date.now() - member.user.createdAt.getTime();
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      const minAccountAge = (server as any).settings?.minAccountAgeDays || 0;
      
      let accountAgeWarning = '';
      if (minAccountAge > 0 && accountAgeDays < minAccountAge) {
        accountAgeWarning = '⚠️ **New Account Warning** - This account is newer than the server\'s minimum age requirement.';
      }

      const embed = new EmbedBuilder()
        .setColor(accountAgeWarning ? 0xffa500 : 0x5865f2) // Orange if warning, blue otherwise
        .setTitle('👋 Welcome to the Server!')
        .setDescription(formattedMessage)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '� User Info', value: `${member.user.tag}\nID: ${member.id}`, inline: true },
          { name: '� Member Count', value: `${member.guild.memberCount} members`, inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: `Member #${member.guild.memberCount} • Welcome to ${member.guild.name}` })
        .setTimestamp();

      // Add warning field if account is too new
      if (accountAgeWarning) {
        embed.addFields({ name: '⚠️ Security Notice', value: accountAgeWarning, inline: false });
      }

      // Add custom fields from server settings
      const customFields = (server as any).settings?.welcomeFields;
      if (customFields && Array.isArray(customFields)) {
        customFields.forEach(field => {
          if (field.name && field.value) {
            embed.addFields({ 
              name: field.name, 
              value: field.value.replace('{mention}', member.toString()), 
              inline: field.inline || false 
            });
          }
        });
      }

      await channel.send({ 
  content: (server as any).settings?.pingOnWelcome ? member.toString() : undefined,
        embeds: [embed] 
      });
    }

    // Update server member count
    await storage.updateDiscordServer(member.guild.id, {
      memberCount: member.guild.memberCount,
    });

    info(`New member joined ${member.guild.name}: ${member.user.tag}`);
  } catch (error) {
    const { error: logError } = await import('../../utils/logger');
    logError('Error handling guild member add:', error);
  }
}
