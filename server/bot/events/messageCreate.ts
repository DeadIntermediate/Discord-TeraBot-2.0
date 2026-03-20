import { Message, TextChannel, Guild } from 'discord.js';
import { storage } from '../../storage';
import { calculateLevel } from '../../utils/xp';
import { debug, error, info } from '../../utils/logger';
import { db } from '../../db';
import { discordServers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import type { ServerSettings } from '../commands/config';

const TEXT_XP_MIN = 15;
const TEXT_XP_MAX = 25;
const COOLDOWN_MS = 60_000; // 60 seconds between XP gains per user per guild

// In-memory cooldown tracker: key = `${guildId}-${userId}`
const cooldowns = new Map<string, number>();

// ── Spam detection tracker: timestamps of recent messages per user ────────────
// key = `${guildId}-${userId}`, value = array of timestamps
const spamTracker = new Map<string, number[]>();
const SPAM_MSG_LIMIT = 5;
const SPAM_WINDOW_MS = 5_000;

const INVITE_PATTERN = /discord(?:\.gg|\.com\/invite|app\.com\/invite)\/[\w-]+/i;

// ── Automod ───────────────────────────────────────────────────────────────────

async function runAutomod(message: Message, settings: ServerSettings): Promise<boolean> {
  const automod = settings.automod;
  if (!automod) return false;

  const { guild, author, content } = message;
  const key = `${guild!.id}-${author.id}`;

  // Spam detection
  if (automod.spamEnabled) {
    const now = Date.now();
    const timestamps = (spamTracker.get(key) ?? []).filter(t => now - t < SPAM_WINDOW_MS);
    timestamps.push(now);
    spamTracker.set(key, timestamps);

    if (timestamps.length >= SPAM_MSG_LIMIT) {
      spamTracker.delete(key);
      try {
        await message.delete();
        await message.channel.send({ content: `${author} please slow down! *(spam detected)*` })
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5_000));
      } catch { /* message may already be gone */ }
      return true;
    }
  }

  // Invite filter
  if (automod.inviteEnabled && INVITE_PATTERN.test(content)) {
    try {
      await message.delete();
      await message.channel.send({ content: `${author} Discord invite links are not allowed here.` })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5_000));
    } catch { /* ignore */ }
    return true;
  }

  // Word filter
  if (automod.wordFilterEnabled && automod.bannedWords?.length) {
    const lower = content.toLowerCase();
    const hit = automod.bannedWords.find(w => lower.includes(w));
    if (hit) {
      try {
        await message.delete();
        await message.channel.send({ content: `${author} that word is not allowed here.` })
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5_000));
      } catch { /* ignore */ }
      return true;
    }
  }

  return false;
}

// ── Level-up role assignment ──────────────────────────────────────────────────

export async function assignLevelRoles(
  guild: Guild,
  userId: string,
  newLevel: number,
  levelType: 'text' | 'voice' | 'global',
  settings: ServerSettings,
): Promise<void> {
  if (!settings.levelRolesEnabled) return;

  const levelRole = await storage.getLevelRole(guild.id, newLevel, levelType);
  if (!levelRole) return;

  try {
    const member = await guild.members.fetch(userId);
    if (!member || member.roles.cache.has(levelRole.roleId)) return;
    await member.roles.add(levelRole.roleId, `Reached ${levelType} level ${newLevel}`);
    info(`[LevelRoles] Assigned role ${levelRole.roleId} to ${userId} for ${levelType} level ${newLevel}`);
  } catch (err) {
    error(`[LevelRoles] Failed to assign role for ${levelType} level ${newLevel}:`, err);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function messageCreateHandler(message: Message) {
  if (message.author.bot || !message.guild) return;

  const { guild, author } = message;

  // Load server settings once (used by both automod and XP)
  const [server] = await db.select().from(discordServers).where(eq(discordServers.id, guild.id)).limit(1);
  const settings = (server?.settings as ServerSettings) ?? {};

  // Run automod first — if it deleted the message, still award XP (don't punish XP for deleted msgs)
  await runAutomod(message, settings).catch(err => error('Automod error:', err));

  // XP cooldown
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
        xp: 0, level: 1, textXp: 0, textLevel: 1,
        voiceXp: 0, voiceLevel: 1, globalLevel: 1,
        voiceTime: 0, messageCount: 0,
      });
      member = await storage.getServerMember(guild.id, author.id);
    }

    if (!member) return;

    const newTextXp      = (member.textXp ?? 0) + xpGained;
    const newMessageCount = (member.messageCount ?? 0) + 1;
    const oldTextLevel   = member.textLevel ?? 1;
    const oldGlobalLevel = member.globalLevel ?? 1;

    const { level: newTextLevel } = calculateLevel(newTextXp);
    const newGlobalLevel = Math.floor((newTextLevel + (member.voiceLevel ?? 1)) / 2);

    await storage.updateServerMember(guild.id, author.id, {
      textXp: newTextXp,
      textLevel: newTextLevel,
      messageCount: newMessageCount,
      globalLevel: newGlobalLevel,
    });

    debug(`[TextXP] +${xpGained} to ${author.tag} (total text XP: ${newTextXp}, level: ${newTextLevel})`);

    // Text level-up
    if (newTextLevel > oldTextLevel) {
      const announceChannelId = settings.levelUpChannelId;
      const ch = announceChannelId
        ? guild.channels.cache.get(announceChannelId) as TextChannel | undefined
        : guild.systemChannel ?? undefined;
      if (ch) {
        await ch.send({ content: `📝 Congratulations ${author}! You've reached **Text Level ${newTextLevel}**! 🎉` });
      }
      await assignLevelRoles(guild, author.id, newTextLevel, 'text', settings);
    }

    // Global level-up
    if (newGlobalLevel > oldGlobalLevel) {
      await assignLevelRoles(guild, author.id, newGlobalLevel, 'global', settings);
    }

  } catch (err) {
    error(`Error awarding text XP to ${author.tag}:`, err);
  }
}
