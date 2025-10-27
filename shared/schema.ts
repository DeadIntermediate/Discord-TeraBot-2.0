import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const discordServers = pgTable("discord_servers", {
  id: varchar("id").primaryKey(), // Discord guild ID
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull(),
  memberCount: integer("member_count").default(0),
  isActive: boolean("is_active").default(true),
  welcomeChannelId: varchar("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  moderationChannelId: varchar("moderation_channel_id"),
  staffLogChannelId: varchar("staff_log_channel_id"),
  streamNotificationChannelId: varchar("stream_notification_channel_id"), // Channel for stream notifications
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const discordUsers = pgTable("discord_users", {
  id: varchar("id").primaryKey(), // Discord user ID
  username: text("username").notNull(),
  discriminator: text("discriminator"),
  avatar: text("avatar"),
  isBot: boolean("is_bot").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serverMembers = pgTable("server_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  userId: varchar("user_id").notNull().references(() => discordUsers.id),
  xp: integer("xp").default(0), // Legacy field, kept for compatibility
  level: integer("level").default(1), // Legacy field, kept for compatibility
  textXp: integer("text_xp").default(0),
  textLevel: integer("text_level").default(1),
  voiceXp: integer("voice_xp").default(0),
  voiceLevel: integer("voice_level").default(1),
  globalLevel: integer("global_level").default(1),
  messageCount: integer("message_count").default(0),
  voiceTime: integer("voice_time").default(0), // in minutes
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => ({
  serverUserUnique: unique().on(table.serverId, table.userId),
}));

export const moderationLogs = pgTable("moderation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  moderatorId: varchar("moderator_id").notNull().references(() => discordUsers.id),
  targetUserId: varchar("target_user_id").notNull().references(() => discordUsers.id),
  action: text("action").notNull(), // ban, kick, mute, warn, etc.
  reason: text("reason"),
  duration: integer("duration"), // in minutes for temporary actions
  channelId: varchar("channel_id"),
  messageId: varchar("message_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  userId: varchar("user_id").notNull().references(() => discordUsers.id),
  channelId: varchar("channel_id").notNull(),
  subject: text("subject").notNull(),
  status: text("status").default("open"), // open, closed, resolved
  priority: text("priority").default("medium"), // low, medium, high, urgent
  assignedTo: varchar("assigned_to").references(() => discordUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const giveaways = pgTable("giveaways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  channelId: varchar("channel_id").notNull(),
  messageId: varchar("message_id").notNull(),
  hostId: varchar("host_id").notNull().references(() => discordUsers.id),
  title: text("title").notNull(),
  description: text("description"),
  prize: text("prize").notNull(),
  winnerCount: integer("winner_count").default(1),
  requirements: jsonb("requirements").default({}),
  entries: jsonb("entries").default([]), // array of user IDs
  winners: jsonb("winners").default([]), // array of user IDs
  isActive: boolean("is_active").default(true),
  endsAt: timestamp("ends_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roleReactions = pgTable("role_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  channelId: varchar("channel_id").notNull(),
  messageId: varchar("message_id").notNull(),
  emoji: text("emoji").notNull(),
  roleId: varchar("role_id").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const streamNotifications = pgTable("stream_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  userId: varchar("user_id").references(() => discordUsers.id), // Discord user who added themselves
  channelId: varchar("channel_id").notNull(), // Notification channel
  platform: text("platform").notNull(), // twitch, youtube, kick
  platformUserId: text("platform_user_id"), // Platform-specific user ID
  username: text("username").notNull(), // Platform username
  displayName: text("display_name"), // Platform display name
  avatarUrl: text("avatar_url"), // Platform avatar URL
  messageId: varchar("message_id"), // Last notification message ID
  notificationMessage: text("notification_message"), // Custom notification message
  roleIdToPing: varchar("role_id_to_ping"), // Role to ping on live
  isLive: boolean("is_live").default(false),
  isActive: boolean("is_active").default(true),
  liveTitle: text("live_title"), // Current stream title
  liveGame: text("live_game"), // Current game/category
  liveViewers: integer("live_viewers"), // Current viewer count
  liveStartedAt: timestamp("live_started_at"), // When stream went live
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedEmbeds = pgTable("saved_embeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  name: text("name").notNull(),
  embedData: jsonb("embed_data").notNull(), // Full embed JSON structure
  createdBy: varchar("created_by").notNull().references(() => discordUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameCache = pgTable("game_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().unique(), // External API game ID
  gameName: text("game_name").notNull(),
  gameSlug: text("game_slug"),
  gameData: jsonb("game_data").notNull(), // Cached game information from API
  source: text("source").notNull(), // 'rawg', 'igdb', 'steam', etc.
  lastUpdated: timestamp("last_updated").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameFavorites = pgTable("game_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => discordUsers.id),
  serverId: varchar("server_id").references(() => discordServers.id), // Optional: server-specific favorites
  gameId: varchar("game_id").notNull(), // External API game ID
  gameName: text("game_name").notNull(),
  gameSlug: text("game_slug"),
  gameImage: text("game_image"), // Game thumbnail/cover image
  rating: integer("rating"), // User's personal rating 1-10
  notes: text("notes"), // User's personal notes about the game
  isPublic: boolean("is_public").default(true), // Whether others can see this favorite
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userGameUnique: unique().on(table.userId, table.gameId, table.serverId),
}));

export const gameRecommendations = pgTable("game_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  channelId: varchar("channel_id").notNull(),
  recommenderId: varchar("recommender_id").notNull().references(() => discordUsers.id),
  targetUserId: varchar("target_user_id").references(() => discordUsers.id), // Optional: specific user recommendation
  gameId: varchar("game_id").notNull(),
  gameName: text("game_name").notNull(),
  reason: text("reason"), // Why they recommend this game
  messageId: varchar("message_id"), // Discord message ID for tracking
  status: text("status").default("pending"), // pending, accepted, declined, ignored
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const loggingConfig = pgTable("logging_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().unique().references(() => discordServers.id),
  channelId: varchar("channel_id").notNull(), // Discord channel ID for logging
  webhookUrl: text("webhook_url"), // Webhook URL for sending logs
  logErrors: boolean("log_errors").default(true),
  logWarnings: boolean("log_warnings").default(true),
  logInfo: boolean("log_info").default(true),
  logDebug: boolean("log_debug").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const botLogs = pgTable("bot_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").references(() => discordServers.id),
  level: text("level").notNull(), // debug, info, warn, error
  category: text("category").notNull(), // bot, commands, voice, stream, etc.
  message: text("message").notNull(),
  details: jsonb("details"), // Additional JSON data
  userId: varchar("user_id").references(() => discordUsers.id), // Related user if applicable
  messageId: varchar("message_id"), // Related Discord message if applicable
  sentToDiscord: boolean("sent_to_discord").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guildBackups = pgTable("guild_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => discordUsers.id),
  rolesData: jsonb("roles_data").notNull(), // Array of role backups
  channelsData: jsonb("channels_data").notNull(), // Array of channel backups
  metadata: jsonb("metadata"), // Guild name, icon, etc at backup time
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration for auto-cleanup
});

export const backupRestoreHistory = pgTable("backup_restore_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  backupId: varchar("backup_id").notNull().references(() => guildBackups.id),
  restoredBy: varchar("restored_by").notNull().references(() => discordUsers.id),
  status: text("status").notNull(), // pending, in-progress, completed, failed
  itemsRestored: integer("items_restored").default(0), // Number of roles/channels restored
  itemsFailed: integer("items_failed").default(0), // Number of failures
  errorDetails: jsonb("error_details"), // Any errors that occurred
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Cards Against Humanity feature removed. Related tables and types were deleted.

// Relations
export const discordServersRelations = relations(discordServers, ({ many, one }) => ({
  members: many(serverMembers),
  moderationLogs: many(moderationLogs),
  tickets: many(tickets),
  giveaways: many(giveaways),
  roleReactions: many(roleReactions),
  streamNotifications: many(streamNotifications),
  savedEmbeds: many(savedEmbeds),
  gameFavorites: many(gameFavorites),
  gameRecommendations: many(gameRecommendations),
  loggingConfig: one(loggingConfig),
  botLogs: many(botLogs),
  guildBackups: many(guildBackups),
  backupHistory: many(backupRestoreHistory),
  // CAH tables removed
}));

export const discordUsersRelations = relations(discordUsers, ({ many }) => ({
  serverMemberships: many(serverMembers),
  moderationLogs: many(moderationLogs),
  moderatedLogs: many(moderationLogs),
  tickets: many(tickets),
  hostedGiveaways: many(giveaways),
  gameFavorites: many(gameFavorites),
  gameRecommendations: many(gameRecommendations),
  gameRecommendationsReceived: many(gameRecommendations),
  // CAH tables removed
}));

export const serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(discordServers, {
    fields: [serverMembers.serverId],
    references: [discordServers.id],
  }),
  user: one(discordUsers, {
    fields: [serverMembers.userId],
    references: [discordUsers.id],
  }),
}));

export const moderationLogsRelations = relations(moderationLogs, ({ one }) => ({
  server: one(discordServers, {
    fields: [moderationLogs.serverId],
    references: [discordServers.id],
  }),
  moderator: one(discordUsers, {
    fields: [moderationLogs.moderatorId],
    references: [discordUsers.id],
  }),
  targetUser: one(discordUsers, {
    fields: [moderationLogs.targetUserId],
    references: [discordUsers.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  server: one(discordServers, {
    fields: [tickets.serverId],
    references: [discordServers.id],
  }),
  user: one(discordUsers, {
    fields: [tickets.userId],
    references: [discordUsers.id],
  }),
  assignee: one(discordUsers, {
    fields: [tickets.assignedTo],
    references: [discordUsers.id],
  }),
}));

export const giveawaysRelations = relations(giveaways, ({ one }) => ({
  server: one(discordServers, {
    fields: [giveaways.serverId],
    references: [discordServers.id],
  }),
  host: one(discordUsers, {
    fields: [giveaways.hostId],
    references: [discordUsers.id],
  }),
}));

export const roleReactionsRelations = relations(roleReactions, ({ one }) => ({
  server: one(discordServers, {
    fields: [roleReactions.serverId],
    references: [discordServers.id],
  }),
}));

export const streamNotificationsRelations = relations(streamNotifications, ({ one }) => ({
  server: one(discordServers, {
    fields: [streamNotifications.serverId],
    references: [discordServers.id],
  }),
}));

export const savedEmbedsRelations = relations(savedEmbeds, ({ one }) => ({
  server: one(discordServers, {
    fields: [savedEmbeds.serverId],
    references: [discordServers.id],
  }),
  creator: one(discordUsers, {
    fields: [savedEmbeds.createdBy],
    references: [discordUsers.id],
  }),
}));

export const gameFavoritesRelations = relations(gameFavorites, ({ one }) => ({
  user: one(discordUsers, {
    fields: [gameFavorites.userId],
    references: [discordUsers.id],
  }),
  server: one(discordServers, {
    fields: [gameFavorites.serverId],
    references: [discordServers.id],
  }),
}));

export const gameRecommendationsRelations = relations(gameRecommendations, ({ one }) => ({
  server: one(discordServers, {
    fields: [gameRecommendations.serverId],
    references: [discordServers.id],
  }),
  recommender: one(discordUsers, {
    fields: [gameRecommendations.recommenderId],
    references: [discordUsers.id],
  }),
  targetUser: one(discordUsers, {
    fields: [gameRecommendations.targetUserId],
    references: [discordUsers.id],
  }),
}));

export const loggingConfigRelations = relations(loggingConfig, ({ one }) => ({
  server: one(discordServers, {
    fields: [loggingConfig.serverId],
    references: [discordServers.id],
  }),
}));

export const botLogsRelations = relations(botLogs, ({ one }) => ({
  server: one(discordServers, {
    fields: [botLogs.serverId],
    references: [discordServers.id],
  }),
  user: one(discordUsers, {
    fields: [botLogs.userId],
    references: [discordUsers.id],
  }),
}));

// Cards Against Humanity Relations
// CAH relations removed

export const guildBackupsRelations = relations(guildBackups, ({ one }) => ({
  server: one(discordServers, {
    fields: [guildBackups.serverId],
    references: [discordServers.id],
  }),
  creator: one(discordUsers, {
    fields: [guildBackups.createdBy],
    references: [discordUsers.id],
  }),
}));

export const backupRestoreHistoryRelations = relations(backupRestoreHistory, ({ one }) => ({
  server: one(discordServers, {
    fields: [backupRestoreHistory.serverId],
    references: [discordServers.id],
  }),
  backup: one(guildBackups, {
    fields: [backupRestoreHistory.backupId],
    references: [guildBackups.id],
  }),
  restorer: one(discordUsers, {
    fields: [backupRestoreHistory.restoredBy],
    references: [discordUsers.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDiscordServerSchema = createInsertSchema(discordServers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertDiscordUserSchema = createInsertSchema(discordUsers).omit({
  createdAt: true,
});

export const insertServerMemberSchema = createInsertSchema(serverMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertModerationLogSchema = createInsertSchema(moderationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
});

export const insertGiveawaySchema = createInsertSchema(giveaways).omit({
  id: true,
  createdAt: true,
});

export const insertRoleReactionSchema = createInsertSchema(roleReactions).omit({
  id: true,
  createdAt: true,
});

export const insertStreamNotificationSchema = createInsertSchema(streamNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertSavedEmbedSchema = createInsertSchema(savedEmbeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameCacheSchema = createInsertSchema(gameCache).omit({
  id: true,
  createdAt: true,
});

export const insertGameFavoriteSchema = createInsertSchema(gameFavorites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameRecommendationSchema = createInsertSchema(gameRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertLoggingConfigSchema = createInsertSchema(loggingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBotLogSchema = createInsertSchema(botLogs).omit({
  id: true,
  createdAt: true,
});

export const insertGuildBackupSchema = createInsertSchema(guildBackups).omit({
  id: true,
  createdAt: true,
});

export const insertBackupRestoreHistorySchema = createInsertSchema(backupRestoreHistory).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// CAH insert schemas removed

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDiscordServer = z.infer<typeof insertDiscordServerSchema>;
export type DiscordServer = typeof discordServers.$inferSelect;

export type InsertDiscordUser = z.infer<typeof insertDiscordUserSchema>;
export type DiscordUser = typeof discordUsers.$inferSelect;

export type InsertServerMember = z.infer<typeof insertServerMemberSchema>;
export type ServerMember = typeof serverMembers.$inferSelect;

export type InsertModerationLog = z.infer<typeof insertModerationLogSchema>;
export type ModerationLog = typeof moderationLogs.$inferSelect;

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type Giveaway = typeof giveaways.$inferSelect;

export type InsertRoleReaction = z.infer<typeof insertRoleReactionSchema>;
export type RoleReaction = typeof roleReactions.$inferSelect;

export type InsertStreamNotification = z.infer<typeof insertStreamNotificationSchema>;
export type StreamNotification = typeof streamNotifications.$inferSelect;

export type InsertSavedEmbed = z.infer<typeof insertSavedEmbedSchema>;
export type SavedEmbed = typeof savedEmbeds.$inferSelect;

export type InsertGameCache = z.infer<typeof insertGameCacheSchema>;
export type GameCache = typeof gameCache.$inferSelect;

export type InsertGameFavorite = z.infer<typeof insertGameFavoriteSchema>;
export type GameFavorite = typeof gameFavorites.$inferSelect;

export type InsertGameRecommendation = z.infer<typeof insertGameRecommendationSchema>;
export type GameRecommendation = typeof gameRecommendations.$inferSelect;

export type InsertLoggingConfig = z.infer<typeof insertLoggingConfigSchema>;
export type LoggingConfig = typeof loggingConfig.$inferSelect;

export type InsertBotLog = z.infer<typeof insertBotLogSchema>;
export type BotLog = typeof botLogs.$inferSelect;

export type InsertGuildBackup = z.infer<typeof insertGuildBackupSchema>;
export type GuildBackup = typeof guildBackups.$inferSelect;

export type InsertBackupRestoreHistory = z.infer<typeof insertBackupRestoreHistorySchema>;
export type BackupRestoreHistory = typeof backupRestoreHistory.$inferSelect;

// CAH types removed
