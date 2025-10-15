import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import { readyHandler } from './events/ready';
import { guildMemberAddHandler } from './events/guildMemberAdd';
import { guildMemberRemoveHandler } from './events/guildMemberRemove';
import { interactionCreateHandler } from './events/interactionCreate';
import { handleReactionAdd, handleReactionRemove } from './commands/roleReactions';
import { commands } from './commands';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

// Store commands in client
(client as any).commands = new Collection();
commands.forEach(command => {
  (client as any).commands.set(command.data.name, command);
});

// Event handlers
client.once(Events.ClientReady, readyHandler);
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

export { client };
