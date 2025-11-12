import { Message } from 'discord.js';
import { storage } from '../../storage';
import { info, debug, error } from '../../utils/logger';
import { getOrCreateServerMember, updateMemberXP } from '../../utils/memberFactory';
import { getSafeUserTag } from '../../utils/discordHelpers';
import { liveMonitor } from '../../utils/liveMonitor';

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
    const member = await getOrCreateServerMember(guildId, userId);

    if (member) {
      // Update cooldown
      userCooldowns.set(cooldownKey, now);

      // Calculate new text XP and message count
      const newTextXp = (member.textXp || 0) + TEXT_XP_PER_MESSAGE;
      const newMessageCount = (member.messageCount || 0) + 1;

      // Update XP and handle leveling
      const { member: updatedMember, leveledUp } = await updateMemberXP(
        guildId,
        userId,
        TEXT_XP_PER_MESSAGE,
        'text',
        member
      );

      // Update message count
      await storage.updateServerMember(guildId, userId, {
        messageCount: newMessageCount,
      });

      // Log to live monitor
      liveMonitor.logXPGain(
        guildId,
        userId,
        message.author.username,
        TEXT_XP_PER_MESSAGE,
        'text',
        leveledUp ? (updatedMember.textLevel ?? undefined) : undefined
      );

      // Check if they leveled up
      if (leveledUp) {
        info(
          `🎉 [TEXT_LEVELUP] ${message.author.tag} reached Text Level ${updatedMember.textLevel} in ${message.guild.name}!`
        );

        // Send level up notification in system channel
        const systemChannel = message.guild?.systemChannel;
        if (systemChannel) {
          try {
            await systemChannel.send({
              content: `📝 Congratulations <@${userId}>! You've reached **Text Level ${updatedMember.textLevel}**! 🎉`,
            });
          } catch (err) {
            debug(`Could not send text level up message for ${message.author.tag}`);
          }
        }
      }

      info(
        `💬 [TEXT_XP_GAIN] ${message.author.tag} earned +${TEXT_XP_PER_MESSAGE} text XP | Messages: ${newMessageCount} | Total: ${newTextXp} | Level: ${updatedMember.textLevel}`
      );
    }
  } catch (err) {
    error(`❌ Error updating text XP for ${userId}:`, err);
  }
}
