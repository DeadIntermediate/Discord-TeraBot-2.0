import { Client, Events } from 'discord.js';
import { storage } from '../../storage';

export async function readyHandler(client: Client) {
  console.log(`✅ Bot logged in as ${client.user?.tag}`);
  
  // Display sharding information
  if (client.shard) {
    console.log(`📊 Shard ID: ${client.shard.ids.join(', ')}`);
    console.log(`📊 Total Shards: ${client.shard.count}`);
  } else {
    console.log(`📊 Running without sharding (single instance)`);
  }
  
  // Display guild information
  console.log(`🌐 Serving ${client.guilds.cache.size} guild(s)`);
  console.log(`👥 Total members: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
  
  // Register slash commands globally
  try {
    const commands = (client as any).commands;
    const commandData = Array.from(commands.values()).map((command: any) => command.data.toJSON());
    
    await client.application?.commands.set(commandData);
    console.log(`📝 Successfully registered ${commandData.length} application commands`);
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }

  // Set bot activity
  client.user?.setActivity('Discord servers', { type: 3 }); // Type 3 = Watching
  
  // Initialize servers in database
  console.log('🔄 Initializing guilds in database...');
  let initialized = 0;
  let updated = 0;
  
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
        initialized++;
      } else {
        // Update member count
        await storage.updateDiscordServer(guild.id, {
          memberCount: guild.memberCount,
          name: guild.name,
        });
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error initializing server ${guild.name}:`, error);
    }
  }
  
  console.log(`✅ Database sync complete: ${initialized} new, ${updated} updated`);
  console.log('🚀 Bot is ready!');
}
