import discord
from discord.ext import commands
from discord import app_commands
from datetime import datetime, timezone

class EventsCog(commands.Cog):
    """Event handlers for guild and member events"""
    
    def __init__(self, bot):
        self.bot = bot
        self.voice_sessions = {}  # Track voice session start times: {user_id: join_timestamp}
    
    @app_commands.command(name="setupwelcomelog", description="Set the staff log channel for member join/leave logs")
    @app_commands.describe(channel="The channel where staff logs will be sent")
    @app_commands.default_permissions(administrator=True)
    async def setup_welcome_log(self, interaction: discord.Interaction, channel: discord.TextChannel):
        """Set the staff log channel for member join/leave logs"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Ensure server exists in database
                await conn.execute("""
                    INSERT INTO discord_servers (id, name, owner_id, member_count, is_active)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        member_count = EXCLUDED.member_count
                """, str(interaction.guild.id), interaction.guild.name, 
                     str(interaction.guild.owner_id), interaction.guild.member_count, True)
                
                # Update staff log channel
                await conn.execute("""
                    UPDATE discord_servers 
                    SET staff_log_channel_id = $1
                    WHERE id = $2
                """, str(channel.id), str(interaction.guild.id))
                
                embed = discord.Embed(
                    title="✅ Staff Log Channel Set",
                    description=f"Member join/leave logs will now be sent to {channel.mention}",
                    color=discord.Color.green()
                )
                
                await interaction.response.send_message(embed=embed)
                print(f"Set staff log channel to {channel.name} in {interaction.guild.name}")
                
        except Exception as e:
            print(f"Error setting staff log channel: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while setting the staff log channel!",
                ephemeral=True
            )
    
    @commands.Cog.listener()
    async def on_guild_join(self, guild):
        """Called when the bot joins a new guild"""
        print(f"Joined new guild: {guild.name} (ID: {guild.id})")
        
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if guild already exists
                existing = await conn.fetchrow(
                    "SELECT id FROM discord_servers WHERE id = $1", 
                    str(guild.id)
                )
                
                if not existing:
                    # Create new guild entry
                    await conn.execute("""
                        INSERT INTO discord_servers 
                        (id, name, owner_id, member_count, is_active)
                        VALUES ($1, $2, $3, $4, $5)
                    """, str(guild.id), guild.name, str(guild.owner_id), 
                         guild.member_count, True)
                    
                    print(f"Added guild {guild.name} to database")
                
        except Exception as e:
            print(f"Error adding guild to database: {e}")
    
    @commands.Cog.listener()
    async def on_guild_remove(self, guild):
        """Called when the bot leaves a guild"""
        print(f"Left guild: {guild.name} (ID: {guild.id})")
        
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Mark guild as inactive
                await conn.execute(
                    "UPDATE discord_servers SET is_active = $1 WHERE id = $2",
                    False, str(guild.id)
                )
                
        except Exception as e:
            print(f"Error updating guild in database: {e}")
    
    @commands.Cog.listener()
    async def on_member_join(self, member):
        """Called when a new member joins a guild"""
        print(f"New member joined {member.guild.name}: {member}")
        
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get server settings
                server_data = await conn.fetchrow("""
                    SELECT welcome_channel_id, welcome_message, staff_log_channel_id
                    FROM discord_servers 
                    WHERE id = $1
                """, str(member.guild.id))
                
                # Create or update Discord user
                await conn.execute("""
                    INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        discriminator = EXCLUDED.discriminator,
                        avatar = EXCLUDED.avatar
                """, str(member.id), member.name, member.discriminator, 
                     member.avatar.key if member.avatar else None, member.bot)
                
                # Create server member record
                await conn.execute("""
                    INSERT INTO server_members (server_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (server_id, user_id) DO NOTHING
                """, str(member.guild.id), str(member.id))
                
                # Send public welcome message (only for non-bots)
                if server_data and server_data['welcome_channel_id'] and not member.bot:
                    channel = member.guild.get_channel(int(server_data['welcome_channel_id']))
                    if channel and isinstance(channel, discord.TextChannel):
                        welcome_message = server_data['welcome_message'] or \
                            f"Welcome to the server, {member.mention}! We're excited to have you here!"
                        
                        embed = discord.Embed(
                            title="👋 Welcome to the Server!",
                            description=welcome_message,
                            color=discord.Color.blue()
                        )
                        embed.set_thumbnail(url=member.display_avatar.url)
                        embed.add_field(
                            name="📋 Server Rules", 
                            value="Check out the rules channel for guidelines", 
                            inline=True
                        )
                        embed.add_field(
                            name="💬 Get Started", 
                            value="Introduce yourself and start chatting!", 
                            inline=True
                        )
                        embed.add_field(
                            name="🎮 Have Fun", 
                            value="Join voice channels and participate in activities", 
                            inline=True
                        )
                        embed.set_footer(text=f"Member #{member.guild.member_count}")
                        
                        try:
                            await channel.send(f"Welcome {member.mention}!", embed=embed)
                        except discord.Forbidden:
                            print(f"Cannot send welcome message in {channel.name}")
                
                # Send staff log
                if server_data and server_data['staff_log_channel_id']:
                    log_channel = member.guild.get_channel(int(server_data['staff_log_channel_id']))
                    if log_channel and isinstance(log_channel, discord.TextChannel):
                        # Calculate account age
                        account_age = datetime.now(timezone.utc) - member.created_at
                        days_old = account_age.days
                        
                        # Determine account type
                        account_type = "🤖 Bot" if member.bot else "👤 User"
                        
                        # Build staff log embed
                        log_embed = discord.Embed(
                            title="📥 Member Joined",
                            color=discord.Color.green(),
                            timestamp=datetime.now(timezone.utc)
                        )
                        log_embed.set_thumbnail(url=member.display_avatar.url)
                        log_embed.add_field(
                            name="Member",
                            value=f"{member.mention} ({member})",
                            inline=False
                        )
                        log_embed.add_field(
                            name="Account Type",
                            value=account_type,
                            inline=True
                        )
                        log_embed.add_field(
                            name="Account Created",
                            value=f"<t:{int(member.created_at.timestamp())}:R>\n({days_old} days old)",
                            inline=True
                        )
                        log_embed.add_field(
                            name="User ID",
                            value=f"`{member.id}`",
                            inline=True
                        )
                        log_embed.add_field(
                            name="Server Stats",
                            value=f"**Total Members:** {member.guild.member_count}\n**Total Bots:** {sum(1 for m in member.guild.members if m.bot)}\n**Total Users:** {sum(1 for m in member.guild.members if not m.bot)}",
                            inline=False
                        )
                        log_embed.set_footer(text=f"Member #{member.guild.member_count}")
                        
                        try:
                            await log_channel.send(embed=log_embed)
                        except discord.Forbidden:
                            print(f"Cannot send staff log in {log_channel.name}")
                
                # Update server member count
                await conn.execute(
                    "UPDATE discord_servers SET member_count = $1 WHERE id = $2",
                    member.guild.member_count, str(member.guild.id)
                )
                
        except Exception as e:
            print(f"Error handling member join: {e}")
    
    @commands.Cog.listener()
    async def on_member_remove(self, member):
        """Called when a member leaves a guild"""
        print(f"Member left {member.guild.name}: {member}")
        
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get server settings for staff log
                server_data = await conn.fetchrow("""
                    SELECT staff_log_channel_id
                    FROM discord_servers 
                    WHERE id = $1
                """, str(member.guild.id))
                
                # Update server member record (mark as left)
                await conn.execute("""
                    UPDATE server_members 
                    SET left_at = NOW() 
                    WHERE server_id = $1 AND user_id = $2 AND left_at IS NULL
                """, str(member.guild.id), str(member.id))
                
                # Send staff log
                if server_data and server_data['staff_log_channel_id']:
                    log_channel = member.guild.get_channel(int(server_data['staff_log_channel_id']))
                    if log_channel and isinstance(log_channel, discord.TextChannel):
                        # Calculate account age
                        account_age = datetime.now(timezone.utc) - member.created_at
                        days_old = account_age.days
                        
                        # Determine account type
                        account_type = "🤖 Bot" if member.bot else "👤 User"
                        
                        # Get member's roles (excluding @everyone)
                        roles = [role.mention for role in member.roles if role.name != "@everyone"]
                        roles_display = ", ".join(roles[:10]) if roles else "No roles"
                        if len(roles) > 10:
                            roles_display += f" +{len(roles) - 10} more"
                        
                        # Build staff log embed
                        log_embed = discord.Embed(
                            title="📤 Member Left",
                            color=discord.Color.red(),
                            timestamp=datetime.now(timezone.utc)
                        )
                        log_embed.set_thumbnail(url=member.display_avatar.url)
                        log_embed.add_field(
                            name="Member",
                            value=f"{member.mention} ({member})",
                            inline=False
                        )
                        log_embed.add_field(
                            name="Account Type",
                            value=account_type,
                            inline=True
                        )
                        log_embed.add_field(
                            name="Account Created",
                            value=f"<t:{int(member.created_at.timestamp())}:R>\n({days_old} days old)",
                            inline=True
                        )
                        log_embed.add_field(
                            name="User ID",
                            value=f"`{member.id}`",
                            inline=True
                        )
                        log_embed.add_field(
                            name="Roles",
                            value=roles_display,
                            inline=False
                        )
                        log_embed.add_field(
                            name="Server Stats",
                            value=f"**Total Members:** {member.guild.member_count}\n**Total Bots:** {sum(1 for m in member.guild.members if m.bot)}\n**Total Users:** {sum(1 for m in member.guild.members if not m.bot)}",
                            inline=False
                        )
                        log_embed.set_footer(text=f"Member #{member.guild.member_count}")
                        
                        try:
                            await log_channel.send(embed=log_embed)
                        except discord.Forbidden:
                            print(f"Cannot send staff log in {log_channel.name}")
                
                # Update server member count
                await conn.execute(
                    "UPDATE discord_servers SET member_count = $1 WHERE id = $2",
                    member.guild.member_count, str(member.guild.id)
                )
                
        except Exception as e:
            print(f"Error handling member leave: {e}")
    
    @commands.Cog.listener()
    async def on_message(self, message):
        """Called when a message is sent (for XP tracking)"""
        # Ignore bots and DMs
        if message.author.bot or not message.guild:
            return
        
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Ensure user exists in discord_users table
                await conn.execute("""
                    INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        discriminator = EXCLUDED.discriminator,
                        avatar = EXCLUDED.avatar
                """, str(message.author.id), message.author.name, message.author.discriminator, 
                     message.author.avatar.key if message.author.avatar else None, message.author.bot)
                
                # Ensure member exists in server_members table
                await conn.execute("""
                    INSERT INTO server_members (server_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (server_id, user_id) DO NOTHING
                """, str(message.guild.id), str(message.author.id))
                
                # Update message count and add text XP
                text_xp_gain = 5  # Base XP per message
                
                result = await conn.fetchrow("""
                    UPDATE server_members 
                    SET message_count = message_count + 1,
                        text_xp = text_xp + $3,
                        xp = xp + $3
                    WHERE server_id = $1 AND user_id = $2
                    RETURNING text_xp, text_level, voice_level
                """, str(message.guild.id), str(message.author.id), text_xp_gain)
                
                if result:
                    new_text_xp = result['text_xp']
                    current_text_level = result['text_level']
                    current_voice_level = result['voice_level']
                    
                    # Calculate what text level they should be
                    new_text_level = int((new_text_xp / 100) ** 0.5)  # Simple level formula
                    
                    if new_text_level > current_text_level:
                        # Calculate global level (average of text and voice)
                        global_level = int((new_text_level + current_voice_level) / 2)
                        
                        # Level up!
                        await conn.execute("""
                            UPDATE server_members 
                            SET text_level = $3, level = $3, global_level = $4
                            WHERE server_id = $1 AND user_id = $2
                        """, str(message.guild.id), str(message.author.id), new_text_level, global_level)
                        
                        # Send level up message
                        embed = discord.Embed(
                            title="🎉 Text Level Up!",
                            description=f"{message.author.mention} reached text level **{new_text_level}**! (Global: {global_level})",
                            color=discord.Color.gold()
                        )
                        
                        try:
                            await message.channel.send(embed=embed)
                        except discord.Forbidden:
                            pass  # Can't send message in this channel
                
        except Exception as e:
            print(f"Error tracking message XP: {e}")
    
    @commands.Cog.listener()
    async def on_voice_state_update(self, member, before, after):
        """Called when a member's voice state changes (for voice time tracking)"""
        if member.bot:
            return
        
        if not self.bot.db_pool:
            return
        
        try:
            # User joined a voice channel
            if before.channel is None and after.channel is not None:
                self.voice_sessions[str(member.id)] = datetime.now(timezone.utc)
                print(f"{member} joined voice channel: {after.channel.name}")
            
            # User left a voice channel
            elif before.channel is not None and after.channel is None:
                if str(member.id) in self.voice_sessions:
                    join_time = self.voice_sessions[str(member.id)]
                    leave_time = datetime.now(timezone.utc)
                    duration_minutes = int((leave_time - join_time).total_seconds() / 60)
                    
                    if duration_minutes > 0:
                        # Calculate voice XP (10 XP per minute)
                        voice_xp_gain = duration_minutes * 10
                        
                        async with self.bot.db_pool.acquire() as conn:
                            # Ensure user exists in discord_users table
                            await conn.execute("""
                                INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                                VALUES ($1, $2, $3, $4, $5)
                                ON CONFLICT (id) DO UPDATE SET
                                    username = EXCLUDED.username,
                                    discriminator = EXCLUDED.discriminator,
                                    avatar = EXCLUDED.avatar
                            """, str(member.id), member.name, member.discriminator, 
                                 member.avatar.key if member.avatar else None, member.bot)
                            
                            # Ensure member exists in server_members table
                            await conn.execute("""
                                INSERT INTO server_members (server_id, user_id)
                                VALUES ($1, $2)
                                ON CONFLICT (server_id, user_id) DO NOTHING
                            """, str(member.guild.id), str(member.id))
                            
                            # Update voice time and XP
                            result = await conn.fetchrow("""
                                UPDATE server_members 
                                SET voice_time = voice_time + $3,
                                    voice_xp = voice_xp + $4
                                WHERE server_id = $1 AND user_id = $2
                                RETURNING voice_xp, voice_level
                            """, str(member.guild.id), str(member.id), duration_minutes, voice_xp_gain)
                            
                            if result:
                                new_voice_xp = result['voice_xp']
                                current_voice_level = result['voice_level']
                                
                                # Calculate what voice level they should be
                                new_voice_level = int((new_voice_xp / 60) ** 0.5)  # Level up every ~60 minutes at level 1
                                
                                if new_voice_level > current_voice_level:
                                    # Calculate global level (combined text and voice)
                                    member_data = await conn.fetchrow("""
                                        SELECT text_level FROM server_members
                                        WHERE server_id = $1 AND user_id = $2
                                    """, str(member.guild.id), str(member.id))
                                    
                                    text_level = member_data['text_level'] if member_data else 1
                                    global_level = int((text_level + new_voice_level) / 2)  # Average of both
                                    
                                    # Update levels
                                    await conn.execute("""
                                        UPDATE server_members 
                                        SET voice_level = $3, global_level = $4
                                        WHERE server_id = $1 AND user_id = $2
                                    """, str(member.guild.id), str(member.id), new_voice_level, global_level)
                                    
                                    print(f"{member} reached voice level {new_voice_level}!")
                    
                    del self.voice_sessions[str(member.id)]
                    print(f"{member} left voice channel: {before.channel.name} (Duration: {duration_minutes} min)")
            
            # User switched voice channels - save time from previous channel and start tracking new one
            elif before.channel != after.channel and before.channel is not None and after.channel is not None:
                if str(member.id) in self.voice_sessions:
                    # Calculate time spent in previous channel
                    join_time = self.voice_sessions[str(member.id)]
                    switch_time = datetime.now(timezone.utc)
                    duration_minutes = int((switch_time - join_time).total_seconds() / 60)
                    
                    if duration_minutes > 0:
                        voice_xp_gain = duration_minutes * 10
                        
                        async with self.bot.db_pool.acquire() as conn:
                            # Ensure user exists in discord_users table
                            await conn.execute("""
                                INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                                VALUES ($1, $2, $3, $4, $5)
                                ON CONFLICT (id) DO UPDATE SET
                                    username = EXCLUDED.username,
                                    discriminator = EXCLUDED.discriminator,
                                    avatar = EXCLUDED.avatar
                            """, str(member.id), member.name, member.discriminator, 
                                 member.avatar.key if member.avatar else None, member.bot)
                            
                            # Ensure member exists in server_members table
                            await conn.execute("""
                                INSERT INTO server_members (server_id, user_id)
                                VALUES ($1, $2)
                                ON CONFLICT (server_id, user_id) DO NOTHING
                            """, str(member.guild.id), str(member.id))
                            
                            # Update voice time and XP
                            result = await conn.fetchrow("""
                                UPDATE server_members 
                                SET voice_time = voice_time + $3,
                                    voice_xp = voice_xp + $4
                                WHERE server_id = $1 AND user_id = $2
                                RETURNING voice_xp, voice_level
                            """, str(member.guild.id), str(member.id), duration_minutes, voice_xp_gain)
                            
                            if result:
                                new_voice_xp = result['voice_xp']
                                current_voice_level = result['voice_level']
                                
                                # Calculate what voice level they should be
                                new_voice_level = int((new_voice_xp / 60) ** 0.5)
                                
                                if new_voice_level > current_voice_level:
                                    # Calculate global level (combined text and voice)
                                    member_data = await conn.fetchrow("""
                                        SELECT text_level FROM server_members
                                        WHERE server_id = $1 AND user_id = $2
                                    """, str(member.guild.id), str(member.id))
                                    
                                    text_level = member_data['text_level'] if member_data else 1
                                    global_level = int((text_level + new_voice_level) / 2)
                                    
                                    # Update levels
                                    await conn.execute("""
                                        UPDATE server_members 
                                        SET voice_level = $3, global_level = $4
                                        WHERE server_id = $1 AND user_id = $2
                                    """, str(member.guild.id), str(member.id), new_voice_level, global_level)
                                    
                                    print(f"{member} reached voice level {new_voice_level}!")
                        
                        print(f"{member} switched from {before.channel.name} to {after.channel.name} (Saved {duration_minutes} min)")
                    
                    # Update join time to now for the new channel
                    self.voice_sessions[str(member.id)] = datetime.now(timezone.utc)
                else:
                    # No previous session tracked, start tracking now
                    self.voice_sessions[str(member.id)] = datetime.now(timezone.utc)
                    print(f"{member} switched from {before.channel.name} to {after.channel.name} (Started tracking)")
                
        except Exception as e:
            print(f"Error tracking voice state: {e}")

async def setup(bot):
    await bot.add_cog(EventsCog(bot))