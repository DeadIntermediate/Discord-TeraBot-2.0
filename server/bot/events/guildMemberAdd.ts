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

    // Create server member record or check if returning member
    let isReturningMember = false;
    let hasJoinedBefore = false;
    let firstJoinedAt: Date | undefined;
    try {
      const existingMember = await storage.getServerMember(member.guild.id, member.id);

      if (existingMember) {
        hasJoinedBefore = true;
        if (existingMember.joinedAt) {
          firstJoinedAt = existingMember.joinedAt;
        }
        
        // Check if member has left before (leftAt is set and not null)
        if (existingMember.leftAt !== null && existingMember.leftAt !== undefined) {
          isReturningMember = true;
        }
        
        // Clear the left date on rejoin
        await storage.updateServerMember(member.guild.id, member.id, {
          leftAt: null,
        });
      } else {
        // New member - create record
        await storage.createServerMember({
          serverId: member.guild.id,
          userId: member.id,
        });
      }
    } catch (dbError: any) {
      error('Failed to sync server member record:', dbError);
      // If database error occurs, try to create a basic member record
      // This handles cases where schema columns may not exist yet
      try {
        await storage.createServerMember({
          serverId: member.guild.id,
          userId: member.id,
        });
      } catch (createError) {
        error('Failed to create server member record:', createError);
      }
    }

    // Send welcome message
    const channel = member.guild.channels.cache.get(server.welcomeChannelId) as TextChannel;
    
    if (channel) {
      // Get member stats for the guild
      const guildMembers = await member.guild.members.fetch();
      const totalMembers = guildMembers.size;
      const botCount = guildMembers.filter(m => m.user.bot).size;
      const humanCount = totalMembers - botCount;

      // Check account age for potential security warnings
      const accountAge = Date.now() - member.user.createdAt.getTime();
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      const minAccountAge = (server as any).settings?.minAccountAgeDays || 0;
      
      let accountAgeWarning = '';
      if (minAccountAge > 0 && accountAgeDays < minAccountAge) {
        accountAgeWarning = '⚠️ **New Account Warning** - This account is newer than the server\'s minimum age requirement.';
      }

      const memberTypeIndicator = isReturningMember ? '🔄 **RETURNING MEMBER**' : '✨ **NEW MEMBER**';
      const statusBadge = isReturningMember ? '[RETURNING]' : '[NEW]';
      const joinedBeforeValue = (isReturningMember || hasJoinedBefore) ? '✅ Yes' : '❌ No';
      const firstJoinedValue = firstJoinedAt
        ? `<t:${Math.floor(firstJoinedAt.getTime() / 1000)}:F>`
        : '—';
      const greetingPrefix = isReturningMember ? 'Welcome back' : 'Welcome';

      const embed = new EmbedBuilder()
        .setColor(accountAgeWarning ? 0xffa500 : (isReturningMember ? 0x9c27b0 : 0x5865f2)) // Orange if warning, purple if returning, blue if new
        .setTitle(`👋 ${memberTypeIndicator}`)
        .setDescription(`${greetingPrefix} ${member.toString()} to **${member.guild.name}**!`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '👤 Member Name', value: `${member.user.username}`, inline: true },
          { name: '🏷️ Account Created', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
          { name: '📋 Member Status', value: memberTypeIndicator, inline: true },
          { name: '🔁 Joined Before', value: joinedBeforeValue, inline: true },
          ...(firstJoinedAt ? [{ name: '🗓️ First Joined', value: firstJoinedValue, inline: true }] : []),
          { name: '👥 Member Count', value: `${humanCount} members`, inline: true },
          { name: '🤖 Bot Count', value: `${botCount} bots`, inline: true },
          { name: '📊 Total Count', value: `${totalMembers} total`, inline: true }
        )
        .setFooter({ text: `Member #${totalMembers} ${statusBadge} • ${member.guild.name}` })
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

    info(`${isReturningMember ? 'Returning' : 'New'} member joined ${member.guild.name}: ${member.user.tag}`);
  } catch (error) {
    const { error: logError } = await import('../../utils/logger');
    logError('Error handling guild member add:', error);
  }
}
