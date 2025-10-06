import discord
from discord.ext import commands
from discord import app_commands
import asyncpg
from datetime import datetime, timedelta

class ModerationCog(commands.Cog):
    """Moderation commands for server management"""
    
    def __init__(self, bot):
        self.bot = bot
    
    async def log_moderation_action(self, guild_id: str, moderator_id: str, target_user_id: str, 
                                   action: str, reason: str = None, duration: int = None, 
                                   channel_id: str = None, expires_at: datetime = None):
        """Log moderation action to database"""
        if not self.bot.db_pool:
            return
            
        try:
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO moderation_logs 
                    (server_id, moderator_id, target_user_id, action, reason, duration, channel_id, expires_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """, guild_id, moderator_id, target_user_id, action, reason, duration, channel_id, expires_at)
        except Exception as e:
            print(f"Failed to log moderation action: {e}")
    
    @app_commands.command(name="kick", description="Kick a user from the server")
    @app_commands.describe(
        user="The user to kick",
        reason="Reason for the kick"
    )
    @app_commands.default_permissions(kick_members=True)
    async def kick(self, interaction: discord.Interaction, user: discord.Member, reason: str = "No reason provided"):
        """Kick a user from the server"""
        
        # Check if user can be kicked
        if user.top_role >= interaction.user.top_role:
            await interaction.response.send_message("❌ You cannot kick someone with a higher or equal role!", ephemeral=True)
            return
            
        if user.top_role >= interaction.guild.me.top_role:
            await interaction.response.send_message("❌ I cannot kick this user due to role hierarchy!", ephemeral=True)
            return
        
        try:
            # Send DM to user before kicking
            try:
                dm_embed = discord.Embed(
                    title="You were kicked",
                    description=f"You were kicked from **{interaction.guild.name}**",
                    color=discord.Color.orange()
                )
                dm_embed.add_field(name="Reason", value=reason, inline=False)
                dm_embed.add_field(name="Moderator", value=interaction.user.mention, inline=False)
                await user.send(embed=dm_embed)
            except:
                pass  # User has DMs disabled
            
            # Kick the user
            await user.kick(reason=reason)
            
            # Log to database
            await self.log_moderation_action(
                str(interaction.guild.id),
                str(interaction.user.id),
                str(user.id),
                "kick",
                reason,
                channel_id=str(interaction.channel.id) if interaction.channel else None
            )
            
            # Send confirmation embed
            embed = discord.Embed(
                title="User Kicked",
                description=f"{user.mention} has been kicked from the server",
                color=discord.Color.orange()
            )
            embed.add_field(name="Reason", value=reason, inline=True)
            embed.add_field(name="Moderator", value=interaction.user.mention, inline=True)
            embed.set_footer(text=f"User ID: {user.id}")
            embed.timestamp = datetime.utcnow()
            
            await interaction.response.send_message(embed=embed)
            
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to kick this user!", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="ban", description="Ban a user from the server")
    @app_commands.describe(
        user="The user to ban",
        reason="Reason for the ban",
        delete_messages="Days of messages to delete (0-7)"
    )
    @app_commands.default_permissions(ban_members=True)
    async def ban(self, interaction: discord.Interaction, user: discord.Member, 
                  reason: str = "No reason provided", delete_messages: int = 0):
        """Ban a user from the server"""
        
        if delete_messages < 0 or delete_messages > 7:
            await interaction.response.send_message("❌ Delete messages days must be between 0 and 7!", ephemeral=True)
            return
        
        # Check if user can be banned
        if user.top_role >= interaction.user.top_role:
            await interaction.response.send_message("❌ You cannot ban someone with a higher or equal role!", ephemeral=True)
            return
            
        if user.top_role >= interaction.guild.me.top_role:
            await interaction.response.send_message("❌ I cannot ban this user due to role hierarchy!", ephemeral=True)
            return
        
        try:
            # Send DM to user before banning
            try:
                dm_embed = discord.Embed(
                    title="You were banned",
                    description=f"You were banned from **{interaction.guild.name}**",
                    color=discord.Color.red()
                )
                dm_embed.add_field(name="Reason", value=reason, inline=False)
                dm_embed.add_field(name="Moderator", value=interaction.user.mention, inline=False)
                await user.send(embed=dm_embed)
            except:
                pass  # User has DMs disabled
            
            # Ban the user
            await user.ban(reason=reason, delete_message_days=delete_messages)
            
            # Log to database
            await self.log_moderation_action(
                str(interaction.guild.id),
                str(interaction.user.id),
                str(user.id),
                "ban",
                reason,
                channel_id=str(interaction.channel.id) if interaction.channel else None
            )
            
            # Send confirmation embed
            embed = discord.Embed(
                title="User Banned",
                description=f"{user.mention} has been banned from the server",
                color=discord.Color.red()
            )
            embed.add_field(name="Reason", value=reason, inline=True)
            embed.add_field(name="Moderator", value=interaction.user.mention, inline=True)
            if delete_messages > 0:
                embed.add_field(name="Messages Deleted", value=f"{delete_messages} days", inline=True)
            embed.set_footer(text=f"User ID: {user.id}")
            embed.timestamp = datetime.utcnow()
            
            await interaction.response.send_message(embed=embed)
            
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to ban this user!", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="mute", description="Timeout a user")
    @app_commands.describe(
        user="The user to timeout",
        duration="Duration in minutes",
        reason="Reason for the timeout"
    )
    @app_commands.default_permissions(moderate_members=True)
    async def mute(self, interaction: discord.Interaction, user: discord.Member, 
                   duration: int, reason: str = "No reason provided"):
        """Timeout a user for a specified duration"""
        
        if duration < 1 or duration > 40320:  # Discord max is 28 days
            await interaction.response.send_message("❌ Duration must be between 1 minute and 28 days (40320 minutes)!", ephemeral=True)
            return
        
        # Check if user can be timed out
        if user.top_role >= interaction.user.top_role:
            await interaction.response.send_message("❌ You cannot timeout someone with a higher or equal role!", ephemeral=True)
            return
            
        if user.top_role >= interaction.guild.me.top_role:
            await interaction.response.send_message("❌ I cannot timeout this user due to role hierarchy!", ephemeral=True)
            return
        
        try:
            # Calculate timeout end time
            timeout_end = datetime.utcnow() + timedelta(minutes=duration)
            
            # Timeout the user
            await user.timeout(timeout_end, reason=reason)
            
            # Log to database
            await self.log_moderation_action(
                str(interaction.guild.id),
                str(interaction.user.id),
                str(user.id),
                "mute",
                reason,
                duration=duration,
                channel_id=str(interaction.channel.id) if interaction.channel else None,
                expires_at=timeout_end
            )
            
            # Send confirmation embed
            embed = discord.Embed(
                title="User Timed Out",
                description=f"{user.mention} has been timed out",
                color=discord.Color.yellow()
            )
            embed.add_field(name="Duration", value=f"{duration} minutes", inline=True)
            embed.add_field(name="Reason", value=reason, inline=True)
            embed.add_field(name="Moderator", value=interaction.user.mention, inline=True)
            embed.add_field(name="Expires", value=f"<t:{int(timeout_end.timestamp())}:R>", inline=False)
            embed.set_footer(text=f"User ID: {user.id}")
            embed.timestamp = datetime.utcnow()
            
            await interaction.response.send_message(embed=embed)
            
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to timeout this user!", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="clear", description="Delete multiple messages")
    @app_commands.describe(
        amount="Number of messages to delete (1-100)"
    )
    @app_commands.default_permissions(manage_messages=True)
    async def clear(self, interaction: discord.Interaction, amount: int):
        """Delete multiple messages from the channel"""
        
        if amount < 1 or amount > 100:
            await interaction.response.send_message("❌ Amount must be between 1 and 100!", ephemeral=True)
            return
        
        try:
            # Defer response since this might take a moment
            await interaction.response.defer(ephemeral=True)
            
            # Delete messages (check if it's a text channel)
            if not isinstance(interaction.channel, discord.TextChannel):
                await interaction.followup.send("❌ This command can only be used in text channels!", ephemeral=True)
                return
                
            deleted = await interaction.channel.purge(limit=amount)
            
            # Log to database
            await self.log_moderation_action(
                str(interaction.guild.id),
                str(interaction.user.id),
                str(interaction.user.id),  # Self for bulk delete
                "clear",
                f"Cleared {len(deleted)} messages",
                channel_id=str(interaction.channel.id) if interaction.channel else None
            )
            
            await interaction.followup.send(f"✅ Successfully deleted {len(deleted)} messages!")
            
        except discord.Forbidden:
            await interaction.followup.send("❌ I don't have permission to delete messages!", ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f"❌ An error occurred: {e}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(ModerationCog(bot))