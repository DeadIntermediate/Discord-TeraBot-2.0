import { Client, Events } from 'discord.js';
import { storage } from '../../storage';
import { pool } from '../../db';

export async function readyHandler(client: Client) {
  // ASCII Art Banner
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                                                      ║');
  console.log('║                     TERA BOT                         ║');
  console.log('║                                                      ║');
  console.log('║            Discord Bot v2.0 - Node.js                ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n');
  
  console.log('🚀 Starting Tera Bot initialization...\n');
  
  // Test Database Connection
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DATABASE CONNECTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const testConnection = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
    console.log(`🕐 Database time: ${testConnection.rows[0].now}`);
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
  }
  console.log('');
  
  // Bot Information
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 BOT INFORMATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Logged in as: ${client.user?.tag}`);
  console.log(`🆔 Bot ID: ${client.user?.id}`);
  console.log(`📅 Account Created: ${client.user?.createdAt.toLocaleDateString()}`);
  console.log('');
  
  // Sharding Information
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔀 SHARDING INFORMATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (client.shard) {
    console.log(`📊 Current Shard ID(s): ${client.shard.ids.join(', ')}`);
    console.log(`📊 Total Shards: ${client.shard.count}`);
    console.log('✅ Auto-sharding enabled');
  } else {
    console.log('📊 Running without sharding (single instance)');
  }
  console.log('');
  
  // Guild Statistics
  const totalMembers = client.guilds.cache.reduce((acc: number, guild: any) => acc + guild.memberCount, 0);
  const totalChannels = client.guilds.cache.reduce((acc: number, guild: any) => acc + guild.channels.cache.size, 0);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 GUILD STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏰 Total Guilds: ${client.guilds.cache.size}`);
  console.log(`👥 Total Members: ${totalMembers.toLocaleString()}`);
  console.log(`📺 Total Channels: ${totalChannels.toLocaleString()}`);
  console.log('');
  
  // Register slash commands globally
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 COMMAND REGISTRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const commands = (client as any).commands;
    const commandData = Array.from(commands.values()).map((command: any) => command.data.toJSON());
    
    await client.application?.commands.set(commandData);
    console.log(`✅ Successfully registered ${commandData.length} application commands`);
    console.log(`📋 Commands: ${commandData.map((cmd: any) => cmd.name).join(', ')}`);
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
  console.log('');

  // Set bot activity
  client.user?.setActivity('Discord servers', { type: 3 }); // Type 3 = Watching
  
  // Initialize servers in database
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('� DATABASE SYNCHRONIZATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Synchronizing guild data with database...');
  
  let initialized = 0;
  let updated = 0;
  let errors = 0;
  
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
      console.error(`❌ Error syncing guild ${guild.name}:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Database sync complete!`);
  console.log(`   ├─ New guilds added: ${initialized}`);
  console.log(`   ├─ Existing guilds updated: ${updated}`);
  console.log(`   └─ Errors: ${errors}`);
  console.log('');
  
  // Final startup message
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ TERA BOT IS READY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 All systems operational');
  console.log('🎮 Watching for commands and events');
  console.log(`⏰ Ready at: ${new Date().toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n');
}
