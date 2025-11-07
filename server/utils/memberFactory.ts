import { storage } from '../storage';
import { info, debug } from './logger';
import type { ServerMember, InsertServerMember } from '@shared/schema';

/**
 * Factory function to get or create a server member
 * Eliminates duplicate member creation logic across multiple event handlers
 */
export async function getOrCreateServerMember(
  guildId: string,
  userId: string,
  overrides?: Partial<InsertServerMember>
): Promise<ServerMember> {
  try {
    let member = await storage.getServerMember(guildId, userId);
    
    if (!member) {
      // Member doesn't exist, create it
      const newMember: InsertServerMember = {
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
        ...overrides,
      };
      
      await storage.createServerMember(newMember);
      member = await storage.getServerMember(guildId, userId);
      info(`📝 [MemberFactory] Created new server member: ${userId} in ${guildId}`);
    }
    
    return member!;
  } catch (err) {
    debug(`[MemberFactory] Error getting or creating member ${userId}:`, err);
    throw err;
  }
}

/**
 * Update member XP and handle level progression
 */
export async function updateMemberXP(
  guildId: string,
  userId: string,
  xpGain: number,
  xpType: 'voice' | 'text' | 'stream',
  currentMember: ServerMember
): Promise<{ member: ServerMember; leveledUp: boolean }> {
  const XP_PER_LEVEL = 100;
  
  try {
    if (xpType === 'voice' || xpType === 'stream') {
      // Both voice and stream XP go to the voice XP pool
      const newVoiceXp = (currentMember.voiceXp || 0) + xpGain;
      let newVoiceLevel = currentMember.voiceLevel || 1;
      let remainingXp = newVoiceXp;
      
      // Calculate new level
      while (remainingXp >= XP_PER_LEVEL * newVoiceLevel) {
        remainingXp -= XP_PER_LEVEL * newVoiceLevel;
        newVoiceLevel++;
      }
      
      const textLevel = currentMember.textLevel || 1;
      const newGlobalLevel = Math.floor((textLevel + newVoiceLevel) / 2);
      const leveledUp = newVoiceLevel > (currentMember.voiceLevel || 1);
      
      const updated = await storage.updateServerMember(guildId, userId, {
        voiceXp: newVoiceXp,
        voiceLevel: newVoiceLevel,
        globalLevel: newGlobalLevel,
      });
      
      return { member: updated!, leveledUp };
    } else {
      // text XP
      const newTextXp = (currentMember.textXp || 0) + xpGain;
      let newTextLevel = currentMember.textLevel || 1;
      let remainingXp = newTextXp;
      
      // Calculate new level
      while (remainingXp >= XP_PER_LEVEL * newTextLevel) {
        remainingXp -= XP_PER_LEVEL * newTextLevel;
        newTextLevel++;
      }
      
      const voiceLevel = currentMember.voiceLevel || 1;
      const newGlobalLevel = Math.floor((newTextLevel + voiceLevel) / 2);
      const leveledUp = newTextLevel > (currentMember.textLevel || 1);
      
      const updated = await storage.updateServerMember(guildId, userId, {
        textXp: newTextXp,
        textLevel: newTextLevel,
        globalLevel: newGlobalLevel,
      });
      
      return { member: updated!, leveledUp };
    }
  } catch (err) {
    debug(`[MemberFactory] Error updating XP for ${userId}:`, err);
    throw err;
  }
}
