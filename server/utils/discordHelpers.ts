import { Guild, GuildMember } from 'discord.js';
import { debug } from './logger';

/**
 * Safely fetch and format a user's tag for logging
 * Eliminates duplicate member fetch patterns
 */
export async function getSafeUserTag(
  member: GuildMember | null,
  guild: Guild,
  userId: string,
  defaultTag = 'Unknown User'
): Promise<string> {
  try {
    if (!member) {
      const fetched = await guild.members.fetch(userId);
      return fetched.user.tag;
    }
    return member.user.tag;
  } catch (err) {
    debug(`[DiscordHelpers] Could not fetch member ${userId}:`, err);
    return defaultTag;
  }
}

/**
 * Safely fetch a channel name
 */
export function getChannelName(channel: any): string {
  try {
    return channel?.name || 'Unknown Channel';
  } catch {
    return 'Unknown Channel';
  }
}

/**
 * Format a user mention safely
 */
export function formatUserMention(userId: string): string {
  try {
    return `<@${userId}>`;
  } catch {
    return `User ${userId}`;
  }
}

/**
 * Get readable time duration from milliseconds
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get readable time from minutes
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
