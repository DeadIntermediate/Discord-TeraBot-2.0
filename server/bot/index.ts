import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import { readyHandler } from './events/ready';
import { guildMemberAddHandler } from './events/guildMemberAdd';
import { guildMemberRemoveHandler } from './events/guildMemberRemove';
import { interactionCreateHandler } from './events/interactionCreate';
import { handleReactionAdd, handleReactionRemove } from './commands/roleReactions';
import { commands } from './commands';
import { StreamMonitor } from './streamMonitor';

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
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
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
});

// Shard-specific events
client.on(Events.ShardReady, (id: number) => {
  console.log(`✅ Shard ${id} is ready`);
});

client.on(Events.ShardDisconnect, (event: CloseEvent, id: number) => {
  console.log(`⚠️ Shard ${id} disconnected`, event);
});

client.on(Events.ShardError, (error: Error, id: number) => {
  console.error(`❌ Shard ${id} error:`, error);
});

client.on(Events.ShardReconnecting, (id: number) => {
  console.log(`🔄 Shard ${id} reconnecting...`);
});

client.on(Events.ShardResume, (id: number, replayed: number) => {
  console.log(`✅ Shard ${id} resumed (${replayed} events replayed)`);
});

client.on(Events.GuildMemberAdd, guildMemberAddHandler);
client.on(Events.GuildMemberRemove, guildMemberRemoveHandler);
client.on(Events.InteractionCreate, interactionCreateHandler);
client.on(Events.MessageReactionAdd, handleReactionAdd);
client.on(Events.MessageReactionRemove, handleReactionRemove);

// Initialize bot
export async function initializeBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables');
    return;
  }

  try {
    await client.login(token);
    console.log('Discord bot successfully logged in');
  } catch (error) {
    console.error('Failed to login to Discord:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down bot...');
  if (streamMonitor) {
    streamMonitor.stop();
  }
  client.destroy();
  process.exit(0);
});

export { client };
