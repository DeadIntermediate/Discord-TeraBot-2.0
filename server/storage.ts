import { 
  users, discordServers, discordUsers, serverMembers, 
  moderationLogs, tickets, giveaways, roleReactions,
  type User, type InsertUser, type DiscordServer, type InsertDiscordServer,
  type DiscordUser, type InsertDiscordUser, type ServerMember, type InsertServerMember,
  type ModerationLog, type InsertModerationLog, type Ticket, type InsertTicket,
  type Giveaway, type InsertGiveaway, type RoleReaction, type InsertRoleReaction
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

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
  getTopMembersByXP(serverId: string, limit?: number): Promise<ServerMember[]>;

  // Moderation methods
  createModerationLog(log: InsertModerationLog): Promise<ModerationLog>;
  getModerationLogs(serverId: string, limit?: number): Promise<ModerationLog[]>;
  getUserModerationHistory(userId: string, serverId?: string): Promise<ModerationLog[]>;

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
  getExpiredGiveaways(): Promise<Giveaway[]>;

  // Role Reaction methods
  createRoleReaction(roleReaction: InsertRoleReaction): Promise<RoleReaction>;
  getRoleReaction(messageId: string, emoji: string): Promise<RoleReaction | undefined>;
  getMessageRoleReactions(messageId: string): Promise<RoleReaction[]>;
  deleteRoleReaction(id: string): Promise<boolean>;
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

  async getTopMembersByXP(serverId: string, limit: number = 10): Promise<ServerMember[]> {
    return await db.select().from(serverMembers)
      .where(eq(serverMembers.serverId, serverId))
      .orderBy(desc(serverMembers.xp))
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
    const query = db.select().from(moderationLogs)
      .where(eq(moderationLogs.targetUserId, userId))
      .orderBy(desc(moderationLogs.createdAt));
    
    if (serverId) {
      return await query.where(and(eq(moderationLogs.targetUserId, userId), eq(moderationLogs.serverId, serverId)));
    }
    
    return await query;
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
    const query = db.select().from(tickets).where(eq(tickets.serverId, serverId));
    
    if (status) {
      return await query.where(and(eq(tickets.serverId, serverId), eq(tickets.status, status)));
    }
    
    return await query.orderBy(desc(tickets.createdAt));
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
    const query = db.select().from(giveaways)
      .where(eq(giveaways.isActive, true))
      .orderBy(asc(giveaways.endsAt));
    
    if (serverId) {
      return await query.where(and(eq(giveaways.isActive, true), eq(giveaways.serverId, serverId)));
    }
    
    return await query;
  }

  async getExpiredGiveaways(): Promise<Giveaway[]> {
    return await db.select().from(giveaways)
      .where(and(eq(giveaways.isActive, true), eq(giveaways.endsAt, new Date())))
      .orderBy(asc(giveaways.endsAt));
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
}

export const storage = new DatabaseStorage();
