import { VoiceState } from 'discord.js';
import { storage } from '../../storage';
import { info, debug, error } from '../../utils/logger';

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

  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    // Don't count AFK channel or if user is muted/deafened
    if (newState.channel?.id === newState.guild.afkChannelId) {
      return;
    }
    
  // Start tracking session
  voiceSessionStart.set(sessionKey, Date.now());
  info(`🎤 ${newState.member?.user.tag} joined voice in ${newState.guild.name}`);
  }
  
  // User left a voice channel or switched channels
  if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
    const sessionStartTime = voiceSessionStart.get(sessionKey);
    
    if (sessionStartTime) {
      const timeInVoice = Math.floor((Date.now() - sessionStartTime) / 60000); // Minutes
      
      // Only award XP if they were in voice for at least 1 minute
      if (timeInVoice >= 1) {
        try {
          // Get or create server member
          let member = await storage.getServerMember(guildId, userId);
          
          if (!member) {
            // Create member if doesn't exist
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
              voiceTime: timeInVoice,
              messageCount: 0,
            });
            
            member = await storage.getServerMember(guildId, userId);
          }
          
          if (member) {
            // Calculate XP gained
            const xpGained = timeInVoice * VOICE_XP_PER_MINUTE;
            const newVoiceXp = (member.voiceXp || 0) + xpGained;
            const newVoiceTime = (member.voiceTime || 0) + timeInVoice;
            
            // Calculate new level
            let newVoiceLevel = member.voiceLevel || 1;
            let remainingXp = newVoiceXp;
            
            while (remainingXp >= XP_PER_LEVEL * newVoiceLevel) {
              remainingXp -= XP_PER_LEVEL * newVoiceLevel;
              newVoiceLevel++;
            }
            
            // Calculate new global level (average of text and voice levels)
            const textLevel = member.textLevel || 1;
            const newGlobalLevel = Math.floor((textLevel + newVoiceLevel) / 2);
            
            // Update member
            await storage.updateServerMember(guildId, userId, {
              voiceXp: newVoiceXp,
              voiceLevel: newVoiceLevel,
              voiceTime: newVoiceTime,
              globalLevel: newGlobalLevel,
            });
            
            // Check if they leveled up
            if (newVoiceLevel > (member.voiceLevel || 1)) {
              info(`🎉 ${newState.member?.user.tag} reached Voice Level ${newVoiceLevel} in ${newState.guild.name}!`);
              
              // Send level up notification in a system channel if available
              const systemChannel = newState.guild.systemChannel;
              if (systemChannel) {
                await systemChannel.send({
                  content: `🎤 Congratulations ${newState.member}! You've reached **Voice Level ${newVoiceLevel}**! 🎉`,
                });
              }
            }
            
            info(`✅ Awarded ${xpGained} voice XP to ${newState.member?.user.tag} (${timeInVoice} minutes in voice)`);
          }
        } catch (error) {
          const { error: logError } = await import('../../utils/logger');
          logError(`❌ Error updating voice XP for ${userId}:`, error);
        }
      }
      
      // Remove session tracking
      voiceSessionStart.delete(sessionKey);
      info(`🎤 ${newState.member?.user.tag} left voice in ${newState.guild.name} (${timeInVoice} min)`);
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
          const member = await storage.getServerMember(guildId, userId);
          if (member) {
            const xpGained = timeInVoice * VOICE_XP_PER_MINUTE;
            await storage.updateServerMember(guildId, userId, {
              voiceXp: (member.voiceXp || 0) + xpGained,
              voiceTime: (member.voiceTime || 0) + timeInVoice,
            });
          }
        } catch (error) {
          const { error: logError } = await import('../../utils/logger');
          logError(`❌ Error updating voice XP (AFK):`, error);
        }
      }
    }
    
    voiceSessionStart.delete(sessionKey);
  }
}

// Periodic check to award XP to active voice users (every minute)
export function startVoiceXpTracker(client: any) {
  setInterval(async () => {
    const now = Date.now();
    
  for (const [sessionKey, startTime] of Array.from(voiceSessionStart.entries())) {
      const [guildId, userId] = sessionKey.split('-');
      const timeInVoice = Math.floor((now - startTime) / 60000);
      
      // Award incremental XP every minute
      if (timeInVoice > 0 && timeInVoice % 1 === 0) {
        try {
          const member = await storage.getServerMember(guildId, userId);
          if (member) {
            const xpGained = VOICE_XP_PER_MINUTE;
            const newVoiceXp = (member.voiceXp || 0) + xpGained;
            const newVoiceTime = (member.voiceTime || 0) + 1;
            
            // Calculate new level
            let newVoiceLevel = member.voiceLevel || 1;
            let remainingXp = newVoiceXp;
            
            while (remainingXp >= XP_PER_LEVEL * newVoiceLevel) {
              remainingXp -= XP_PER_LEVEL * newVoiceLevel;
              newVoiceLevel++;
            }
            
            const textLevel = member.textLevel || 1;
            const newGlobalLevel = Math.floor((textLevel + newVoiceLevel) / 2);
            
            await storage.updateServerMember(guildId, userId, {
              voiceXp: newVoiceXp,
              voiceLevel: newVoiceLevel,
              voiceTime: newVoiceTime,
              globalLevel: newGlobalLevel,
            });
            
            // Reset session start to avoid double-counting
            voiceSessionStart.set(sessionKey, now);
          }
        } catch (error) {
          const { error: logError } = await import('../../utils/logger');
          logError(`❌ Error in periodic voice XP update:`, error);
        }
      }
    }
  }, VOICE_XP_INTERVAL);
  
  info('🎤 Voice XP tracker started');
}
