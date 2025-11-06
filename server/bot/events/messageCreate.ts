import { Message } from 'discord.js';
import { storage } from '../../storage';
import { info, debug, error } from '../../utils/logger';

// XP Configuration for text messages
const TEXT_XP_PER_MESSAGE = 5;
const XP_PER_LEVEL = 100;
const COOLDOWN_MS = 5000; // 5 second cooldown between text XP awards per user

// Track user message cooldowns
const userCooldowns = new Map<string, number>();

export async function messageCreateHandler(message: Message) {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild || !message.guildId) {
    return;
  }

  // Ignore very short messages (spam prevention)
  if (message.content.trim().length < 3) {
    return;
  }

  const guildId = message.guildId;
  const userId = message.author.id;
  const cooldownKey = `${guildId}-${userId}`;
  const now = Date.now();
  const userLastXpTime = userCooldowns.get(cooldownKey) || 0;

  // Check if user is on cooldown
  if (now - userLastXpTime < COOLDOWN_MS) {
    return;
  }

  try {
    // Get or create server member
    let member = await storage.getServerMember(guildId, userId);

    if (!member) {
      // Create new member record
      await storage.createServerMember({
        serverId: guildId,
        userId: userId,
        xp: 0,
        level: 1,
        textXp: 0,
        textLevel: 1,
        voiceXp: 0,
        voiceLevel: 1,
        globalLevel: 1,
        voiceTime: 0,
        messageCount: 0,
      });

      member = await storage.getServerMember(guildId, userId);
      info(`📝 [TEXT_NEW_MEMBER] Created new server member record for ${message.author.tag}`);
    }

    if (member) {
      // Update cooldown
      userCooldowns.set(cooldownKey, now);

      // Calculate new text XP and message count
      const newTextXp = (member.textXp || 0) + TEXT_XP_PER_MESSAGE;
      const newMessageCount = (member.messageCount || 0) + 1;

      // Calculate new text level
      let newTextLevel = member.textLevel || 1;
      let remainingXp = newTextXp;

      while (remainingXp >= XP_PER_LEVEL * newTextLevel) {
        remainingXp -= XP_PER_LEVEL * newTextLevel;
        newTextLevel++;
      }

      // Calculate new global level (average of text and voice levels)
      const voiceLevel = member.voiceLevel || 1;
      const newGlobalLevel = Math.floor((newTextLevel + voiceLevel) / 2);

      // Update member
      await storage.updateServerMember(guildId, userId, {
        textXp: newTextXp,
        textLevel: newTextLevel,
        messageCount: newMessageCount,
        globalLevel: newGlobalLevel,
      });

      // Check if they leveled up
      if (newTextLevel > (member.textLevel || 1)) {
        info(
          `🎉 [TEXT_LEVELUP] ${message.author.tag} reached Text Level ${newTextLevel} in ${message.guild.name}!`
        );

        // Send level up notification in a system channel if available
        const systemChannel = message.guild.systemChannel;
        if (systemChannel) {
          try {
            await systemChannel.send({
              content: `📝 Congratulations <@${userId}>! You've reached **Text Level ${newTextLevel}**! 🎉`,
            });
          } catch (err) {
            debug(`Could not send text level up message for ${message.author.tag}`);
          }
        }
      }

      info(
        `💬 [TEXT_XP_GAIN] ${message.author.tag} earned +${TEXT_XP_PER_MESSAGE} text XP | Messages: ${newMessageCount} | Total Text XP: ${newTextXp} | Level: ${newTextLevel}`
      );
    }
  } catch (err) {
    error(`❌ Error updating text XP for ${userId}:`, err);
  }
}
