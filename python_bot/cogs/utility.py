import discord
from discord.ext import commands
from discord import app_commands
from datetime import datetime, timezone

class UtilityCog(commands.Cog):
    """Utility commands for server information and user stats"""
    
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="serverinfo", description="Display server information")
    async def serverinfo(self, interaction: discord.Interaction):
        """Display detailed server information"""
        
        guild = interaction.guild
        
        # Get channel counts
        text_channels = len([c for c in guild.channels if isinstance(c, discord.TextChannel)])
        voice_channels = len([c for c in guild.channels if isinstance(c, discord.VoiceChannel)])
        categories = len(guild.categories)
        
        # Get member counts
        total_members = guild.member_count
        humans = len([m for m in guild.members if not m.bot])
        bots = len([m for m in guild.members if m.bot])
        
        # Create embed
        embed = discord.Embed(
            title="📊 Server Information",
            color=discord.Color.blue()
        )
        
        # Add server icon if available
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
        
        # Basic info
        embed.add_field(name="Server Name", value=guild.name, inline=True)
        embed.add_field(name="Server ID", value=guild.id, inline=True)
        embed.add_field(name="Owner", value=guild.owner.mention if guild.owner else "Unknown", inline=True)
        
        # Creation date
        created_timestamp = int(guild.created_at.timestamp())
        embed.add_field(name="Created", value=f"<t:{created_timestamp}:F>", inline=True)
        
        # Member info
        embed.add_field(
            name="Members", 
            value=f"{total_members} total\n{humans} humans\n{bots} bots", 
            inline=True
        )
        
        # Channel info
        embed.add_field(
            name="Channels",
            value=f"{text_channels} text\n{voice_channels} voice\n{categories} categories",
            inline=True
        )
        
        # Boost info
        embed.add_field(name="Boost Level", value=f"Level {guild.premium_tier}", inline=True)
        embed.add_field(name="Boosts", value=guild.premium_subscription_count or 0, inline=True)
        embed.add_field(name="Verification Level", value=guild.verification_level.name.title(), inline=True)
        
        # Features
        if guild.features:
            features = [feature.replace('_', ' ').title() for feature in guild.features[:5]]
            if len(guild.features) > 5:
                features.append(f"... and {len(guild.features) - 5} more")
            embed.add_field(name="Features", value="\n".join(features), inline=False)
        
        embed.set_footer(text=f"Requested by {interaction.user}")
        embed.timestamp = datetime.utcnow()
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="level", description="Check your or another user's level")
    @app_commands.describe(user="The user to check (optional)")
    async def level(self, interaction: discord.Interaction, user: discord.Member = None):
        """Check level and XP information for a user"""
        
        target_user = user or interaction.user
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get server member data
                member_data = await conn.fetchrow("""
                    SELECT xp, level, message_count, voice_time
                    FROM server_members 
                    WHERE server_id = $1 AND user_id = $2
                """, str(interaction.guild.id), str(target_user.id))
                
                if not member_data:
                    await interaction.response.send_message(
                        f"❌ {target_user.mention} is not tracked in the leveling system yet.",
                        ephemeral=True
                    )
                    return
                
                xp = member_data['xp']
                level = member_data['level']
                message_count = member_data['message_count']
                voice_time = member_data['voice_time']
                
                # Calculate XP needed for next level
                xp_for_next_level = (level + 1) ** 2 * 100
                xp_for_current_level = level ** 2 * 100
                xp_needed = xp_for_next_level - xp
                progress_xp = xp - xp_for_current_level
                total_xp_for_level = xp_for_next_level - xp_for_current_level
                progress_percent = int((progress_xp / total_xp_for_level) * 100) if total_xp_for_level > 0 else 0
                
                # Create embed
                embed = discord.Embed(
                    title=f"{target_user.display_name}'s Level",
                    color=discord.Color.green()
                )
                
                embed.set_thumbnail(url=target_user.display_avatar.url)
                
                embed.add_field(name="Level", value=level, inline=True)
                embed.add_field(name="XP", value=f"{xp:,}", inline=True)
                embed.add_field(name="XP to Next Level", value=f"{xp_needed:,}", inline=True)
                
                embed.add_field(name="Messages Sent", value=f"{message_count:,}", inline=True)
                
                # Format voice time
                hours = voice_time // 60
                minutes = voice_time % 60
                embed.add_field(name="Voice Time", value=f"{hours}h {minutes}m", inline=True)
                
                embed.add_field(name="Progress", value=f"{progress_percent}%", inline=True)
                
                # Progress bar
                progress_bar_length = 20
                filled_length = int(progress_bar_length * (progress_percent / 100))
                bar = "█" * filled_length + "░" * (progress_bar_length - filled_length)
                embed.add_field(name="Progress Bar", value=f"`{bar}`", inline=False)
                
                embed.timestamp = datetime.utcnow()
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error fetching level data: {e}")
            await interaction.response.send_message("❌ An error occurred while fetching level data!", ephemeral=True)
    
    @app_commands.command(name="memberinfo", description="Display detailed information about a server member")
    @app_commands.describe(member="The member to get information about")
    @app_commands.default_permissions(moderate_members=True)
    async def memberinfo(self, interaction: discord.Interaction, member: discord.Member):
        """Display detailed information about a server member"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            # Defer response since we're fetching from database
            await interaction.response.defer()
            
            async with self.bot.db_pool.acquire() as conn:
                # Get member data from database
                member_data = await conn.fetchrow("""
                    SELECT text_xp, text_level, voice_xp, voice_level, global_level, 
                           message_count, voice_time, joined_at
                    FROM server_members 
                    WHERE server_id = $1 AND user_id = $2
                """, str(interaction.guild.id), str(member.id))
                
                # Calculate account age
                account_age = datetime.now(timezone.utc) - member.created_at
                account_days = account_age.days
                
                # Calculate server membership duration
                if member.joined_at:
                    server_age = datetime.now(timezone.utc) - member.joined_at
                    server_days = server_age.days
                else:
                    server_days = 0
                
                # Create embed
                embed = discord.Embed(
                    title=f"📋 Member Information - {member.name}",
                    color=member.color if member.color != discord.Color.default() else discord.Color.blue()
                )
                
                # Set thumbnail to member avatar
                embed.set_thumbnail(url=member.display_avatar.url)
                
                # Basic Information
                embed.add_field(
                    name="👤 User",
                    value=f"{member.mention}\n`{member.name}`",
                    inline=True
                )
                embed.add_field(
                    name="🆔 User ID",
                    value=f"`{member.id}`",
                    inline=True
                )
                embed.add_field(
                    name="🤖 Account Type",
                    value="Bot" if member.bot else "User",
                    inline=True
                )
                
                # Account & Server Dates
                embed.add_field(
                    name="📅 Account Created",
                    value=f"<t:{int(member.created_at.timestamp())}:F>\n({account_days} days ago)",
                    inline=False
                )
                
                if member.joined_at:
                    embed.add_field(
                        name="📥 Joined Server",
                        value=f"<t:{int(member.joined_at.timestamp())}:F>\n({server_days} days ago)",
                        inline=False
                    )
                
                # Roles (limit to top 10)
                roles = [role.mention for role in member.roles if role.name != "@everyone"]
                if roles:
                    roles_display = ", ".join(roles[:10])
                    if len(roles) > 10:
                        roles_display += f" +{len(roles) - 10} more"
                    embed.add_field(
                        name=f"🎭 Roles ({len(roles)})",
                        value=roles_display,
                        inline=False
                    )
                else:
                    embed.add_field(
                        name="🎭 Roles",
                        value="No roles",
                        inline=False
                    )
                
                # Server Stats (from database)
                if member_data:
                    text_level = member_data['text_level']
                    text_xp = member_data['text_xp']
                    voice_level = member_data['voice_level']
                    voice_xp = member_data['voice_xp']
                    global_level = member_data['global_level']
                    message_count = member_data['message_count']
                    voice_time = member_data['voice_time']
                    
                    # Format voice time
                    voice_hours = voice_time // 60
                    voice_minutes = voice_time % 60
                    
                    embed.add_field(
                        name="📊 Text Stats",
                        value=f"**Level:** {text_level}\n**XP:** {text_xp:,}\n**Messages:** {message_count:,}",
                        inline=True
                    )
                    embed.add_field(
                        name="🎤 Voice Stats",
                        value=f"**Level:** {voice_level}\n**XP:** {voice_xp:,}\n**Time:** {voice_hours}h {voice_minutes}m",
                        inline=True
                    )
                    embed.add_field(
                        name="🌟 Global Level",
                        value=f"**Level:** {global_level}",
                        inline=True
                    )
                else:
                    embed.add_field(
                        name="📊 Server Activity",
                        value="No activity data available",
                        inline=False
                    )
                
                # Status & Activity
                status_emoji = {
                    discord.Status.online: "🟢 Online",
                    discord.Status.idle: "🟡 Idle",
                    discord.Status.dnd: "🔴 Do Not Disturb",
                    discord.Status.offline: "⚫ Offline"
                }
                embed.add_field(
                    name="💬 Status",
                    value=status_emoji.get(member.status, "Unknown"),
                    inline=True
                )
                
                # If member has an activity
                if member.activities:
                    activity = member.activities[0]
                    activity_text = str(activity.name) if hasattr(activity, 'name') else str(activity)
                    embed.add_field(
                        name="🎮 Activity",
                        value=activity_text[:100],
                        inline=True
                    )
                
                # Member permissions
                key_perms = []
                if member.guild_permissions.administrator:
                    key_perms.append("Administrator")
                elif member.guild_permissions.manage_guild:
                    key_perms.append("Manage Server")
                if member.guild_permissions.moderate_members:
                    key_perms.append("Moderate Members")
                if member.guild_permissions.manage_messages:
                    key_perms.append("Manage Messages")
                
                if key_perms:
                    embed.add_field(
                        name="🔑 Key Permissions",
                        value=", ".join(key_perms),
                        inline=False
                    )
                
                embed.set_footer(text=f"Member #{list(interaction.guild.members).index(member) + 1} of {interaction.guild.member_count}")
                embed.timestamp = datetime.now(timezone.utc)
                
                await interaction.followup.send(embed=embed)
                
        except Exception as e:
            print(f"Error fetching member info: {e}")
            await interaction.followup.send("❌ An error occurred while fetching member information!", ephemeral=True)
    
    @app_commands.command(name="help", description="Display all available bot commands")
    async def help_command(self, interaction: discord.Interaction):
        """Display comprehensive help information"""
        
        embed = discord.Embed(
            title="📚 Bot Commands Guide",
            description="Here's a complete list of all available commands organized by category.",
            color=discord.Color.blue()
        )
        
        # Moderation Commands
        embed.add_field(
            name="⚖️ Moderation Commands",
            value=(
                "`/kick <member> [reason]` - Kick a member from the server\n"
                "`/ban <member> [reason]` - Ban a member from the server\n"
                "`/mute <member> <duration> [reason]` - Timeout a member\n"
                "`/clear <amount>` - Delete multiple messages\n"
                "**Example:** `/mute @User duration:1h reason:Spam`"
            ),
            inline=False
        )
        
        # Anti-Invite System
        embed.add_field(
            name="🔗 Anti-Invite System",
            value=(
                "`/antiinvite <enabled> [log_channel]` - Enable/disable auto-removal of external invites\n"
                "`/antiinvite-bypass <role> <action>` - Add/remove bypass roles\n"
                "**Example:** `/antiinvite enabled:True log_channel:#mod-logs`"
            ),
            inline=False
        )
        
        # Leveling System
        embed.add_field(
            name="📊 Leveling System",
            value=(
                "`/level [user]` - Check your or someone's level and XP\n"
                "`/rank [user]` - View detailed rank card with all stats\n"
                "`/leaderboard [type]` - View top members (text/voice/global)\n"
                "`/addxp <user> <amount>` - Add XP to a user (Admin only)\n"
                "**Example:** `/leaderboard type:global`"
            ),
            inline=False
        )
        
        # Welcome & Logging
        embed.add_field(
            name="👋 Welcome & Logging",
            value=(
                "`/setupwelcome <channel> [message]` - Set up welcome messages\n"
                "`/setupwelcomelog <channel>` - Set staff log channel for join/leave\n"
                "**Example:** `/setupwelcome channel:#welcome message:Welcome {user}!`"
            ),
            inline=False
        )
        
        # Tickets
        embed.add_field(
            name="🎫 Ticket System",
            value=(
                "`/setupticket <channel> <category>` - Set up ticket system\n"
                "`/ticket <subject>` - Create a support ticket\n"
                "`/closeticket` - Close the current ticket\n"
                "`/assignticket <member>` - Assign a ticket to support member\n"
                "`/ticketlist` - View all open tickets\n"
                "**Example:** `/ticket subject:Need help with roles`"
            ),
            inline=False
        )
        
        # Giveaways
        embed.add_field(
            name="🎉 Giveaway System",
            value=(
                "`/giveaway <duration> <winners> <prize>` - Start a giveaway\n"
                "`/gend <message_id>` - End a giveaway early\n"
                "`/glist` - List active giveaways\n"
                "**Example:** `/giveaway duration:1h winners:3 prize:Nitro`"
            ),
            inline=False
        )
        
        # Role Reactions
        embed.add_field(
            name="🎭 Role Reactions",
            value=(
                "`/reactionrole <message_id> <emoji> <role> [channel]` - Set up self-assignable roles\n"
                "`/removereactionrole <message_id> <emoji> [channel]` - Remove a reaction role\n"
                "`/listreactionroles` - List all reaction roles in server\n"
                "**Example:** `/reactionrole message_id:123456 emoji:🎮 role:@Gamer`"
            ),
            inline=False
        )
        
        # Stream Notifications
        embed.add_field(
            name="📺 Stream Notifications",
            value=(
                "`/streamadd <platform> <username> <channel>` - Track a streamer\n"
                "`/streamremove <username>` - Stop tracking a streamer\n"
                "`/streamlist` - View all tracked streamers\n"
                "**Example:** `/streamadd platform:twitch username:ninja channel:#streams`"
            ),
            inline=False
        )
        
        # Embed Builder
        embed.add_field(
            name="📝 Embed Builder",
            value=(
                "`/embed <channel> [save_name]` - Create a custom embed interactively\n"
                "`/embedjson <channel> <json_data> [save_name]` - Create embed from JSON\n"
                "`/embedsave <name> <json_data>` - Save an embed template\n"
                "`/embeduse <name> <channel>` - Send a saved embed template\n"
                "`/embedlist` - View all saved embed templates\n"
                "`/embeddelete <name>` - Delete a saved embed template\n"
                "**Example:** `/embed channel:#announcements save_name:welcome`"
            ),
            inline=False
        )
        
        # Utility Commands
        embed.add_field(
            name="🔧 Utility Commands",
            value=(
                "`/serverinfo` - Display server information\n"
                "`/memberinfo <member>` - View detailed member info (Staff only)\n"
                "`/ping` - Check bot latency\n"
                "`/help` - Display this help message\n"
                "**Example:** `/memberinfo member:@User`"
            ),
            inline=False
        )
        
        embed.set_footer(text="💡 Tip: Use Tab to auto-complete commands | Commands marked (Admin/Staff only) require special permissions")
        embed.timestamp = datetime.now(timezone.utc)
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="ping", description="Check bot latency")
    async def ping(self, interaction: discord.Interaction):
        """Check the bot's latency"""
        
        latency = round(self.bot.latency * 1000)
        
        embed = discord.Embed(
            title="🏓 Pong!",
            description=f"Bot latency: `{latency}ms`",
            color=discord.Color.green() if latency < 100 else discord.Color.yellow() if latency < 200 else discord.Color.red()
        )
        
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(UtilityCog(bot))