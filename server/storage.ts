import {
  users, discordServers, discordUsers, serverMembers,
  moderationLogs, tickets, giveaways, roleReactions, savedEmbeds, levelRoles,
  type User, type InsertUser, type DiscordServer, type InsertDiscordServer,
  type DiscordUser, type InsertDiscordUser, type ServerMember, type InsertServerMember,
  type ModerationLog, type InsertModerationLog, type Ticket, type InsertTicket,
  type Giveaway, type InsertGiveaway, type RoleReaction, type InsertRoleReaction,
  type LevelRole, type InsertLevelRole,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, asc, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Discord Server methods
  getDiscordServer(id: string): Promise<DiscordServer | undefined>;
  createDiscordServer(server: InsertDiscordServer): Promise<DiscordServer>;
  updateDiscordServer(id: string, updates: Partial<DiscordServer>): Promise<DiscordServer | undefined>;
  getServersByOwner(ownerId: string): Promise<DiscordServer[]>;

  // Discord User methods
  getDiscordUser(id: string): Promise<DiscordUser | undefined>;
  createDiscordUser(user: InsertDiscordUser): Promise<DiscordUser>;
  updateDiscordUser(id: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined>;

  // Server Member methods
  getServerMember(serverId: string, userId: string): Promise<ServerMember | undefined>;
  createServerMember(member: InsertServerMember): Promise<ServerMember>;
  updateServerMember(serverId: string, userId: string, updates: Partial<ServerMember>): Promise<ServerMember | undefined>;
  getServerMembers(serverId: string): Promise<ServerMember[]>;
  getTopMembersByXP(serverId: string, limit?: number, type?: 'total' | 'text' | 'voice'): Promise<ServerMember[]>;

  // Moderation methods
  createModerationLog(log: InsertModerationLog): Promise<ModerationLog>;
  getModerationLogs(serverId: string, limit?: number): Promise<ModerationLog[]>;
  getUserModerationHistory(userId: string, serverId?: string): Promise<ModerationLog[]>;
  getUserWarnings(userId: string, serverId: string): Promise<ModerationLog[]>;
  deleteModerationLog(id: string, serverId: string): Promise<boolean>;

  // Level role methods
  getLevelRoles(serverId: string): Promise<LevelRole[]>;
  getLevelRole(serverId: string, level: number, levelType: string): Promise<LevelRole | undefined>;
  upsertLevelRole(data: InsertLevelRole): Promise<LevelRole>;
  deleteLevelRole(serverId: string, level: number, levelType: string): Promise<boolean>;

  // Ticket methods
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket | undefined>;
  updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | undefined>;
  getServerTickets(serverId: string, status?: string): Promise<Ticket[]>;

  // Giveaway methods
  createGiveaway(giveaway: InsertGiveaway): Promise<Giveaway>;
  getGiveaway(id: string): Promise<Giveaway | undefined>;
  updateGiveaway(id: string, updates: Partial<Giveaway>): Promise<Giveaway | undefined>;
  getActiveGiveaways(serverId?: string): Promise<Giveaway[]>;
  getEndedGiveaways(serverId?: string): Promise<Giveaway[]>;
  getExpiredGiveaways(): Promise<Giveaway[]>;
  // Atomically adds userId to entries; returns null if already entered or giveaway inactive
  enterGiveaway(giveawayId: string, userId: string): Promise<Giveaway | null>;

  // Role Reaction methods
  createRoleReaction(roleReaction: InsertRoleReaction): Promise<RoleReaction>;
  getRoleReaction(messageId: string, emoji: string): Promise<RoleReaction | undefined>;
  getMessageRoleReactions(messageId: string): Promise<RoleReaction[]>;
  deleteRoleReaction(id: string): Promise<boolean>;
  // Embed templates
  createSavedEmbed(embed: { serverId: string; name: string; embedData: any; createdBy: string; }): Promise<any>;
  // Jail recovery
  getActiveFutureJails(): Promise<ModerationLog[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Discord Server methods
  async getDiscordServer(id: string): Promise<DiscordServer | undefined> {
    const [server] = await db.select().from(discordServers).where(eq(discordServers.id, id));
    return server || undefined;
  }

  async createDiscordServer(server: InsertDiscordServer): Promise<DiscordServer> {
    const [created] = await db.insert(discordServers).values(server).returning();
    return created;
  }

  async updateDiscordServer(id: string, updates: Partial<DiscordServer>): Promise<DiscordServer | undefined> {
    const [updated] = await db.update(discordServers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(discordServers.id, id))
      .returning();
    return updated || undefined;
  }

  async getServersByOwner(ownerId: string): Promise<DiscordServer[]> {
    return await db.select().from(discordServers).where(eq(discordServers.ownerId, ownerId));
  }

  // Discord User methods
  async getDiscordUser(id: string): Promise<DiscordUser | undefined> {
    const [user] = await db.select().from(discordUsers).where(eq(discordUsers.id, id));
    return user || undefined;
  }

  async createDiscordUser(user: InsertDiscordUser): Promise<DiscordUser> {
    const [created] = await db.insert(discordUsers).values(user).returning();
    return created;
  }

  async updateDiscordUser(id: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined> {
    const [updated] = await db.update(discordUsers)
      .set(updates)
      .where(eq(discordUsers.id, id))
      .returning();
    return updated || undefined;
  }

  // Server Member methods
  async getServerMember(serverId: string, userId: string): Promise<ServerMember | undefined> {
    const [member] = await db.select().from(serverMembers)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId)));
    return member || undefined;
  }

  async createServerMember(member: InsertServerMember): Promise<ServerMember> {
    const [created] = await db.insert(serverMembers).values(member).returning();
    return created;
  }

  async updateServerMember(serverId: string, userId: string, updates: Partial<ServerMember>): Promise<ServerMember | undefined> {
    const [updated] = await db.update(serverMembers)
      .set(updates)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async getServerMembers(serverId: string): Promise<ServerMember[]> {
    return await db.select().from(serverMembers).where(eq(serverMembers.serverId, serverId));
  }

  async getTopMembersByXP(serverId: string, limit: number = 10, type: 'total' | 'text' | 'voice' = 'total'): Promise<ServerMember[]> {
    const orderExpr = type === 'text'
      ? desc(serverMembers.textXp)
      : type === 'voice'
        ? desc(serverMembers.voiceXp)
        : desc(sql<number>`coalesce(${serverMembers.textXp}, 0) + coalesce(${serverMembers.voiceXp}, 0)`);

    return await db.select().from(serverMembers)
      .where(eq(serverMembers.serverId, serverId))
      .orderBy(orderExpr)
      .limit(limit);
  }

  // Moderation methods
  async createModerationLog(log: InsertModerationLog): Promise<ModerationLog> {
    const [created] = await db.insert(moderationLogs).values(log).returning();
    return created;
  }

  async getModerationLogs(serverId: string, limit: number = 50): Promise<ModerationLog[]> {
    return await db.select().from(moderationLogs)
      .where(eq(moderationLogs.serverId, serverId))
      .orderBy(desc(moderationLogs.createdAt))
      .limit(limit);
  }

  async getUserModerationHistory(userId: string, serverId?: string): Promise<ModerationLog[]> {
    const conditions = [eq(moderationLogs.targetUserId, userId)];
    if (serverId) conditions.push(eq(moderationLogs.serverId, serverId));
    return await db.select().from(moderationLogs)
      .where(and(...conditions))
      .orderBy(desc(moderationLogs.createdAt));
  }

  async getUserWarnings(userId: string, serverId: string): Promise<ModerationLog[]> {
    return await db.select().from(moderationLogs)
      .where(and(
        eq(moderationLogs.targetUserId, userId),
        eq(moderationLogs.serverId, serverId),
        eq(moderationLogs.action, 'warn'),
      ))
      .orderBy(asc(moderationLogs.createdAt));
  }

  async deleteModerationLog(id: string, serverId: string): Promise<boolean> {
    const [deleted] = await db.delete(moderationLogs)
      .where(and(eq(moderationLogs.id, id), eq(moderationLogs.serverId, serverId)))
      .returning();
    return !!deleted;
  }

  // Level role methods
  async getLevelRoles(serverId: string): Promise<LevelRole[]> {
    return await db.select().from(levelRoles)
      .where(eq(levelRoles.serverId, serverId))
      .orderBy(levelRoles.levelType, levelRoles.level);
  }

  async getLevelRole(serverId: string, level: number, levelType: string): Promise<LevelRole | undefined> {
    const [row] = await db.select().from(levelRoles)
      .where(and(
        eq(levelRoles.serverId, serverId),
        eq(levelRoles.level, level),
        eq(levelRoles.levelType, levelType),
      ));
    return row;
  }

  async upsertLevelRole(data: InsertLevelRole): Promise<LevelRole> {
    const [row] = await db.insert(levelRoles).values(data)
      .onConflictDoUpdate({
        target: [levelRoles.serverId, levelRoles.level, levelRoles.levelType],
        set: { roleId: data.roleId },
      })
      .returning();
    return row;
  }

  async deleteLevelRole(serverId: string, level: number, levelType: string): Promise<boolean> {
    const [deleted] = await db.delete(levelRoles)
      .where(and(
        eq(levelRoles.serverId, serverId),
        eq(levelRoles.level, level),
        eq(levelRoles.levelType, levelType),
      ))
      .returning();
    return !!deleted;
  }

  // Ticket methods
  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [created] = await db.insert(tickets).values(ticket).returning();
    return created;
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket || undefined;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | undefined> {
    const [updated] = await db.update(tickets)
      .set(updates)
      .where(eq(tickets.id, id))
      .returning();
    return updated || undefined;
  }

  async getServerTickets(serverId: string, status?: string): Promise<Ticket[]> {
    const conditions = [eq(tickets.serverId, serverId)];
    if (status) conditions.push(eq(tickets.status, status));
    return await db.select().from(tickets)
      .where(and(...conditions))
      .orderBy(desc(tickets.createdAt));
  }

  // Giveaway methods
  async createGiveaway(giveaway: InsertGiveaway): Promise<Giveaway> {
    const [created] = await db.insert(giveaways).values(giveaway).returning();
    return created;
  }

  async getGiveaway(id: string): Promise<Giveaway | undefined> {
    const [giveaway] = await db.select().from(giveaways).where(eq(giveaways.id, id));
    return giveaway || undefined;
  }

  async updateGiveaway(id: string, updates: Partial<Giveaway>): Promise<Giveaway | undefined> {
    const [updated] = await db.update(giveaways)
      .set(updates)
      .where(eq(giveaways.id, id))
      .returning();
    return updated || undefined;
  }

  async getActiveGiveaways(serverId?: string): Promise<Giveaway[]> {
    const conditions = [eq(giveaways.isActive, true)];
    if (serverId) conditions.push(eq(giveaways.serverId, serverId));
    return await db.select().from(giveaways)
      .where(and(...conditions))
      .orderBy(asc(giveaways.endsAt));
  }

  async getEndedGiveaways(serverId?: string): Promise<Giveaway[]> {
    const conditions = [eq(giveaways.isActive, false)];
    if (serverId) conditions.push(eq(giveaways.serverId, serverId));
    return await db.select().from(giveaways)
      .where(and(...conditions))
      .orderBy(desc(giveaways.endsAt))
      .limit(50);
  }

  async enterGiveaway(giveawayId: string, userId: string): Promise<Giveaway | null> {
    // Atomic: append userId only if giveaway is active and userId not already present.
    // The JSONB @> operator checks containment, preventing duplicate entries without a
    // read-modify-write cycle that would be vulnerable to race conditions.
    const [updated] = await db.update(giveaways)
      .set({ entries: sql`entries || ${JSON.stringify([userId])}::jsonb` })
      .where(and(
        eq(giveaways.id, giveawayId),
        eq(giveaways.isActive, true),
        sql`NOT (entries @> ${JSON.stringify([userId])}::jsonb)`,
      ))
      .returning();
    return updated ?? null;
  }

  async getExpiredGiveaways(): Promise<Giveaway[]> {
    return await db.select().from(giveaways)
      .where(and(eq(giveaways.isActive, true), lte(giveaways.endsAt, new Date())))
      .orderBy(asc(giveaways.endsAt));
  }

  async getActiveFutureJails(): Promise<ModerationLog[]> {
    const result = await pool.query(`
      SELECT ml.* FROM moderation_logs ml
      WHERE ml.action = 'jail'
        AND ml.expires_at > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM moderation_logs ml2
          WHERE ml2.action = 'unjail'
            AND ml2.target_user_id = ml.target_user_id
            AND ml2.server_id = ml.server_id
            AND ml2.created_at > ml.created_at
        )
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      serverId: row.server_id,
      moderatorId: row.moderator_id,
      targetUserId: row.target_user_id,
      action: row.action,
      reason: row.reason,
      duration: row.duration,
      channelId: row.channel_id,
      messageId: row.message_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  // Role Reaction methods
  async createRoleReaction(roleReaction: InsertRoleReaction): Promise<RoleReaction> {
    const [created] = await db.insert(roleReactions).values(roleReaction).returning();
    return created;
  }

  async getRoleReaction(messageId: string, emoji: string): Promise<RoleReaction | undefined> {
    const [reaction] = await db.select().from(roleReactions)
      .where(and(eq(roleReactions.messageId, messageId), eq(roleReactions.emoji, emoji)));
    return reaction || undefined;
  }

  async getMessageRoleReactions(messageId: string): Promise<RoleReaction[]> {
    return await db.select().from(roleReactions).where(eq(roleReactions.messageId, messageId));
  }

  async deleteRoleReaction(id: string): Promise<boolean> {
    const result = await db.delete(roleReactions).where(eq(roleReactions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async createSavedEmbed(embed: { serverId: string; name: string; embedData: any; createdBy: string; }): Promise<any> {
    const [created] = await db.insert(savedEmbeds).values(embed).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
