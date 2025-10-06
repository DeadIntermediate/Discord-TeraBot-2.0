import { Client, Events } from 'discord.js';
import { storage } from '../../storage';

export async function readyHandler(client: Client) {
  console.log(`Ready! Logged in as ${client.user?.tag}`);
  
  // Register slash commands globally
  try {
    const commands = (client as any).commands;
    const commandData = Array.from(commands.values()).map((command: any) => command.data.toJSON());
    
    await client.application?.commands.set(commandData);
    console.log(`Successfully registered ${commandData.length} slash commands.`);
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }

  // Set bot activity
  client.user?.setActivity('Discord servers', { type: 3 }); // Type 3 = Watching
  
  // Initialize servers in database
  for (const guild of client.guilds.cache.values()) {
    try {
      const existingServer = await storage.getDiscordServer(guild.id);
      
      if (!existingServer) {
        await storage.createDiscordServer({
          id: guild.id,
          name: guild.name,
          ownerId: guild.ownerId,
          memberCount: guild.memberCount,
          isActive: true,
        });
        console.log(`Initialized server: ${guild.name}`);
      } else {
        // Update member count
        await storage.updateDiscordServer(guild.id, {
          memberCount: guild.memberCount,
          name: guild.name,
        });
      }
    } catch (error) {
      console.error(`Error initializing server ${guild.name}:`, error);
    }
  }
}
