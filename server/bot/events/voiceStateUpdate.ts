import { VoiceState } from 'discord.js';
import { storage } from '../../storage';
import { calculateLevel } from '../../utils/xp';
import { info, debug, error } from '../../utils/logger';
import { handleTTSVoiceStateUpdate } from '../commands/tts';
import { assignLevelRoles } from './messageCreate';
import { db } from '../../db';
import { discordServers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import type { ServerSettings } from '../commands/config';

// Track voice session start times: key = `${guildId}-${userId}`
const voiceSessionStart = new Map<string, number>();

const VOICE_XP_PER_MINUTE = 2;
const VOICE_XP_INTERVAL_MS = 60_000;

export async function voiceStateUpdateHandler(oldState: VoiceState, newState: VoiceState) {
  handleTTSVoiceStateUpdate(oldState, newState);

  const userId = newState.id;
  const guildId = newState.guild.id;
  const sessionKey = `${guildId}-${userId}`;

  // Joined a non-AFK voice channel
  if (!oldState.channelId && newState.channelId) {
    if (newState.channelId === newState.guild.afkChannelId) return;
    voiceSessionStart.set(sessionKey, Date.now());
    info(`🎤 ${newState.member?.user.tag} joined voice in ${newState.guild.name}`);
    return;
  }

  // Left voice entirely or switched channels
  if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
    const sessionStartTime = voiceSessionStart.get(sessionKey);
    if (!sessionStartTime) return;

    voiceSessionStart.delete(sessionKey);
    const minutesInVoice = Math.floor((Date.now() - sessionStartTime) / 60_000);
    info(`🎤 ${newState.member?.user.tag} left voice in ${newState.guild.name} (${minutesInVoice} min)`);

    if (minutesInVoice >= 1) {
      await awardVoiceXP(guildId, userId, minutesInVoice, newState);
    }

    // Moved to a different channel (not left) — restart session if it's not AFK
    if (newState.channelId && newState.channelId !== newState.guild.afkChannelId) {
      voiceSessionStart.set(sessionKey, Date.now());
    }
  }
}

// Periodic tick: awards 1 minute of XP to everyone currently in voice
export function startVoiceXpTracker(client: any) {
  setInterval(async () => {
    const now = Date.now();

    for (const [sessionKey, startTime] of Array.from(voiceSessionStart.entries())) {
      const minutesElapsed = Math.floor((now - startTime) / 60_000);
      if (minutesElapsed < 1) continue;

      const [guildId, userId] = sessionKey.split('-');

      // Reset session start so next tick starts fresh
      voiceSessionStart.set(sessionKey, now);

      await awardVoiceXP(guildId, userId, minutesElapsed, null);
    }
  }, VOICE_XP_INTERVAL_MS);

  info('🎤 Voice XP tracker started');
}

async function awardVoiceXP(
  guildId: string,
  userId: string,
  minutes: number,
  voiceState: VoiceState | null,
) {
  try {
    let member = await storage.getServerMember(guildId, userId);

    if (!member) {
      await storage.createServerMember({
        serverId: guildId,
        userId,
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
    }

    if (!member) return;

    const xpGained = minutes * VOICE_XP_PER_MINUTE;
    const newVoiceXp = (member.voiceXp ?? 0) + xpGained;
    const newVoiceTime = (member.voiceTime ?? 0) + minutes;
    const oldVoiceLevel = member.voiceLevel ?? 1;

    const { level: newVoiceLevel } = calculateLevel(newVoiceXp);
    const newGlobalLevel = Math.floor((newVoiceLevel + (member.textLevel ?? 1)) / 2);

    await storage.updateServerMember(guildId, userId, {
      voiceXp: newVoiceXp,
      voiceLevel: newVoiceLevel,
      voiceTime: newVoiceTime,
      globalLevel: newGlobalLevel,
    });

    debug(`[VoiceXP] +${xpGained} XP to ${userId} (${minutes} min, total: ${newVoiceXp})`);

    if (newVoiceLevel > oldVoiceLevel && voiceState) {
      info(`🎉 ${voiceState.member?.user.tag} reached Voice Level ${newVoiceLevel} in ${voiceState.guild.name}!`);

      // Load settings for announcement channel + level-up roles
      const [server] = await db.select().from(discordServers).where(eq(discordServers.id, guildId)).limit(1);
      const settings = (server?.settings as ServerSettings) ?? {};

      const announceChannelId = settings.levelUpChannelId;
      const ch = announceChannelId
        ? voiceState.guild.channels.cache.get(announceChannelId)
        : voiceState.guild.systemChannel;
      if (ch && 'send' in ch) {
        await (ch as any).send({
          content: `🎤 Congratulations ${voiceState.member}! You've reached **Voice Level ${newVoiceLevel}**! 🎉`,
        });
      }

      await assignLevelRoles(voiceState.guild, userId, newVoiceLevel, 'voice', settings);

      // Check global level-up too (voice level changed, global may have changed)
      const newGlobalLevel = Math.floor((newVoiceLevel + (member.textLevel ?? 1)) / 2);
      const oldGlobalLevel = Math.floor((oldVoiceLevel + (member.textLevel ?? 1)) / 2);
      if (newGlobalLevel > oldGlobalLevel) {
        await assignLevelRoles(voiceState.guild, userId, newGlobalLevel, 'global', settings);
      }
    }
  } catch (err) {
    error(`Error awarding voice XP to ${userId}:`, err);
  }
}
