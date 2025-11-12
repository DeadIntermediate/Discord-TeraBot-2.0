import { VoiceState, Client } from 'discord.js';
import { storage } from '../../storage';
import { info, debug, error } from '../../utils/logger';
import { getOrCreateServerMember, updateMemberXP } from '../../utils/memberFactory';
import { getSafeUserTag, getChannelName } from '../../utils/discordHelpers';
import { liveMonitor } from '../../utils/liveMonitor';

// Track users currently in voice channels
const voiceSessionStart = new Map<string, number>();

// XP Configuration
const VOICE_XP_PER_MINUTE = 2; // XP earned per minute in voice
const VOICE_XP_INTERVAL = 60000; // Check every 60 seconds
const XP_PER_LEVEL = 100; // XP needed per level

export async function voiceStateUpdateHandler(oldState: VoiceState, newState: VoiceState) {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const sessionKey = `${guildId}-${userId}`;

  // Debug log for all voice state changes
  info(`🔍 [DEBUG] Voice State Change Detected: User=${userId} | Old Channel=${oldState.channelId || 'null'} | New Channel=${newState.channelId || 'null'}`);

  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    // Don't count AFK channel
    if (newState.channel?.id === newState.guild.afkChannelId) {
      return;
    }
    
    // Start tracking session
    voiceSessionStart.set(sessionKey, Date.now());
    
    // Get user tag safely
    const userTag = await getSafeUserTag(newState.member, newState.guild, userId);
    const channelName = getChannelName(newState.channel);
    
    info(`🎤 [VOICE_JOIN] ${userTag} joined #${channelName} in ${newState.guild.name}`);
  }
  
  // User left a voice channel or switched channels
  if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
    const sessionStartTime = voiceSessionStart.get(sessionKey);
    
    if (sessionStartTime) {
      const timeInVoice = Math.floor((Date.now() - sessionStartTime) / 60000); // Minutes
      
      // Get user tag safely
      const userTag = await getSafeUserTag(newState.member, newState.guild, userId);
      const channelName = getChannelName(oldState.channel);
      
      // Only award XP if they were in voice for at least 1 minute
      if (timeInVoice >= 1) {
        try {
          // Get or create member using factory
          const member = await getOrCreateServerMember(guildId, userId);
          
          // Calculate and update XP using factory
          const xpGained = timeInVoice * VOICE_XP_PER_MINUTE;
          const { member: updatedMember, leveledUp } = await updateMemberXP(
            guildId,
            userId,
            xpGained,
            'voice',
            member
          );
          
          // Update voice time separately
          await storage.updateServerMember(guildId, userId, {
            voiceTime: (member.voiceTime || 0) + timeInVoice,
          });
          
          // Log to live monitor
          liveMonitor.logXPGain(
            guildId,
            userId,
            userTag,
            xpGained,
            'voice',
            leveledUp ? (updatedMember.voiceLevel ?? undefined) : undefined
          );
          
          // Check if they leveled up
          if (leveledUp) {
            info(`🎉 [VOICE_LEVELUP] ${userTag} reached Voice Level ${updatedMember.voiceLevel} in ${newState.guild.name}!`);
            
            // Send level up notification in system channel
            const systemChannel = newState.guild.systemChannel;
            if (systemChannel) {
              try {
                await systemChannel.send({
                  content: `🎤 Congratulations <@${userId}>! You've reached **Voice Level ${updatedMember.voiceLevel}**! 🎉`,
                });
              } catch (err) {
                debug(`Could not send level up message for ${userTag}`);
              }
            }
          }
          
          info(`💬 [VOICE_XP_GAIN] ${userTag} earned +${xpGained} voice XP | Time: ${timeInVoice}m | Total: ${updatedMember.voiceXp} | Level: ${updatedMember.voiceLevel}`);
        } catch (err) {
          error(`❌ Error updating voice XP for ${userId}:`, err);
        }
      }
      
      // Remove session tracking
      voiceSessionStart.delete(sessionKey);
      info(`🚪 [VOICE_LEAVE] ${userTag} left #${channelName} in ${newState.guild.name} | Duration: ${timeInVoice}m`);
    }
  }
  
  // User moved to AFK channel - pause tracking
  if (newState.channelId === newState.guild.afkChannelId && voiceSessionStart.has(sessionKey)) {
    const sessionStartTime = voiceSessionStart.get(sessionKey);
    if (sessionStartTime) {
      const timeInVoice = Math.floor((Date.now() - sessionStartTime) / 60000);
      
      // Award XP for time before going AFK
      if (timeInVoice >= 1) {
        try {
          const member = await getOrCreateServerMember(guildId, userId);
          const xpGained = timeInVoice * VOICE_XP_PER_MINUTE;
          
          await updateMemberXP(guildId, userId, xpGained, 'voice', member);
          await storage.updateServerMember(guildId, userId, {
            voiceTime: (member.voiceTime || 0) + timeInVoice,
          });
        } catch (err) {
          error(`❌ Error updating voice XP (AFK):`, err);
        }
      }
    }
    
    voiceSessionStart.delete(sessionKey);
  }
}

// Periodic check to award XP to active voice users (every minute)
export const startVoiceXpTracker = (client: Client) => {
  // Track last XP award time per session (for stable interval-based awards)
  const lastXpAwardTime = new Map<string, number>();
  
  const XP_AWARD_INTERVAL = 60000; // Award XP every 60 seconds
  
  const checkAndAwardXp = async () => {
    const now = Date.now();
    
    for (const [sessionKey, sessionStartTime] of voiceSessionStart.entries()) {
      try {
        const timeSinceLastAward = now - (lastXpAwardTime.get(sessionKey) || sessionStartTime);
        
        // Award XP every 60 seconds if user is actively in voice
        if (timeSinceLastAward >= XP_AWARD_INTERVAL) {
          const [guildId, userId] = sessionKey.split('-');
          if (!guildId || !userId) continue;
          
          // Get the member to verify they're still in voice
          const guild = client.guilds.cache.get(guildId);
          if (!guild) {
            voiceSessionStart.delete(sessionKey);
            lastXpAwardTime.delete(sessionKey);
            continue;
          }
          
          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member || !member.voice.channel) {
            // Member left or voice state invalid, clean up
            voiceSessionStart.delete(sessionKey);
            lastXpAwardTime.delete(sessionKey);
            continue;
          }
          
          // Award periodic XP
          try {
            let dbMember = await getOrCreateServerMember(guildId!, userId!);
            
            const xpGained = VOICE_XP_PER_MINUTE;
            const { member: updatedMember, leveledUp } = await updateMemberXP(
              guildId!,
              userId!,
              xpGained,
              'voice',
              dbMember
            );
            
            await storage.updateServerMember(guildId!, userId!, {
              voiceTime: (dbMember.voiceTime || 0) + 1,
            });
            
            // Log to live monitor
            liveMonitor.logXPGain(
              guildId!,
              userId!,
              member.user.username,
              xpGained,
              'voice',
              leveledUp ? (updatedMember.voiceLevel ?? undefined) : undefined
            );
            
            debug(`⏰ Periodic XP: ${member.user.tag} in ${guild.name} → +${xpGained} XP (${updatedMember.voiceTime}m total)`);
          } catch (err) {
            error(`❌ Error awarding periodic voice XP for ${userId}:`, err);
          }
          
          // Update last award time for this session
          lastXpAwardTime.set(sessionKey, now);
        }
      } catch (err) {
        const { error: logError } = await import('../../utils/logger');
        logError(`❌ Error in voice XP tracker loop for session ${sessionKey}:`, err);
      }
    }
  };
  
  // Run XP check every 10 seconds (will award every 60 seconds based on lastXpAwardTime)
  setInterval(checkAndAwardXp, 10000);
  
  info(`✅ Voice XP tracker started with ${XP_AWARD_INTERVAL}ms award interval`);
};