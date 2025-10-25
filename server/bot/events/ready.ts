import { Client, Events } from 'discord.js';
import { storage } from '../../storage';
import { pool } from '../../db';
import { info, debug, warn, error } from '../../utils/logger';

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

  // Auto-create bot roles in all guilds
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('🎨 ROLE INITIALIZATION');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let rolesCreated = 0;
  let rolesAssigned = 0;
  let skipCount = 0;
  
  for (const guild of client.guilds.cache.values()) {
    try {
      debug(`   🔍 Checking guild: ${guild.name} (ID: ${guild.id})`);
      
      const botId = client.user?.id;
      if (!botId) {
        debug(`   ⚠️ Bot ID not available, skipping...`);
        skipCount++;
        continue;
      }
      
      // Fetch bot member to ensure they're in cache
      const botMember = await guild.members.fetch(botId).catch((err) => {
        debug(`   ⚠️ Could not fetch bot member: ${err.message}`);
        return null;
      });
      
      if (!botMember) {
        debug(`   ⚠️ Bot member not found in guild, skipping...`);
        skipCount++;
        continue;
      }

      debug(`   ✅ Bot member found: ${botMember.user.tag}`);
      
      // Get bot's highest role position
      const botHighestRole = botMember.roles.highest;
      debug(`   Bot highest role position: ${botHighestRole.position} (${botHighestRole.name})`);
      
      // Check bot permissions
      const canManageRoles = botMember.permissions.has('ManageRoles');
      debug(`   Bot can manage roles: ${canManageRoles}`);
      
      if (!canManageRoles) {
        debug(`   ⚠️ Bot doesn't have MANAGE_ROLES permission, skipping...`);
        skipCount++;
        continue;
      }

      // Check if bot already has a "Tera Bot" role
      const existingRole = guild.roles.cache.find(r => r.name === 'Tera Bot');
      
      if (existingRole) {
        debug(`   Found existing Tera Bot role at position ${existingRole.position}`);
        
        // Check if role is manageable by bot (must be below bot's highest role)
        if (existingRole.position >= botHighestRole.position) {
          debug(`   ⚠️ Tera Bot role is at or above bot's highest role, cannot manage`);
          debug(`   ℹ️ Note: The Tera Bot role may have been created by someone else or moved above the bot`);
          skipCount++;
          continue;
        }
        
        // Now assign the role
        if (!botMember.roles.cache.has(existingRole.id)) {
          await botMember.roles.add(existingRole);
          rolesAssigned++;
          debug(`   ✅ Assigned existing role to bot`);
        } else {
          debug(`   ℹ️ Bot already has Tera Bot role`);
        }
      } else {
        // Create new role BELOW the bot's highest role
        const { PermissionFlagsBits } = await import('discord.js');
        debug(`   📝 Creating new Tera Bot role...`);
        
        const newRole = await guild.roles.create({
          name: 'Tera Bot',
          color: 0x4caf50, // Green
          hoist: true,
          mentionable: false,
          permissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendTTSMessages,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.MentionEveryone,
          ],
        });
        
        debug(`   ✅ Role created: ${newRole.name} (ID: ${newRole.id}) at position ${newRole.position}`);
        
        // Ensure new role is below bot's highest role  
        if (newRole.position >= botHighestRole.position) {
          debug(`   ⬇️ Moving new role below bot's highest role...`);
          await newRole.setPosition(botHighestRole.position - 1);
          debug(`   ✅ Role moved to position ${botHighestRole.position - 1}`);
        }
        
        // Assign to bot
        await botMember.roles.add(newRole);
        rolesCreated++;
        debug(`   ✅ Role assigned to bot`);
      }
    } catch (err) {
      error(`   ❌ Error in role setup for ${guild.name}:`, err);
    }
  }
  
  info(`🎨 Role Setup Complete!`);
  info(`   ├─ Roles created: ${rolesCreated}`);
  info(`   ├─ Roles assigned: ${rolesAssigned}`);
  info(`   ├─ Servers skipped: ${skipCount}`);
  info(`   └─ Total servers: ${client.guilds.cache.size}`);
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
}
