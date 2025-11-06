import { Guild, Role, PermissionFlagsBits } from 'discord.js';
import { storage } from '../../storage';
import { info, error, debug } from '../../utils/logger';

export async function guildCreateHandler(guild: Guild) {
  try {
    info(`✨ Bot joined new server: ${guild.name} (ID: ${guild.id})`);
    info(`   📊 Members: ${guild.memberCount}`);
    info(`   👑 Owner: ${guild.ownerId}`);
    debug(`🔍 Guild Create Event Details:`);

    // Create bot role
    let botRole: Role | null = null;
    try {
      debug(`🔧 Creating bot role for ${guild.name}...`);
      botRole = await guild.roles.create({
        name: 'Tera Bot',
        color: 0x4caf50, // Green color
        hoist: true, // Show separately in member list
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
      info(`   ✅ Bot role created: "${botRole.name}" (Color: #${botRole.color.toString(16).padStart(6, '0').toUpperCase()})`);

      // Assign the role to the bot
      const botMember = guild.members.cache.get(guild.client.user?.id || '');
      if (botMember && botRole) {
        await botMember.roles.add(botRole);
        debug(`   ✅ Bot role assigned to Tera Bot`);
      }
    } catch (roleErr) {
      error(`   ⚠️ Could not create bot role:`, roleErr);
    }

    // Check if server already exists in database
    const existingServer = await storage.getDiscordServer(guild.id);
    
    if (existingServer) {
      info(`   ℹ️ Server already in database, updating...`);
      // Server already exists, just make sure it's marked as active
      await storage.updateDiscordServer(guild.id, {
        name: guild.name,
        ownerId: guild.ownerId,
      });
    } else {
      // Create new server entry
      info(`   ➕ Creating new server entry...`);
      const createdServer = await storage.createDiscordServer({
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
      });
      debug(`   ✅ Server created in database with ID: ${createdServer.id}`);
    }

    // Get the system channel (usually #general or similar)
    const systemChannel = guild.systemChannel;
    
    if (systemChannel && systemChannel.isSendable()) {
      try {
        await systemChannel.send({
          content: `👋 **Hello ${guild.name}!** I'm Tera Bot 2.0\n\nThank you for adding me! 🎉\n\nUse **/help** to see all available commands or type **/gamehelp** for game lookup features.\n\n**Quick Features:**\n🎮 Game Lookup - Search for games with detailed info\n🎤 Voice XP - Gain XP by spending time in voice channels\n📊 Leveling System - Track your progression\n🎟️ Moderation Tools - Manage your server\n\nHave fun! 🚀`,
        });
        debug(`   ✅ Welcome message sent to system channel`);
      } catch (err) {
        error(`❌ Could not send welcome message to ${guild.name}:`, err);
      }
    } else {
      debug(`   ℹ️ System channel not available or not sendable`);
    }

    info(`✅ Successfully registered server: ${guild.name}`);
  } catch (err) {
    error(`❌ Error handling guild creation for ${guild.name}:`, err);
    debug(`   Error details: ${JSON.stringify(err, null, 2)}`);
  }
}
