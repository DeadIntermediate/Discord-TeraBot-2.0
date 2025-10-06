import discord
from discord.ext import commands
from discord import app_commands
import re
import json
from datetime import datetime, timezone

class AntiInviteCog(commands.Cog):
    """Anti-invite moderation system"""
    
    def __init__(self, bot):
        self.bot = bot
        # Regex patterns for Discord invite links
        self.invite_patterns = [
            r'discord\.gg/[\w-]+',
            r'discord\.com/invite/[\w-]+',
            r'discordapp\.com/invite/[\w-]+',
        ]
        self.invite_regex = re.compile('|'.join(self.invite_patterns), re.IGNORECASE)
    
    @app_commands.command(name="antiinvite", description="Configure anti-invite system")
    @app_commands.describe(
        enabled="Enable or disable the anti-invite system",
        log_channel="Channel to log deleted invites (optional)"
    )
    @app_commands.default_permissions(administrator=True)
    async def anti_invite_config(
        self, 
        interaction: discord.Interaction, 
        enabled: bool,
        log_channel: discord.TextChannel = None
    ):
        """Configure anti-invite system"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get current settings
                settings_raw = await conn.fetchval("""
                    SELECT settings FROM discord_servers WHERE id = $1
                """, str(interaction.guild.id))
                
                # Parse settings (handle string, dict, or None)
                if settings_raw is None:
                    current_settings = {}
                elif isinstance(settings_raw, str):
                    current_settings = json.loads(settings_raw) if settings_raw else {}
                else:
                    current_settings = settings_raw
                
                # Update anti-invite settings
                current_settings['anti_invite_enabled'] = enabled
                if log_channel:
                    current_settings['anti_invite_log_channel'] = str(log_channel.id)
                
                # Save settings as JSON string
                await conn.execute("""
                    UPDATE discord_servers 
                    SET settings = $1
                    WHERE id = $2
                """, json.dumps(current_settings), str(interaction.guild.id))
                
                embed = discord.Embed(
                    title="✅ Anti-Invite System Updated",
                    color=discord.Color.green() if enabled else discord.Color.red()
                )
                embed.add_field(name="Status", value="Enabled" if enabled else "Disabled", inline=True)
                if log_channel:
                    embed.add_field(name="Log Channel", value=log_channel.mention, inline=True)
                
                await interaction.response.send_message(embed=embed)
                print(f"Anti-invite system {'enabled' if enabled else 'disabled'} in {interaction.guild.name}")
                
        except Exception as e:
            print(f"Error configuring anti-invite: {e}")
            await interaction.response.send_message("❌ An error occurred while configuring anti-invite!", ephemeral=True)
    
    @app_commands.command(name="antiinvite-bypass", description="Add or remove bypass role for anti-invite")
    @app_commands.describe(
        role="Role to add/remove from bypass list",
        action="Add or remove the role"
    )
    @app_commands.choices(action=[
        app_commands.Choice(name="Add", value="add"),
        app_commands.Choice(name="Remove", value="remove")
    ])
    @app_commands.default_permissions(administrator=True)
    async def anti_invite_bypass(
        self,
        interaction: discord.Interaction,
        role: discord.Role,
        action: str
    ):
        """Add or remove bypass roles for anti-invite"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get current settings
                settings_raw = await conn.fetchval("""
                    SELECT settings FROM discord_servers WHERE id = $1
                """, str(interaction.guild.id))
                
                # Parse settings (handle string, dict, or None)
                if settings_raw is None:
                    current_settings = {}
                elif isinstance(settings_raw, str):
                    current_settings = json.loads(settings_raw) if settings_raw else {}
                else:
                    current_settings = settings_raw
                
                # Get bypass roles list
                bypass_roles = current_settings.get('anti_invite_bypass_roles', [])
                
                # Add or remove role
                if action == "add":
                    if str(role.id) not in bypass_roles:
                        bypass_roles.append(str(role.id))
                        message = f"Added {role.mention} to anti-invite bypass list"
                    else:
                        await interaction.response.send_message(f"❌ {role.mention} is already in the bypass list!", ephemeral=True)
                        return
                else:  # remove
                    if str(role.id) in bypass_roles:
                        bypass_roles.remove(str(role.id))
                        message = f"Removed {role.mention} from anti-invite bypass list"
                    else:
                        await interaction.response.send_message(f"❌ {role.mention} is not in the bypass list!", ephemeral=True)
                        return
                
                # Update settings
                current_settings['anti_invite_bypass_roles'] = bypass_roles
                
                # Save settings as JSON string
                await conn.execute("""
                    UPDATE discord_servers 
                    SET settings = $1
                    WHERE id = $2
                """, json.dumps(current_settings), str(interaction.guild.id))
                
                embed = discord.Embed(
                    title="✅ Bypass Role Updated",
                    description=message,
                    color=discord.Color.green()
                )
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error updating bypass roles: {e}")
            await interaction.response.send_message("❌ An error occurred while updating bypass roles!", ephemeral=True)
    
    @commands.Cog.listener()
    async def on_message(self, message):
        """Monitor messages for Discord invite links"""
        # Ignore bots and DMs
        if message.author.bot or not message.guild:
            return
        
        if not self.bot.db_pool:
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get server settings
                settings_raw = await conn.fetchval("""
                    SELECT settings FROM discord_servers WHERE id = $1
                """, str(message.guild.id))
                
                # Parse settings (handle string, dict, or None)
                if settings_raw is None:
                    return
                elif isinstance(settings_raw, str):
                    settings = json.loads(settings_raw) if settings_raw else {}
                else:
                    settings = settings_raw
                
                if not settings.get('anti_invite_enabled', False):
                    return
                
                # Check if user has bypass role
                bypass_roles = settings.get('anti_invite_bypass_roles', [])
                if any(str(role.id) in bypass_roles for role in message.author.roles):
                    return
                
                # Check for Discord invites in message
                invites = self.invite_regex.findall(message.content)
                
                if not invites:
                    return
                
                # Extract invite codes and check if they're for this server
                for invite_text in invites:
                    # Extract just the code
                    invite_code = invite_text.split('/')[-1]
                    
                    try:
                        # Fetch invite info from Discord
                        invite = await self.bot.fetch_invite(invite_code)
                        
                        # Check if invite is for a different server
                        if invite.guild and invite.guild.id != message.guild.id:
                            # Delete the message
                            await message.delete()
                            
                            # Send warning to user
                            try:
                                embed = discord.Embed(
                                    title="⚠️ External Invite Removed",
                                    description=f"Your message was deleted because it contained an invite to another server: **{invite.guild.name}**",
                                    color=discord.Color.orange()
                                )
                                embed.add_field(
                                    name="Note",
                                    value="Invites to other Discord servers are not allowed in this server.",
                                    inline=False
                                )
                                await message.author.send(embed=embed)
                            except discord.Forbidden:
                                pass  # Can't DM user
                            
                            # Log to moderation channel
                            log_channel_id = settings.get('anti_invite_log_channel')
                            if log_channel_id:
                                log_channel = message.guild.get_channel(int(log_channel_id))
                                if log_channel:
                                    log_embed = discord.Embed(
                                        title="🔗 External Invite Deleted",
                                        color=discord.Color.red(),
                                        timestamp=datetime.now(timezone.utc)
                                    )
                                    log_embed.add_field(name="User", value=f"{message.author.mention} ({message.author})", inline=False)
                                    log_embed.add_field(name="Channel", value=message.channel.mention, inline=True)
                                    log_embed.add_field(name="External Server", value=invite.guild.name, inline=True)
                                    log_embed.add_field(name="Message Content", value=message.content[:1000], inline=False)
                                    log_embed.set_footer(text=f"User ID: {message.author.id}")
                                    
                                    await log_channel.send(embed=log_embed)
                            
                            print(f"Deleted external invite from {message.author} in {message.guild.name}")
                            break  # Stop after deleting message
                    
                    except discord.NotFound:
                        # Invalid or expired invite - delete it to be safe
                        await message.delete()
                        
                        try:
                            await message.author.send(
                                f"⚠️ Your message in **{message.guild.name}** was deleted because it contained an invalid or expired Discord invite."
                            )
                        except discord.Forbidden:
                            pass
                        
                        print(f"Deleted invalid/expired invite from {message.author} in {message.guild.name}")
                        break
                    
                    except discord.HTTPException as e:
                        print(f"Error fetching invite {invite_code}: {e}")
                        continue
        
        except Exception as e:
            print(f"Error in anti-invite check: {e}")
    
    @commands.Cog.listener()
    async def on_message_edit(self, before, after):
        """Check edited messages for invites too"""
        # Only check if content actually changed
        if before.content != after.content:
            await self.on_message(after)

async def setup(bot):
    await bot.add_cog(AntiInviteCog(bot))
