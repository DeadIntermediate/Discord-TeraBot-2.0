import { Guild, Role, Channel, CategoryChannel, TextChannel, VoiceChannel, ChannelType } from 'discord.js';
import { storage } from '../storage.js';
import { debug, error as logError, info } from './logger.js';

interface RoleBackup {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string[];
  position: number;
}

interface ChannelBackup {
  id: string;
  name: string;
  type: string;
  position: number;
  parentId?: string;
  isNSFW?: boolean;
  topic?: string;
  rateLimitPerUser?: number;
  permissionOverwrites?: Array<{
    id: string;
    type: string;
    allow: string[];
    deny: string[];
  }>;
}

interface BackupData {
  roles: RoleBackup[];
  channels: ChannelBackup[];
}

/**
 * Create a backup of guild roles and channels
 */
export async function createGuildBackup(
  guild: Guild,
  userId: string,
  backupName: string,
  description?: string
): Promise<string | null> {
  try {
    info(`📦 Starting guild backup for ${guild.name}...`);

    const backupData: BackupData = {
      roles: [],
      channels: []
    };

    // Backup roles
    try {
      const roles = await guild.roles.fetch();
      backupData.roles = roles
        .filter(role => role.id !== guild.id) // Exclude @everyone role
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          permissions: role.permissions.toArray().map(p => String(p)),
          position: role.position,
        }))
        .sort((a, b) => b.position - a.position);

      info(`✅ Backed up ${backupData.roles.length} roles`);
    } catch (err) {
      logError('Failed to backup roles:', err);
      backupData.roles = [];
    }

    // Backup channels with hierarchy
    try {
      const channels = await guild.channels.fetch();
      backupData.channels = channels
        .filter(channel => channel !== null)
        .map(channel => {
          const backup: ChannelBackup = {
            id: channel!.id,
            name: channel!.name,
            type: ChannelType[channel!.type] as string,
            position: channel!.position,
          };

          if (channel!.type === ChannelType.GuildCategory) {
            const catChannel = channel as CategoryChannel;
            backup.parentId = catChannel.parentId || undefined;
          } else if (channel!.type === ChannelType.GuildText) {
            const textChannel = channel as TextChannel;
            backup.parentId = textChannel.parentId || undefined;
            backup.topic = textChannel.topic || undefined;
            backup.isNSFW = textChannel.nsfw;
            backup.rateLimitPerUser = textChannel.rateLimitPerUser || 0;
          } else if (channel!.type === ChannelType.GuildVoice) {
            const voiceChannel = channel as VoiceChannel;
            backup.parentId = voiceChannel.parentId || undefined;
            backup.rateLimitPerUser = voiceChannel.rateLimitPerUser || 0;
          }

          // Backup permission overwrites
          try {
            backup.permissionOverwrites = Array.from(channel!.permissionOverwrites.cache.values()).map(overwrite => ({
              id: overwrite.id,
              type: overwrite.type.toString(),
              allow: Array.from(overwrite.allow.toArray()).map(p => String(p)),
              deny: Array.from(overwrite.deny.toArray()).map(p => String(p)),
            }));
          } catch (err) {
            debug(`Could not backup permissions for channel ${channel!.name}`);
            backup.permissionOverwrites = [];
          }

          return backup;
        })
        .sort((a, b) => a.position - b.position);

      info(`✅ Backed up ${backupData.channels.length} channels`);
    } catch (err) {
      logError('Failed to backup channels:', err);
      backupData.channels = [];
    }

    // Save to database
    const backup = await storage.createGuildBackup({
      serverId: guild.id,
      name: backupName,
      description,
      createdBy: userId,
      rolesData: backupData.roles,
      channelsData: backupData.channels,
      metadata: {
        guildName: guild.name,
        guildId: guild.id,
        memberCount: guild.memberCount,
        iconURL: guild.iconURL(),
        timestamp: new Date().toISOString(),
      },
    });

    info(`✅ Backup "${backupName}" created successfully (ID: ${backup.id})`);
    return backup.id;
  } catch (err) {
    logError('Failed to create guild backup:', err);
    return null;
  }
}

/**
 * Restore a guild backup
 */
export async function restoreGuildBackup(
  guild: Guild,
  backupId: string,
  userId: string,
  restoreRoles: boolean = true,
  restoreChannels: boolean = true
): Promise<{ success: boolean; restored: number; failed: number; errors: string[] }> {
  const result = { success: false, restored: 0, failed: 0, errors: [] as string[] };

  try {
    info(`📥 Starting restore of backup ${backupId}...`);

    // Get backup from database
    const backup = await storage.getGuildBackup(backupId);
    if (!backup) {
      result.errors.push('Backup not found');
      return result;
    }

    // Create restore history entry
    const historyId = await storage.createBackupRestoreHistory({
      serverId: guild.id,
      backupId,
      restoredBy: userId,
      status: 'in-progress',
    });

    try {
      const rolesData = backup.rolesData as RoleBackup[];
      const channelsData = backup.channelsData as ChannelBackup[];

      // Restore roles
      if (restoreRoles) {
        info(`🔄 Restoring ${rolesData.length} roles...`);
        for (const roleBackup of rolesData) {
          try {
            const existingRole = guild.roles.cache.find(r => r.name === roleBackup.name);
            
            if (existingRole) {
              // Update existing role
              await existingRole.edit({
                color: roleBackup.color,
                hoist: roleBackup.hoist,
                mentionable: roleBackup.mentionable,
              });
              debug(`✅ Updated role: ${roleBackup.name}`);
            } else {
              // Create new role
              await guild.roles.create({
                name: roleBackup.name,
                color: roleBackup.color,
                hoist: roleBackup.hoist,
                mentionable: roleBackup.mentionable,
                permissions: roleBackup.permissions.map(p => BigInt(p)),
              });
              debug(`✅ Created role: ${roleBackup.name}`);
            }
            result.restored++;
          } catch (err) {
            result.failed++;
            const errMsg = `Failed to restore role ${roleBackup.name}: ${err}`;
            result.errors.push(errMsg);
            logError(errMsg, err);
          }
        }
      }

      // Restore channels
      if (restoreChannels) {
        info(`🔄 Restoring ${channelsData.length} channels...`);
        for (const channelBackup of channelsData) {
          try {
            // Skip if channel already exists
            const existingChannel = guild.channels.cache.find(c => c.name === channelBackup.name);
            if (existingChannel) {
              debug(`Channel ${channelBackup.name} already exists, skipping`);
              continue;
            }

            let newChannel;
            if (channelBackup.type === ChannelType.GuildCategory.toString()) {
              newChannel = await guild.channels.create({
                name: channelBackup.name,
                type: ChannelType.GuildCategory,
              });
            } else if (channelBackup.type === ChannelType.GuildText.toString()) {
              newChannel = await guild.channels.create({
                name: channelBackup.name,
                type: ChannelType.GuildText,
                parent: channelBackup.parentId || undefined,
                topic: channelBackup.topic,
                nsfw: channelBackup.isNSFW || false,
                rateLimitPerUser: channelBackup.rateLimitPerUser || 0,
              });
            } else if (channelBackup.type === ChannelType.GuildVoice.toString()) {
              newChannel = await guild.channels.create({
                name: channelBackup.name,
                type: ChannelType.GuildVoice,
                parent: channelBackup.parentId || undefined,
              });
            }

            if (newChannel && channelBackup.permissionOverwrites && channelBackup.permissionOverwrites.length > 0) {
              for (const overwrite of channelBackup.permissionOverwrites) {
                try {
                  // Convert string permission flags back to object format
                  const permissions: Record<string, boolean | null> = {};
                  
                  // Convert allow strings to permission flags
                  for (const perm of overwrite.allow) {
                    permissions[perm] = true;
                  }
                  
                  // Convert deny strings to permission flags
                  for (const perm of overwrite.deny) {
                    permissions[perm] = false;
                  }
                  
                  await newChannel.permissionOverwrites.create(overwrite.id, permissions as any);
                } catch (err) {
                  debug(`Could not restore permissions for ${channelBackup.name}: ${err}`);
                }
              }
            }

            debug(`✅ Created channel: ${channelBackup.name}`);
            result.restored++;
          } catch (err) {
            result.failed++;
            const errMsg = `Failed to restore channel ${channelBackup.name}: ${err}`;
            result.errors.push(errMsg);
            logError(errMsg, err);
          }
        }
      }

      // Update restore history
      await storage.updateBackupRestoreHistory(historyId, {
        status: 'completed',
        itemsRestored: result.restored,
        itemsFailed: result.failed,
        errorDetails: result.errors.length > 0 ? { errors: result.errors } : undefined,
        completedAt: new Date(),
      });

      result.success = true;
      info(`✅ Restore completed: ${result.restored} restored, ${result.failed} failed`);
    } catch (err) {
      // Update history with failure
      await storage.updateBackupRestoreHistory(historyId, {
        status: 'failed',
        errorDetails: { error: String(err) },
        completedAt: new Date(),
      });
      throw err;
    }
  } catch (err) {
    logError('Failed to restore guild backup:', err);
  }

  return result;
}
