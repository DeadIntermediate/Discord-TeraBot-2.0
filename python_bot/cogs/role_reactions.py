import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

class RoleReactionsCog(commands.Cog):
    """Role reaction system for self-assignable roles"""
    
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="reactionrole", description="Set up a reaction role on a message")
    @app_commands.describe(
        channel="The channel where the message is located",
        message_id="The ID of the message to add the reaction role to",
        emoji="The emoji to react with",
        role="The role to give when users react"
    )
    @app_commands.default_permissions(manage_roles=True)
    async def setup_reaction_role(self, interaction: discord.Interaction, 
                                  channel: discord.TextChannel, message_id: str, 
                                  emoji: str, role: discord.Role):
        """Set up a reaction role"""
        
        # Check bot permissions
        if not interaction.guild.me.guild_permissions.manage_roles:
            await interaction.response.send_message("❌ I need the Manage Roles permission to set up reaction roles!", ephemeral=True)
            return
        
        # Check if bot's role is high enough
        if role >= interaction.guild.me.top_role:
            await interaction.response.send_message(f"❌ I cannot manage the {role.mention} role because it's higher than or equal to my highest role!", ephemeral=True)
            return
        
        # Check if user's role is high enough
        if role >= interaction.user.top_role and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message(f"❌ You cannot set up reaction roles for {role.mention} because it's higher than or equal to your highest role!", ephemeral=True)
            return
        
        try:
            # Try to fetch the message from the specified channel
            message = await channel.fetch_message(int(message_id))
        except discord.NotFound:
            await interaction.response.send_message(f"❌ Message not found in {channel.mention}! Make sure the message ID is correct.", ephemeral=True)
            return
        except discord.Forbidden:
            await interaction.response.send_message(f"❌ I don't have permission to access messages in {channel.mention}!", ephemeral=True)
            return
        except ValueError:
            await interaction.response.send_message("❌ Invalid message ID format!", ephemeral=True)
            return
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if this emoji/message combo already exists
                existing = await conn.fetchrow("""
                    SELECT id FROM role_reactions 
                    WHERE message_id = $1 AND emoji = $2 AND is_active = true
                """, message_id, emoji)
                
                if existing:
                    await interaction.response.send_message(f"❌ A reaction role with {emoji} already exists on that message!", ephemeral=True)
                    return
                
                # Add to database
                await conn.execute("""
                    INSERT INTO role_reactions 
                    (server_id, channel_id, message_id, emoji, role_id, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, str(interaction.guild.id), str(channel.id), 
                     message_id, emoji, str(role.id), True)
                
                # Add reaction to the message
                try:
                    await message.add_reaction(emoji)
                except discord.HTTPException:
                    await interaction.response.send_message(f"❌ Failed to add reaction! Make sure the emoji is valid.", ephemeral=True)
                    # Remove from database since we couldn't add the reaction
                    await conn.execute("""
                        DELETE FROM role_reactions 
                        WHERE message_id = $1 AND emoji = $2
                    """, message_id, emoji)
                    return
                
                embed = discord.Embed(
                    title="✅ Reaction Role Created",
                    description=f"React with {emoji} on [this message]({message.jump_url}) to get {role.mention}!",
                    color=discord.Color.green()
                )
                embed.add_field(name="Message ID", value=message_id, inline=True)
                embed.add_field(name="Emoji", value=emoji, inline=True)
                embed.add_field(name="Role", value=role.mention, inline=True)
                
                await interaction.response.send_message(embed=embed)
                print(f"Created reaction role: {emoji} -> {role.name} on message {message_id}")
                
        except Exception as e:
            print(f"Error creating reaction role: {e}")
            await interaction.response.send_message("❌ An error occurred while creating the reaction role!", ephemeral=True)
    
    @app_commands.command(name="removereactionrole", description="Remove a reaction role from a message")
    @app_commands.describe(
        channel="The channel where the message is located",
        message_id="The ID of the message",
        emoji="The emoji to remove"
    )
    @app_commands.default_permissions(manage_roles=True)
    async def remove_reaction_role(self, interaction: discord.Interaction, 
                                   channel: discord.TextChannel, message_id: str, emoji: str):
        """Remove a reaction role"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Find the reaction role
                reaction_role = await conn.fetchrow("""
                    SELECT * FROM role_reactions 
                    WHERE message_id = $1 AND emoji = $2 AND server_id = $3 AND is_active = true
                """, message_id, emoji, str(interaction.guild.id))
                
                if not reaction_role:
                    await interaction.response.send_message("❌ No reaction role found with that emoji on that message!", ephemeral=True)
                    return
                
                # Mark as inactive
                await conn.execute("""
                    UPDATE role_reactions 
                    SET is_active = false 
                    WHERE message_id = $1 AND emoji = $2
                """, message_id, emoji)
                
                # Try to remove the bot's reaction
                try:
                    message = await channel.fetch_message(int(message_id))
                    await message.clear_reaction(emoji)
                except:
                    pass  # If we can't remove it, that's okay
                
                embed = discord.Embed(
                    title="✅ Reaction Role Removed",
                    description=f"Removed {emoji} reaction role from message {message_id}",
                    color=discord.Color.green()
                )
                
                await interaction.response.send_message(embed=embed)
                print(f"Removed reaction role: {emoji} from message {message_id}")
                
        except Exception as e:
            print(f"Error removing reaction role: {e}")
            await interaction.response.send_message("❌ An error occurred while removing the reaction role!", ephemeral=True)
    
    @app_commands.command(name="listreactionroles", description="List all reaction roles in this server")
    async def list_reaction_roles(self, interaction: discord.Interaction):
        """List all active reaction roles"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                reaction_roles = await conn.fetch("""
                    SELECT * FROM role_reactions 
                    WHERE server_id = $1 AND is_active = true
                    ORDER BY created_at DESC
                """, str(interaction.guild.id))
                
                if not reaction_roles:
                    await interaction.response.send_message("❌ No reaction roles set up in this server!", ephemeral=True)
                    return
                
                embed = discord.Embed(
                    title="📋 Reaction Roles",
                    description=f"Active reaction roles in {interaction.guild.name}",
                    color=discord.Color.blue()
                )
                
                for rr in reaction_roles[:25]:  # Limit to 25 to avoid embed limits
                    role = interaction.guild.get_role(int(rr['role_id']))
                    role_name = role.mention if role else f"Deleted Role ({rr['role_id']})"
                    
                    channel = interaction.guild.get_channel(int(rr['channel_id']))
                    channel_name = channel.mention if channel else f"<#{rr['channel_id']}>"
                    
                    embed.add_field(
                        name=f"{rr['emoji']} → {role_name}",
                        value=f"Channel: {channel_name}\nMessage ID: {rr['message_id']}",
                        inline=False
                    )
                
                if len(reaction_roles) > 25:
                    embed.set_footer(text=f"Showing 25 of {len(reaction_roles)} reaction roles")
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error listing reaction roles: {e}")
            await interaction.response.send_message("❌ An error occurred while fetching reaction roles!", ephemeral=True)
    
    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        """Called when a reaction is added to a message"""
        
        # Ignore bot reactions
        if payload.user_id == self.bot.user.id:
            return
        
        if not self.bot.db_pool:
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if this is a reaction role
                reaction_role = await conn.fetchrow("""
                    SELECT * FROM role_reactions 
                    WHERE message_id = $1 AND emoji = $2 AND is_active = true
                """, str(payload.message_id), str(payload.emoji))
                
                if not reaction_role:
                    return
                
                # Get the guild and member
                guild = self.bot.get_guild(payload.guild_id)
                if not guild:
                    return
                
                member = guild.get_member(payload.user_id)
                if not member:
                    return
                
                # Get the role
                role = guild.get_role(int(reaction_role['role_id']))
                if not role:
                    print(f"Role {reaction_role['role_id']} not found")
                    return
                
                # Check if member already has the role
                if role in member.roles:
                    return
                
                # Add the role
                try:
                    await member.add_roles(role, reason="Reaction role")
                    print(f"Added role {role.name} to {member} via reaction")
                except discord.Forbidden:
                    print(f"Failed to add role {role.name} to {member}: Missing permissions")
                except Exception as e:
                    print(f"Error adding role: {e}")
                    
        except Exception as e:
            print(f"Error in on_raw_reaction_add: {e}")
    
    @commands.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        """Called when a reaction is removed from a message"""
        
        # Ignore bot reactions
        if payload.user_id == self.bot.user.id:
            return
        
        if not self.bot.db_pool:
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if this is a reaction role
                reaction_role = await conn.fetchrow("""
                    SELECT * FROM role_reactions 
                    WHERE message_id = $1 AND emoji = $2 AND is_active = true
                """, str(payload.message_id), str(payload.emoji))
                
                if not reaction_role:
                    return
                
                # Get the guild and member
                guild = self.bot.get_guild(payload.guild_id)
                if not guild:
                    return
                
                member = guild.get_member(payload.user_id)
                if not member:
                    return
                
                # Get the role
                role = guild.get_role(int(reaction_role['role_id']))
                if not role:
                    return
                
                # Check if member has the role
                if role not in member.roles:
                    return
                
                # Remove the role
                try:
                    await member.remove_roles(role, reason="Reaction role removed")
                    print(f"Removed role {role.name} from {member} via reaction removal")
                except discord.Forbidden:
                    print(f"Failed to remove role {role.name} from {member}: Missing permissions")
                except Exception as e:
                    print(f"Error removing role: {e}")
                    
        except Exception as e:
            print(f"Error in on_raw_reaction_remove: {e}")

async def setup(bot):
    await bot.add_cog(RoleReactionsCog(bot))
