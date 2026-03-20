import { Client } from 'discord.js';
import { storage } from '../../storage';
import { pool } from '../../db';
import { info, debug, warn, error } from '../../utils/logger';
import { startStreamMonitor } from '../../utils/streamMonitor';

export async function readyHandler(client: Client) {
  // ASCII Art Banner (debug-only)
  debug('\n');
  debug('╔══════════════════════════════════════════════════════╗');
  debug('║                                                      ║');
  debug('║                     TERA BOT                         ║');
  debug('║                                                      ║');
  debug('║            Discord Bot v2.0 - Node.js                ║');
  debug('║                                                      ║');
  debug('╚══════════════════════════════════════════════════════╝');
  debug('\n');

  info('🚀 Starting Tera Bot initialization...\n');

  // Test Database Connection (additional verification)
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('📊 DATABASE CONNECTION VERIFICATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const testConnection = await pool.query('SELECT NOW()');
    info('✅ PostgreSQL connection verified in bot ready handler');
    debug(`🕐 Database time: ${testConnection.rows[0].now}`);
  } catch (err) {
    error('❌ PostgreSQL connection verification failed in ready handler:', err);
    warn('⚠️ Bot may experience issues with database-dependent features');
  }
  debug('');

  // Bot Information
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('🤖 BOT INFORMATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info(`✅ Logged in as: ${client.user?.tag}`);
  debug(`🆔 Bot ID: ${client.user?.id}`);
  debug(`📅 Account Created: ${client.user?.createdAt.toLocaleDateString()}`);
  debug('');

  // Sharding Information
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('🔀 SHARDING INFORMATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (client.shard) {
    debug(`📊 Current Shard ID(s): ${client.shard.ids.join(', ')}`);
    debug(`📊 Total Shards: ${client.shard.count}`);
    debug('✅ Auto-sharding enabled');
  } else {
    debug('📊 Running without sharding (single instance)');
  }
  debug('');

  // Guild Statistics
  const totalMembers = client.guilds.cache.reduce((acc: number, guild: any) => acc + guild.memberCount, 0);
  const totalChannels = client.guilds.cache.reduce((acc: number, guild: any) => acc + guild.channels.cache.size, 0);
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('🌐 GUILD STATISTICS');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info(`🏰 Total Guilds: ${client.guilds.cache.size}`);
  info(`👥 Total Members: ${totalMembers.toLocaleString()}`);
  info(`📺 Total Channels: ${totalChannels.toLocaleString()}`);
  debug('');

  // Register slash commands globally
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('📝 COMMAND REGISTRATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const commands = (client as any).commands;
    const commandData = Array.from(commands.values()).map((command: any) => command.data.toJSON());

    await client.application?.commands.set(commandData);
    info(`✅ Successfully registered ${commandData.length} application commands`);
    debug(`📋 Commands: ${commandData.map((cmd: any) => cmd.name).join(', ')}`);
  } catch (err) {
    error('❌ Error registering slash commands:', err);
  }
  debug('');

  // Set bot activity
  client.user?.setActivity('Discord servers', { type: 3 }); // Type 3 = Watching

  // Initialize servers in database
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('📦 DATABASE SYNCHRONIZATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info('🔄 Synchronizing guild data with database...');

  let initialized = 0;
  let updated = 0;
  let errors = 0;

  for (const guild of Array.from(client.guilds.cache.values())) {
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
    } catch (err) {
      error(`❌ Error syncing guild ${guild.name}:`, err);
      errors++;
    }
  }

  info(`✅ Database sync complete!`);
  info(`   ├─ New guilds added: ${initialized}`);
  info(`   ├─ Existing guilds updated: ${updated}`);
  info(`   └─ Errors: ${errors}`);
  debug('');

  // Final startup message
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info('✨ TERA BOT IS READY!');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info('🚀 All systems operational');
  info('🎮 Watching for commands and events');
  info(`⏰ Ready at: ${new Date().toLocaleString()}`);
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('\n');

  startStreamMonitor(client);
}
