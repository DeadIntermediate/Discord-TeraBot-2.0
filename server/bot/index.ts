import { Client, GatewayIntentBits, Events, Collection, Partials } from 'discord.js';
import { readyHandler } from './events/ready';
import { guildCreateHandler } from './events/guildCreate';
import { guildMemberAddHandler } from './events/guildMemberAdd';
import { guildMemberRemoveHandler } from './events/guildMemberRemove';
import { interactionCreateHandler } from './events/interactionCreate';
import { voiceStateUpdateHandler, startVoiceXpTracker } from './events/voiceStateUpdate';
import { startStreamingTracker } from './streamingTracker';
import { handleReactionAdd, handleReactionRemove } from './commands/roleReactions';
import { commands } from './commands';
import { StreamMonitor } from './streamMonitor';
import { info, warn, error, debug } from '../utils/logger';

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

// Store commands in client
(client as any).commands = new Collection();
commands.forEach(command => {
  (client as any).commands.set(command.data.name, command);
});

// Event handlers
client.once(Events.ClientReady, (c) => {
  readyHandler(c);
  
  // Start stream monitor after bot is ready (only on shard 0 to avoid duplicates)
  if (!client.shard || client.shard.ids.includes(0)) {
    streamMonitor = new StreamMonitor(client);
    streamMonitor.start();
  }
  
  // Start voice XP tracker
  startVoiceXpTracker(client);

  // Start streaming XP tracker
  startStreamingTracker(client);
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

client.on(Events.GuildCreate, guildCreateHandler);
client.on(Events.GuildMemberAdd, guildMemberAddHandler);
client.on(Events.GuildMemberRemove, guildMemberRemoveHandler);
client.on(Events.InteractionCreate, interactionCreateHandler);
client.on(Events.MessageReactionAdd, handleReactionAdd);
client.on(Events.MessageReactionRemove, handleReactionRemove);
client.on(Events.VoiceStateUpdate, voiceStateUpdateHandler);

// Initialize bot
export async function initializeBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    error('DISCORD_BOT_TOKEN is not set in environment variables');
    return;
  }

  try {
    await client.login(token);
    info('Discord bot successfully logged in');
  } catch (err) {
    error('Failed to login to Discord:', err);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  info('Shutting down bot...');
  if (streamMonitor) {
    streamMonitor.stop();
  }
  client.destroy();
  process.exit(0);
});

export { client };
