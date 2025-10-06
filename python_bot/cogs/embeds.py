import discord
from discord.ext import commands
from discord import app_commands
import json
from typing import Optional

class EmbedBuilderModal(discord.ui.Modal, title="Create Embed"):
    """Interactive modal for building embeds"""
    
    embed_title = discord.ui.TextInput(
        label="Title",
        placeholder="Enter embed title (optional)",
        required=False,
        max_length=256
    )
    
    description = discord.ui.TextInput(
        label="Description",
        placeholder="Enter embed description",
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=4000
    )
    
    color = discord.ui.TextInput(
        label="Color (hex code or name)",
        placeholder="e.g., #5865F2 or blue",
        required=False,
        max_length=20,
        default="blue"
    )
    
    thumbnail_url = discord.ui.TextInput(
        label="Thumbnail URL (optional)",
        placeholder="https://example.com/image.png",
        required=False,
        max_length=500
    )
    
    footer_text = discord.ui.TextInput(
        label="Footer Text (optional)",
        placeholder="Enter footer text",
        required=False,
        max_length=2048
    )
    
    def __init__(self, cog, channel: discord.TextChannel, save_name: Optional[str] = None):
        super().__init__()
        self.cog = cog
        self.channel = channel
        self.save_name = save_name
    
    def parse_color(self, color_input: str) -> discord.Color:
        """Parse color from hex or name"""
        color_input = color_input.strip().lower()
        
        # Try hex color
        if color_input.startswith('#'):
            try:
                return discord.Color(int(color_input[1:], 16))
            except ValueError:
                pass
        
        # Color name mapping
        color_map = {
            'blue': discord.Color.blue(),
            'red': discord.Color.red(),
            'green': discord.Color.green(),
            'gold': discord.Color.gold(),
            'orange': discord.Color.orange(),
            'purple': discord.Color.purple(),
            'blurple': discord.Color.blurple(),
            'greyple': discord.Color.greyple(),
            'dark_blue': discord.Color.dark_blue(),
            'dark_red': discord.Color.dark_red(),
            'dark_green': discord.Color.dark_green(),
            'dark_gold': discord.Color.dark_gold(),
            'dark_orange': discord.Color.dark_orange(),
            'dark_purple': discord.Color.dark_purple(),
        }
        
        return color_map.get(color_input, discord.Color.blue())
    
    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission"""
        try:
            # Create embed
            embed = discord.Embed(
                title=str(self.embed_title) if self.embed_title.value else None,
                description=str(self.description),
                color=self.parse_color(str(self.color) if self.color.value else "blue")
            )
            
            if self.thumbnail_url.value:
                embed.set_thumbnail(url=str(self.thumbnail_url))
            
            if self.footer_text.value:
                embed.set_footer(text=str(self.footer_text))
            
            # Send embed
            await self.channel.send(embed=embed)
            
            # Save to database if name provided
            if self.save_name and self.cog.bot.db_pool:
                embed_data = embed.to_dict()
                async with self.cog.bot.db_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO saved_embeds (server_id, name, embed_data, created_by)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT DO NOTHING
                    """, str(interaction.guild.id), self.save_name, json.dumps(embed_data), str(interaction.user.id))
                
                await interaction.response.send_message(
                    f"✅ Embed sent to {self.channel.mention} and saved as `{self.save_name}`!",
                    ephemeral=True
                )
            else:
                await interaction.response.send_message(
                    f"✅ Embed sent to {self.channel.mention}!",
                    ephemeral=True
                )
        
        except Exception as e:
            print(f"Error in embed builder: {e}")
            await interaction.response.send_message(f"❌ Error creating embed: {e}", ephemeral=True)

class EmbedsCog(commands.Cog):
    """Interactive embed builder system with JSON support"""
    
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="embed", description="Create and send a custom embed interactively")
    @app_commands.describe(
        channel="Channel to send the embed to",
        save_name="Save this embed with a name for later use (optional)"
    )
    @app_commands.default_permissions(manage_messages=True)
    async def create_embed(self, interaction: discord.Interaction, 
                          channel: discord.TextChannel,
                          save_name: Optional[str] = None):
        """Open interactive embed builder"""
        modal = EmbedBuilderModal(self, channel, save_name)
        await interaction.response.send_modal(modal)
    
    @app_commands.command(name="embedjson", description="Create an embed from JSON")
    @app_commands.describe(
        channel="Channel to send the embed to",
        json_data="Discord embed JSON data",
        save_name="Save this embed with a name for later use (optional)"
    )
    @app_commands.default_permissions(manage_messages=True)
    async def embed_from_json(self, interaction: discord.Interaction, 
                             channel: discord.TextChannel,
                             json_data: str,
                             save_name: Optional[str] = None):
        """Create embed from JSON data"""
        
        try:
            # Parse JSON
            embed_dict = json.loads(json_data)
            
            # Create embed from dict
            embed = discord.Embed.from_dict(embed_dict)
            
            # Send embed
            await channel.send(embed=embed)
            
            # Save to database if name provided
            if save_name and self.bot.db_pool:
                async with self.bot.db_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO saved_embeds (server_id, name, embed_data, created_by)
                        VALUES ($1, $2, $3, $4)
                    """, str(interaction.guild.id), save_name, json.dumps(embed_dict), str(interaction.user.id))
                
                await interaction.response.send_message(
                    f"✅ Embed sent to {channel.mention} and saved as `{save_name}`!",
                    ephemeral=True
                )
            else:
                await interaction.response.send_message(
                    f"✅ Embed sent to {channel.mention}!",
                    ephemeral=True
                )
        
        except json.JSONDecodeError as e:
            await interaction.response.send_message(
                f"❌ Invalid JSON format: {e}",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error creating embed from JSON: {e}")
            await interaction.response.send_message(
                f"❌ Error creating embed: {e}",
                ephemeral=True
            )
    
    @app_commands.command(name="embedsave", description="Save a custom embed for later use")
    @app_commands.describe(
        name="Name for this embed template",
        json_data="Discord embed JSON data"
    )
    @app_commands.default_permissions(manage_messages=True)
    async def save_embed(self, interaction: discord.Interaction, name: str, json_data: str):
        """Save an embed template"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            # Parse JSON to validate
            embed_dict = json.loads(json_data)
            
            # Save to database
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO saved_embeds (server_id, name, embed_data, created_by)
                    VALUES ($1, $2, $3, $4)
                """, str(interaction.guild.id), name, json.dumps(embed_dict), str(interaction.user.id))
            
            await interaction.response.send_message(
                f"✅ Embed saved as `{name}`! Use `/embeduse {name}` to send it.",
                ephemeral=True
            )
        
        except json.JSONDecodeError as e:
            await interaction.response.send_message(
                f"❌ Invalid JSON format: {e}",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error saving embed: {e}")
            await interaction.response.send_message(
                f"❌ Error saving embed: {e}",
                ephemeral=True
            )
    
    @app_commands.command(name="embeduse", description="Send a saved embed template")
    @app_commands.describe(
        name="Name of the saved embed",
        channel="Channel to send the embed to"
    )
    @app_commands.default_permissions(manage_messages=True)
    async def use_saved_embed(self, interaction: discord.Interaction, 
                             name: str,
                             channel: discord.TextChannel):
        """Send a saved embed template"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get saved embed
                saved = await conn.fetchrow("""
                    SELECT embed_data FROM saved_embeds
                    WHERE server_id = $1 AND name = $2
                    ORDER BY created_at DESC
                    LIMIT 1
                """, str(interaction.guild.id), name)
                
                if not saved:
                    await interaction.response.send_message(
                        f"❌ No saved embed found with name `{name}`!",
                        ephemeral=True
                    )
                    return
                
                # Create embed from saved data
                embed_dict = saved['embed_data']
                embed = discord.Embed.from_dict(embed_dict)
                
                # Send embed
                await channel.send(embed=embed)
                
                await interaction.response.send_message(
                    f"✅ Sent saved embed `{name}` to {channel.mention}!",
                    ephemeral=True
                )
        
        except Exception as e:
            print(f"Error using saved embed: {e}")
            await interaction.response.send_message(
                f"❌ Error sending embed: {e}",
                ephemeral=True
            )
    
    @app_commands.command(name="embedlist", description="List all saved embed templates")
    async def list_embeds(self, interaction: discord.Interaction):
        """List all saved embeds in this server"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                embeds = await conn.fetch("""
                    SELECT name, created_by, created_at
                    FROM saved_embeds
                    WHERE server_id = $1
                    ORDER BY created_at DESC
                """, str(interaction.guild.id))
                
                if not embeds:
                    await interaction.response.send_message(
                        "❌ No saved embeds in this server!",
                        ephemeral=True
                    )
                    return
                
                embed = discord.Embed(
                    title="📝 Saved Embed Templates",
                    description=f"Found {len(embeds)} saved embed(s)",
                    color=discord.Color.blue()
                )
                
                for saved in embeds[:25]:  # Limit to 25
                    creator = interaction.guild.get_member(int(saved['created_by']))
                    creator_name = creator.display_name if creator else "Unknown"
                    
                    embed.add_field(
                        name=f"📋 {saved['name']}",
                        value=f"By: {creator_name}\nCreated: <t:{int(saved['created_at'].timestamp())}:R>",
                        inline=False
                    )
                
                if len(embeds) > 25:
                    embed.set_footer(text=f"Showing 25 of {len(embeds)} embeds")
                
                await interaction.response.send_message(embed=embed)
        
        except Exception as e:
            print(f"Error listing embeds: {e}")
            await interaction.response.send_message(
                "❌ Error fetching embed list!",
                ephemeral=True
            )
    
    @app_commands.command(name="embeddelete", description="Delete a saved embed template")
    @app_commands.describe(name="Name of the embed to delete")
    @app_commands.default_permissions(manage_messages=True)
    async def delete_embed(self, interaction: discord.Interaction, name: str):
        """Delete a saved embed template"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                result = await conn.execute("""
                    DELETE FROM saved_embeds
                    WHERE server_id = $1 AND name = $2
                """, str(interaction.guild.id), name)
                
                if result == "DELETE 0":
                    await interaction.response.send_message(
                        f"❌ No embed found with name `{name}`!",
                        ephemeral=True
                    )
                else:
                    await interaction.response.send_message(
                        f"✅ Deleted embed template `{name}`!",
                        ephemeral=True
                    )
        
        except Exception as e:
            print(f"Error deleting embed: {e}")
            await interaction.response.send_message(
                f"❌ Error deleting embed: {e}",
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(EmbedsCog(bot))
