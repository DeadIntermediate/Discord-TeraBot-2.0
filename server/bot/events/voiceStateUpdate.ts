import { VoiceState, Client } from 'discord.js';
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

  // Debug log for all voice state changes
  info(`🔍 [DEBUG] Voice State Change Detected: User=${userId} | Old Channel=${oldState.channelId || 'null'} | New Channel=${newState.channelId || 'null'}`);

  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    // Don't count AFK channel or if user is muted/deafened
    if (newState.channel?.id === newState.guild.afkChannelId) {
      return;
    }
    
    // Start tracking session
    voiceSessionStart.set(sessionKey, Date.now());
    
    // Fetch member for proper logging
    let userTag = 'Unknown User';
    let channelName = 'Unknown Channel';
    try {
      if (!newState.member) {
        const member = await newState.guild.members.fetch(userId);
        userTag = member.user.tag;
      } else {
        userTag = newState.member.user.tag;
      }
    } catch (err) {
      debug(`Could not fetch member ${userId} for logging`);
    }
    
    if (newState.channel) {
      channelName = newState.channel.name;
    }
    
    info(`🎤 [VOICE_JOIN] ${userTag} joined #${channelName} in ${newState.guild.name}`);
  }
  
  // User left a voice channel or switched channels
  if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
    const sessionStartTime = voiceSessionStart.get(sessionKey);
    
    if (sessionStartTime) {
      const timeInVoice = Math.floor((Date.now() - sessionStartTime) / 60000); // Minutes
      
      // Fetch member for logging
      let userTag = 'Unknown User';
      let channelName = 'Unknown Channel';
      try {
        if (!newState.member) {
          const member = await newState.guild.members.fetch(userId);
          userTag = member.user.tag;
        } else {
          userTag = newState.member.user.tag;
        }
      } catch (err) {
        debug(`Could not fetch member ${userId} for logging`);
      }
      
      if (oldState.channel) {
        channelName = oldState.channel.name;
      }
      
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
            info(`📝 Created new server member record for ${userTag}`);
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
              info(`🎉 [VOICE_LEVELUP] ${userTag} reached Voice Level ${newVoiceLevel} in ${newState.guild.name}!`);
              
              // Send level up notification in a system channel if available
              const systemChannel = newState.guild.systemChannel;
              if (systemChannel) {
                try {
                  await systemChannel.send({
                    content: `🎤 Congratulations <@${userId}>! You've reached **Voice Level ${newVoiceLevel}**! 🎉`,
                  });
                } catch (err) {
                  debug(`Could not send level up message for ${userTag}`);
                }
              }
            }
            
            info(`💬 [VOICE_XP_GAIN] ${userTag} earned +${xpGained} voice XP | Time: ${timeInVoice}m | Total Voice XP: ${newVoiceXp} | Level: ${newVoiceLevel}`);
          }
        } catch (err) {
          const { error: logError } = await import('../../utils/logger');
          logError(`❌ Error updating voice XP for ${userId}:`, err);
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
            let dbMember = await storage.getServerMember(guildId, userId);
            
            if (!dbMember) {
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
                voiceTime: 1,
                messageCount: 0,
              });
              dbMember = await storage.getServerMember(guildId, userId);
            }
            
            if (dbMember) {
              const xpGained = VOICE_XP_PER_MINUTE; // 1 minute worth of XP per 60-second interval
              const newVoiceXp = (dbMember.voiceXp || 0) + xpGained;
              const newVoiceTime = (dbMember.voiceTime || 0) + 1; // +1 minute
              
              // Calculate new level
              let newVoiceLevel = dbMember.voiceLevel || 1;
              let remainingXp = newVoiceXp;
              
              while (remainingXp >= XP_PER_LEVEL * newVoiceLevel) {
                remainingXp -= XP_PER_LEVEL * newVoiceLevel;
                newVoiceLevel++;
              }
              
              // Calculate new global level
              const textLevel = dbMember.textLevel || 1;
              const newGlobalLevel = Math.floor((textLevel + newVoiceLevel) / 2);
              
              await storage.updateServerMember(guildId, userId, {
                voiceXp: newVoiceXp,
                voiceLevel: newVoiceLevel,
                voiceTime: newVoiceTime,
                globalLevel: newGlobalLevel,
              });
              
              debug(`⏰ Periodic XP: ${member.user.tag} in ${guild.name} → +${xpGained} XP (${newVoiceTime}m total)`);
            }
          } catch (err) {
            const { error: logError } = await import('../../utils/logger');
            logError(`❌ Error awarding periodic voice XP for ${userId}:`, err);
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