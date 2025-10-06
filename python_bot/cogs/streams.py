import discord
from discord.ext import commands, tasks
from discord import app_commands
from datetime import datetime
import aiohttp
import os

class StreamsCog(commands.Cog):
    """Stream notification system for Twitch, YouTube, and Kick"""
    
    def __init__(self, bot):
        self.bot = bot
        self.stream_checks.start()
        self.tracked_streams = {}  # {channel_id: {platform, username, message_id, is_live}}
    
    def cog_unload(self):
        self.stream_checks.cancel()
    
    @tasks.loop(minutes=5)
    async def stream_checks(self):
        """Check all tracked streams every 5 minutes"""
        if not self.bot.db_pool:
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get all tracked streams from database
                streams = await conn.fetch("""
                    SELECT id, server_id, channel_id, platform, username, 
                           message_id, is_live, notification_message
                    FROM stream_notifications
                    WHERE is_active = true
                """)
                
                for stream in streams:
                    await self.check_stream_status(stream)
                    
        except Exception as e:
            print(f"Error checking streams: {e}")
    
    @stream_checks.before_loop
    async def before_stream_checks(self):
        await self.bot.wait_until_ready()
    
    async def check_stream_status(self, stream):
        """Check if a stream is live and update embed"""
        try:
            platform = stream['platform'].lower()
            username = stream['username']
            
            # Check stream status based on platform
            if platform == 'twitch':
                is_live, data = await self.check_twitch(username)
            elif platform == 'youtube':
                is_live, data = await self.check_youtube(username)
            elif platform == 'kick':
                is_live, data = await self.check_kick(username)
            else:
                return
            
            # Get the notification channel
            guild = self.bot.get_guild(int(stream['server_id']))
            if not guild:
                return
            
            channel = guild.get_channel(int(stream['channel_id']))
            if not channel:
                return
            
            # Update database and message
            async with self.bot.db_pool.acquire() as conn:
                if is_live and not stream['is_live']:
                    # Stream just went live
                    embed = self.create_stream_embed(platform, username, data, is_live=True)
                    message = await channel.send(stream['notification_message'] or f"🔴 {username} is now live!", embed=embed)
                    
                    await conn.execute("""
                        UPDATE stream_notifications
                        SET is_live = true, message_id = $1, last_checked = NOW()
                        WHERE id = $2
                    """, str(message.id), stream['id'])
                    
                elif is_live and stream['is_live']:
                    # Stream is still live, update embed
                    if stream['message_id']:
                        try:
                            message = await channel.fetch_message(int(stream['message_id']))
                            embed = self.create_stream_embed(platform, username, data, is_live=True)
                            await message.edit(embed=embed)
                        except discord.NotFound:
                            pass
                    
                    await conn.execute("""
                        UPDATE stream_notifications
                        SET last_checked = NOW()
                        WHERE id = $1
                    """, stream['id'])
                    
                elif not is_live and stream['is_live']:
                    # Stream ended
                    if stream['message_id']:
                        try:
                            message = await channel.fetch_message(int(stream['message_id']))
                            embed = self.create_stream_embed(platform, username, data, is_live=False)
                            await message.edit(embed=embed)
                        except discord.NotFound:
                            pass
                    
                    await conn.execute("""
                        UPDATE stream_notifications
                        SET is_live = false, last_checked = NOW()
                        WHERE id = $1
                    """, stream['id'])
                    
        except Exception as e:
            print(f"Error checking stream {stream['username']}: {e}")
    
    async def check_twitch(self, username):
        """Check if a Twitch stream is live"""
        # Twitch requires OAuth, returning mock data for now
        # In production, you would use the Twitch API with proper credentials
        return False, {}
    
    async def check_youtube(self, username):
        """Check if a YouTube stream is live"""
        # YouTube requires API key, returning mock data for now
        return False, {}
    
    async def check_kick(self, username):
        """Check if a Kick stream is live"""
        # Kick API integration would go here
        return False, {}
    
    def create_stream_embed(self, platform, username, data, is_live=True):
        """Create an embed for stream notification"""
        if is_live:
            title = f"🔴 {username} is LIVE on {platform.title()}!"
            color = discord.Color.red()
            status = "✅ Live"
        else:
            title = f"{username} was streaming on {platform.title()}"
            color = discord.Color.grey()
            status = "❌ Offline"
        
        embed = discord.Embed(
            title=title,
            url=self.get_stream_url(platform, username),
            color=color,
            timestamp=datetime.utcnow()
        )
        
        embed.add_field(name="Status", value=status, inline=True)
        embed.add_field(name="Platform", value=platform.title(), inline=True)
        
        if is_live and data:
            if 'title' in data:
                embed.add_field(name="Stream Title", value=data['title'], inline=False)
            if 'viewers' in data:
                embed.add_field(name="👁️ Viewers", value=str(data['viewers']), inline=True)
            if 'thumbnail' in data:
                embed.set_image(url=data['thumbnail'])
        
        embed.set_footer(text=f"Last updated")
        
        return embed
    
    def get_stream_url(self, platform, username):
        """Get the URL for a stream"""
        urls = {
            'twitch': f'https://twitch.tv/{username}',
            'youtube': f'https://youtube.com/@{username}',
            'kick': f'https://kick.com/{username}'
        }
        return urls.get(platform.lower(), '#')
    
    @app_commands.command(name="streamadd", description="Add a stream to track")
    @app_commands.describe(
        platform="Platform (Twitch, YouTube, or Kick)",
        username="Username of the streamer",
        channel="Channel to send notifications to",
        message="Custom notification message (optional)"
    )
    @app_commands.choices(platform=[
        app_commands.Choice(name="Twitch", value="twitch"),
        app_commands.Choice(name="YouTube", value="youtube"),
        app_commands.Choice(name="Kick", value="kick")
    ])
    @app_commands.default_permissions(manage_guild=True)
    async def stream_add(self, interaction: discord.Interaction, platform: str, 
                        username: str, channel: discord.TextChannel, message: str = None):
        """Add a stream to track"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Ensure server exists
                await conn.execute("""
                    INSERT INTO discord_servers (id, name, owner_id, member_count, is_active)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        member_count = EXCLUDED.member_count
                """, str(interaction.guild.id), interaction.guild.name,
                     str(interaction.guild.owner_id), interaction.guild.member_count, True)
                
                # Add stream notification
                await conn.execute("""
                    INSERT INTO stream_notifications 
                    (server_id, channel_id, platform, username, notification_message, is_active, is_live)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, str(interaction.guild.id), str(channel.id), platform.lower(), 
                     username, message, True, False)
                
                embed = discord.Embed(
                    title="✅ Stream Tracking Added",
                    description=f"Now tracking **{username}** on **{platform}**",
                    color=discord.Color.green()
                )
                embed.add_field(name="Notification Channel", value=channel.mention, inline=False)
                if message:
                    embed.add_field(name="Custom Message", value=message, inline=False)
                
                await interaction.response.send_message(embed=embed)
                print(f"Added stream tracking: {platform}/{username} in {interaction.guild.name}")
                
        except Exception as e:
            print(f"Error adding stream: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while adding the stream!",
                ephemeral=True
            )
    
    @app_commands.command(name="streamlist", description="List all tracked streams")
    async def stream_list(self, interaction: discord.Interaction):
        """List all tracked streams in this server"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                streams = await conn.fetch("""
                    SELECT platform, username, channel_id, is_live, is_active
                    FROM stream_notifications
                    WHERE server_id = $1 AND is_active = true
                    ORDER BY platform, username
                """, str(interaction.guild.id))
                
                if not streams:
                    await interaction.response.send_message(
                        "❌ No streams are being tracked in this server!",
                        ephemeral=True
                    )
                    return
                
                embed = discord.Embed(
                    title="📺 Tracked Streams",
                    description=f"{len(streams)} stream(s) tracked",
                    color=discord.Color.blue()
                )
                
                for stream in streams:
                    channel = interaction.guild.get_channel(int(stream['channel_id']))
                    channel_mention = channel.mention if channel else "Unknown Channel"
                    status = "🔴 LIVE" if stream['is_live'] else "⚫ Offline"
                    
                    embed.add_field(
                        name=f"{stream['platform'].title()}: {stream['username']}",
                        value=f"{status} • {channel_mention}",
                        inline=False
                    )
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error listing streams: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while fetching streams!",
                ephemeral=True
            )
    
    @app_commands.command(name="streamremove", description="Remove a tracked stream")
    @app_commands.describe(
        platform="Platform of the stream",
        username="Username of the streamer"
    )
    @app_commands.choices(platform=[
        app_commands.Choice(name="Twitch", value="twitch"),
        app_commands.Choice(name="YouTube", value="youtube"),
        app_commands.Choice(name="Kick", value="kick")
    ])
    @app_commands.default_permissions(manage_guild=True)
    async def stream_remove(self, interaction: discord.Interaction, platform: str, username: str):
        """Remove a tracked stream"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                result = await conn.execute("""
                    UPDATE stream_notifications
                    SET is_active = false
                    WHERE server_id = $1 AND platform = $2 AND username = $3
                """, str(interaction.guild.id), platform.lower(), username)
                
                if result == "UPDATE 0":
                    await interaction.response.send_message(
                        f"❌ Stream **{username}** on **{platform}** not found!",
                        ephemeral=True
                    )
                    return
                
                embed = discord.Embed(
                    title="✅ Stream Removed",
                    description=f"No longer tracking **{username}** on **{platform}**",
                    color=discord.Color.green()
                )
                
                await interaction.response.send_message(embed=embed)
                print(f"Removed stream tracking: {platform}/{username} in {interaction.guild.name}")
                
        except Exception as e:
            print(f"Error removing stream: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while removing the stream!",
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(StreamsCog(bot))
