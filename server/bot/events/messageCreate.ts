import { Message } from 'discord.js';
import { storage } from '../../storage';
import { calculateLevel } from '../../utils/xp';
import { debug, error } from '../../utils/logger';

const TEXT_XP_MIN = 15;
const TEXT_XP_MAX = 25;
const COOLDOWN_MS = 60_000; // 60 seconds between XP gains per user per guild

// In-memory cooldown tracker: key = `${guildId}-${userId}`
const cooldowns = new Map<string, number>();

export async function messageCreateHandler(message: Message) {
  if (message.author.bot || !message.guild) return;

  const { guild, author } = message;
  const key = `${guild.id}-${author.id}`;
  const now = Date.now();

  if (now - (cooldowns.get(key) ?? 0) < COOLDOWN_MS) return;
  cooldowns.set(key, now);

  const xpGained = Math.floor(Math.random() * (TEXT_XP_MAX - TEXT_XP_MIN + 1)) + TEXT_XP_MIN;

  try {
    let member = await storage.getServerMember(guild.id, author.id);

    if (!member) {
      await storage.createServerMember({
        serverId: guild.id,
        userId: author.id,
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
      member = await storage.getServerMember(guild.id, author.id);
    }

    if (!member) return;

    const newTextXp = (member.textXp ?? 0) + xpGained;
    const newMessageCount = (member.messageCount ?? 0) + 1;
    const oldTextLevel = member.textLevel ?? 1;

    const { level: newTextLevel } = calculateLevel(newTextXp);
    const newGlobalLevel = Math.floor((newTextLevel + (member.voiceLevel ?? 1)) / 2);

    await storage.updateServerMember(guild.id, author.id, {
      textXp: newTextXp,
      textLevel: newTextLevel,
      messageCount: newMessageCount,
      globalLevel: newGlobalLevel,
    });

    debug(`[TextXP] +${xpGained} to ${author.tag} (total text XP: ${newTextXp}, level: ${newTextLevel})`);

    if (newTextLevel > oldTextLevel) {
      const systemChannel = guild.systemChannel;
      if (systemChannel) {
        await systemChannel.send({
          content: `📝 Congratulations ${author}! You've reached **Text Level ${newTextLevel}**! 🎉`,
        });
      }
    }
  } catch (err) {
    error(`Error awarding text XP to ${author.tag}:`, err);
  }
}
