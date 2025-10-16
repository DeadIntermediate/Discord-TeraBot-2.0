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

// Cards Against Humanity Tables
export const cahWhiteCards = pgTable("cah_white_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(), // The white card text
  cardSet: text("card_set").notNull().default("base"), // base, expansion1, custom, server-specific
  serverId: varchar("server_id").references(() => discordServers.id), // null for official cards, server ID for custom
  createdBy: varchar("created_by").references(() => discordUsers.id), // User who submitted custom card
  isApproved: boolean("is_approved").default(false), // For custom cards
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0), // Track popularity
  createdAt: timestamp("created_at").defaultNow(),
});

export const cahBlackCards = pgTable("cah_black_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(), // The black card text with placeholders
  pickCount: integer("pick_count").notNull().default(1), // How many white cards to pick
  cardSet: text("card_set").notNull().default("base"), // base, expansion1, custom, server-specific
  serverId: varchar("server_id").references(() => discordServers.id), // null for official cards
  createdBy: varchar("created_by").references(() => discordUsers.id), // User who submitted custom card
  isApproved: boolean("is_approved").default(false), // For custom cards
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0), // Track popularity
  createdAt: timestamp("created_at").defaultNow(),
});

export const cahGames = pgTable("cah_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => discordServers.id),
  channelId: varchar("channel_id").notNull(),
  hostId: varchar("host_id").notNull().references(() => discordUsers.id),
  gameMessageId: varchar("game_message_id"), // Main game embed message
  status: text("status").notNull().default("waiting"), // waiting, active, voting, finished, cancelled
  currentRound: integer("current_round").default(1),
  maxRounds: integer("max_rounds").default(10),
  maxPlayers: integer("max_players").default(8),
  currentJudgeId: varchar("current_judge_id").references(() => discordUsers.id),
  currentBlackCardId: varchar("current_black_card_id").references(() => cahBlackCards.id),
  settings: jsonb("settings").default({}), // Game-specific settings
  gameData: jsonb("game_data").default({}), // Round data, card state, etc.
  winnerId: varchar("winner_id").references(() => discordUsers.id), // Game winner
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
});

export const cahGamePlayers = pgTable("cah_game_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => cahGames.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => discordUsers.id),
  hand: jsonb("hand").default([]), // Array of white card IDs in player's hand
  score: integer("score").default(0), // Points scored in this game
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => ({
  gamePlayerUnique: unique().on(table.gameId, table.userId),
}));

export const cahGameSubmissions = pgTable("cah_game_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => cahGames.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").notNull().references(() => cahGamePlayers.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  whiteCardIds: jsonb("white_card_ids").notNull(), // Array of submitted white card IDs
  isWinner: boolean("is_winner").default(false),
  votes: integer("votes").default(0), // For voting-based games
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const cahGameStats = pgTable("cah_game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => discordUsers.id),
  serverId: varchar("server_id").references(() => discordServers.id), // null for global stats
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  roundsWon: integer("rounds_won").default(0),
  roundsJudged: integer("rounds_judged").default(0),
  favoriteWhiteCard: varchar("favorite_white_card").references(() => cahWhiteCards.id),
  favoriteBlackCard: varchar("favorite_black_card").references(() => cahBlackCards.id),
  totalScore: integer("total_score").default(0),
  averageScore: integer("average_score").default(0),
  lastPlayedAt: timestamp("last_played_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userServerUnique: unique().on(table.userId, table.serverId),
}));

// Relations
export const discordServersRelations = relations(discordServers, ({ many }) => ({
  members: many(serverMembers),
  moderationLogs: many(moderationLogs),
  tickets: many(tickets),
  giveaways: many(giveaways),
  roleReactions: many(roleReactions),
  streamNotifications: many(streamNotifications),
  savedEmbeds: many(savedEmbeds),
  gameFavorites: many(gameFavorites),
  gameRecommendations: many(gameRecommendations),
  cahGames: many(cahGames),
  customWhiteCards: many(cahWhiteCards),
  customBlackCards: many(cahBlackCards),
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
  hostedCahGames: many(cahGames),
  cahGamePlayers: many(cahGamePlayers),
  cahGameStats: many(cahGameStats),
  createdWhiteCards: many(cahWhiteCards),
  createdBlackCards: many(cahBlackCards),
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

// Cards Against Humanity Relations
export const cahWhiteCardsRelations = relations(cahWhiteCards, ({ one, many }) => ({
  server: one(discordServers, {
    fields: [cahWhiteCards.serverId],
    references: [discordServers.id],
  }),
  creator: one(discordUsers, {
    fields: [cahWhiteCards.createdBy],
    references: [discordUsers.id],
  }),
}));

export const cahBlackCardsRelations = relations(cahBlackCards, ({ one, many }) => ({
  server: one(discordServers, {
    fields: [cahBlackCards.serverId],
    references: [discordServers.id],
  }),
  creator: one(discordUsers, {
    fields: [cahBlackCards.createdBy],
    references: [discordUsers.id],
  }),
  games: many(cahGames),
}));

export const cahGamesRelations = relations(cahGames, ({ one, many }) => ({
  server: one(discordServers, {
    fields: [cahGames.serverId],
    references: [discordServers.id],
  }),
  host: one(discordUsers, {
    fields: [cahGames.hostId],
    references: [discordUsers.id],
  }),
  currentJudge: one(discordUsers, {
    fields: [cahGames.currentJudgeId],
    references: [discordUsers.id],
  }),
  currentBlackCard: one(cahBlackCards, {
    fields: [cahGames.currentBlackCardId],
    references: [cahBlackCards.id],
  }),
  winner: one(discordUsers, {
    fields: [cahGames.winnerId],
    references: [discordUsers.id],
  }),
  players: many(cahGamePlayers),
  submissions: many(cahGameSubmissions),
}));

export const cahGamePlayersRelations = relations(cahGamePlayers, ({ one, many }) => ({
  game: one(cahGames, {
    fields: [cahGamePlayers.gameId],
    references: [cahGames.id],
  }),
  user: one(discordUsers, {
    fields: [cahGamePlayers.userId],
    references: [discordUsers.id],
  }),
  submissions: many(cahGameSubmissions),
}));

export const cahGameSubmissionsRelations = relations(cahGameSubmissions, ({ one }) => ({
  game: one(cahGames, {
    fields: [cahGameSubmissions.gameId],
    references: [cahGames.id],
  }),
  player: one(cahGamePlayers, {
    fields: [cahGameSubmissions.playerId],
    references: [cahGamePlayers.id],
  }),
}));

export const cahGameStatsRelations = relations(cahGameStats, ({ one }) => ({
  user: one(discordUsers, {
    fields: [cahGameStats.userId],
    references: [discordUsers.id],
  }),
  server: one(discordServers, {
    fields: [cahGameStats.serverId],
    references: [discordServers.id],
  }),
  favoriteWhiteCard: one(cahWhiteCards, {
    fields: [cahGameStats.favoriteWhiteCard],
    references: [cahWhiteCards.id],
  }),
  favoriteBlackCard: one(cahBlackCards, {
    fields: [cahGameStats.favoriteBlackCard],
    references: [cahBlackCards.id],
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

// Cards Against Humanity Insert Schemas
export const insertCahWhiteCardSchema = createInsertSchema(cahWhiteCards).omit({
  id: true,
  createdAt: true,
});

export const insertCahBlackCardSchema = createInsertSchema(cahBlackCards).omit({
  id: true,
  createdAt: true,
});

export const insertCahGameSchema = createInsertSchema(cahGames).omit({
  id: true,
  createdAt: true,
});

export const insertCahGamePlayerSchema = createInsertSchema(cahGamePlayers).omit({
  id: true,
  joinedAt: true,
});

export const insertCahGameSubmissionSchema = createInsertSchema(cahGameSubmissions).omit({
  id: true,
  submittedAt: true,
});

export const insertCahGameStatsSchema = createInsertSchema(cahGameStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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

// Cards Against Humanity Types
export type InsertCahWhiteCard = z.infer<typeof insertCahWhiteCardSchema>;
export type CahWhiteCard = typeof cahWhiteCards.$inferSelect;

export type InsertCahBlackCard = z.infer<typeof insertCahBlackCardSchema>;
export type CahBlackCard = typeof cahBlackCards.$inferSelect;

export type InsertCahGame = z.infer<typeof insertCahGameSchema>;
export type CahGame = typeof cahGames.$inferSelect;

export type InsertCahGamePlayer = z.infer<typeof insertCahGamePlayerSchema>;
export type CahGamePlayer = typeof cahGamePlayers.$inferSelect;

export type InsertCahGameSubmission = z.infer<typeof insertCahGameSubmissionSchema>;
export type CahGameSubmission = typeof cahGameSubmissions.$inferSelect;

export type InsertCahGameStats = z.infer<typeof insertCahGameStatsSchema>;
export type CahGameStats = typeof cahGameStats.$inferSelect;
