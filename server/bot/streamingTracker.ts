import { Client, ActivityType } from 'discord.js';
import { storage } from '../storage';
import { info, debug, error } from '../utils/logger';
import { getOrCreateServerMember, updateMemberXP } from '../utils/memberFactory';
import { liveMonitor } from '../utils/liveMonitor';

// Track users currently streaming
const streamingSessions = new Map<string, number>();

// XP Configuration
const STREAM_XP_PER_MINUTE = 5; // XP earned per minute streaming (more than voice!)
const STREAM_CHECK_INTERVAL = 30000; // Check every 30 seconds
const XP_PER_LEVEL = 100; // XP needed per level

export function startStreamingTracker(client: Client) {
  debug('🎬 Starting streaming activity tracker...');

  // Check streaming status every 30 seconds
  setInterval(async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        const members = await guild.members.fetch();

        for (const member of members.values()) {
          if (!member.user.bot) {
            const isStreaming = member.presence?.activities.some(
              (activity) =>
                activity.type === ActivityType.Streaming ||
                (activity.type === ActivityType.Playing && activity.name === 'Screen Share')
            );

            const sessionKey = `${guild.id}-${member.id}`;
            const wasStreaming = streamingSessions.has(sessionKey);

            if (isStreaming && !wasStreaming) {
              // Started streaming
              streamingSessions.set(sessionKey, Date.now());
              info(`🎬 ${member.user.tag} started streaming in ${guild.name}`);
            } else if (!isStreaming && wasStreaming) {
              // Stopped streaming
              await awardStreamingXp(guild.id, member.id, sessionKey);
            }
          }
        }
      }
    } catch (err) {
      error('Error checking streaming status:', err);
    }
  }, STREAM_CHECK_INTERVAL);

  info('✅ Streaming tracker initialized');
}

async function awardStreamingXp(
  guildId: string,
  userId: string,
  sessionKey: string
) {
  try {
    const sessionStartTime = streamingSessions.get(sessionKey);

    if (!sessionStartTime) {
      return;
    }

    const timeStreaming = Math.floor((Date.now() - sessionStartTime) / 60000); // Minutes

    // Only award XP if they streamed for at least 1 minute
    if (timeStreaming < 1) {
      streamingSessions.delete(sessionKey);
      return;
    }

    // Get or create server member using factory
    const member = await getOrCreateServerMember(guildId, userId);

    if (member) {
      // Award streaming XP (counts as voice XP)
      const xpGain = timeStreaming * STREAM_XP_PER_MINUTE;
      const { member: updatedMember, leveledUp } = await updateMemberXP(guildId, userId, xpGain, 'stream', member);

      // Log to live monitor
      liveMonitor.logXPGain(
        guildId,
        userId,
        userId, // username - we don't have easy access to the actual username here
        xpGain,
        'stream',
        leveledUp ? (updatedMember.voiceLevel ?? undefined) : undefined
      );

      info(
        `🎬 ${userId} earned ${xpGain} streaming XP after ${timeStreaming}min stream in ${guildId}`
      );
    }

    streamingSessions.delete(sessionKey);
  } catch (err) {
    error('Error awarding streaming XP:', err);
  }
}

export function stopStreamingTracker() {
  debug('🎬 Stopping streaming tracker...');
  streamingSessions.clear();
}
