import { Client, GatewayIntentBits, Events, Collection, Partials } from 'discord.js';
import { readyHandler } from './events/ready';
import { guildMemberAddHandler } from './events/guildMemberAdd';
import { guildMemberRemoveHandler } from './events/guildMemberRemove';
import { interactionCreateHandler } from './events/interactionCreate';
import { messageCreateHandler } from './events/messageCreate';
import { voiceStateUpdateHandler, startVoiceXpTracker } from './events/voiceStateUpdate';
import { handleReactionAdd, handleReactionRemove } from './commands/roleReactions';
import { commands } from './commands';
import { StreamMonitor } from './streamMonitor';
import { recoverGiveaways } from './commands/giveaways';
import { recoverJails } from './commands/moderation';
import { info, warn, error } from '../utils/logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences, // Required for detecting user activities/streaming
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  shards: 'auto', // Automatic guild sharding - Discord calculates optimal shard count
});

// Initialize stream monitor
let streamMonitor: StreamMonitor | null = null;

// Guard: voice XP tracker must only be started once per process (interval survives restarts)
let voiceTrackerStarted = false;

// Store commands in client
(client as any).commands = new Collection();
commands.forEach(command => {
  (client as any).commands.set(command.data.name, command);
});

// Event handlers — use .on() so the handler re-fires after an in-process restart
client.on(Events.ClientReady, (c) => {
  readyHandler(c);

  // Restart-safe: stop any previous stream monitor instance before creating a new one
  if (!client.shard || client.shard.ids.includes(0)) {
    if (streamMonitor) streamMonitor.stop();
    streamMonitor = new StreamMonitor(client);
    streamMonitor.start();
  }

  // Voice XP tracker uses setInterval — only start it once per process lifetime
  if (!voiceTrackerStarted) {
    voiceTrackerStarted = true;
    startVoiceXpTracker(client);
  }

  // Recover persisted scheduled tasks on every ready event (initial start and restarts)
  recoverGiveaways(client).catch(err => error('Failed to recover giveaways:', err));
  recoverJails(client).catch(err => error('Failed to recover jails:', err));
});

// Shard-specific events
client.on(Events.ShardReady, (id: number) => {
  info(`✅ Shard ${id} is ready`);
});

client.on(Events.ShardDisconnect, (event: any, id: number) => {
  warn(`⚠️ Shard ${id} disconnected: ${String(event)}`);
});

client.on(Events.ShardError, (err: Error, id: number) => {
  error(`❌ Shard ${id} error:`, err);
});

client.on(Events.ShardReconnecting, (id: number) => {
  info(`🔄 Shard ${id} reconnecting...`);
});

client.on(Events.ShardResume, (id: number, replayed: number) => {
  info(`✅ Shard ${id} resumed (${replayed} events replayed)`);
});

client.on(Events.GuildMemberAdd, guildMemberAddHandler);
client.on(Events.GuildMemberRemove, guildMemberRemoveHandler);
client.on(Events.InteractionCreate, interactionCreateHandler);
client.on(Events.MessageCreate, messageCreateHandler);
client.on(Events.MessageReactionAdd, handleReactionAdd);
client.on(Events.MessageReactionRemove, handleReactionRemove);
client.on(Events.VoiceStateUpdate, voiceStateUpdateHandler);

// Initialize bot
export async function initializeBot() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
  }

  await client.login(token);
  info('Discord bot successfully logged in');
}

export function stopBot() {
  if (streamMonitor) {
    streamMonitor.stop();
  }
  client.destroy();
}

export { client };
