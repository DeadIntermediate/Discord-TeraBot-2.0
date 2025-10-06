import discord
from discord.ext import commands
from discord import app_commands

class LevelingCog(commands.Cog):
    """Leveling system management commands"""
    
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="rank", description="Check your rank in the server")
    async def rank(self, interaction: discord.Interaction, user: discord.Member = None):
        """Check user's rank position in the server"""
        
        target_user = user or interaction.user
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get user's detailed rank data
                member_data = await conn.fetchrow("""
                    SELECT text_xp, text_level, voice_xp, voice_level, 
                           global_level, message_count, voice_time
                    FROM server_members 
                    WHERE server_id = $1 AND user_id = $2
                """, str(interaction.guild.id), str(target_user.id))
                
                if not member_data:
                    await interaction.response.send_message(
                        f"❌ {target_user.mention} is not ranked yet!",
                        ephemeral=True
                    )
                    return
                
                # Get text rank
                text_rank = await conn.fetchval("""
                    SELECT COUNT(*) + 1 FROM server_members 
                    WHERE server_id = $1 AND text_xp > $2
                """, str(interaction.guild.id), member_data['text_xp'])
                
                # Get voice rank
                voice_rank = await conn.fetchval("""
                    SELECT COUNT(*) + 1 FROM server_members 
                    WHERE server_id = $1 AND voice_xp > $2
                """, str(interaction.guild.id), member_data['voice_xp'])
                
                # Get global rank
                global_rank = await conn.fetchval("""
                    SELECT COUNT(*) + 1 FROM server_members 
                    WHERE server_id = $1 AND global_level > $2
                """, str(interaction.guild.id), member_data['global_level'])
                
                total_members = await conn.fetchval("""
                    SELECT COUNT(*) FROM server_members WHERE server_id = $1
                """, str(interaction.guild.id))
                
                embed = discord.Embed(
                    title=f"📊 {target_user.display_name}'s Rank Card",
                    color=discord.Color.purple(),
                    description=f"**Global Level:** {member_data['global_level']} (Rank #{global_rank}/{total_members})"
                )
                
                embed.set_thumbnail(url=target_user.display_avatar.url)
                
                # Text stats
                embed.add_field(
                    name="💬 Text Stats",
                    value=f"**Level:** {member_data['text_level']}\n**XP:** {member_data['text_xp']:,}\n**Messages:** {member_data['message_count']:,}\n**Rank:** #{text_rank}",
                    inline=True
                )
                
                # Voice stats
                hours = member_data['voice_time'] // 60
                minutes = member_data['voice_time'] % 60
                embed.add_field(
                    name="🎤 Voice Stats",
                    value=f"**Level:** {member_data['voice_level']}\n**XP:** {member_data['voice_xp']:,}\n**Time:** {hours}h {minutes}m\n**Rank:** #{voice_rank}",
                    inline=True
                )
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error fetching rank: {e}")
            await interaction.response.send_message("❌ An error occurred while fetching rank data!", ephemeral=True)
    
    @app_commands.command(name="leaderboard", description="View the server leaderboard")
    @app_commands.describe(type="Type of leaderboard (text, voice, or global)")
    @app_commands.choices(type=[
        app_commands.Choice(name="Global (Combined)", value="global"),
        app_commands.Choice(name="Text (Messages)", value="text"),
        app_commands.Choice(name="Voice (Time)", value="voice")
    ])
    async def leaderboard(self, interaction: discord.Interaction, type: str = "global"):
        """View the server leaderboard"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Build query based on type
                if type == "text":
                    query = """
                        SELECT u.username, u.id as user_id, sm.text_xp, sm.text_level, sm.message_count
                        FROM server_members sm
                        JOIN discord_users u ON sm.user_id = u.id
                        WHERE sm.server_id = $1
                        ORDER BY sm.text_xp DESC
                        LIMIT 10
                    """
                    title = "💬 Text Leaderboard"
                    color = discord.Color.blue()
                elif type == "voice":
                    query = """
                        SELECT u.username, u.id as user_id, sm.voice_xp, sm.voice_level, sm.voice_time
                        FROM server_members sm
                        JOIN discord_users u ON sm.user_id = u.id
                        WHERE sm.server_id = $1
                        ORDER BY sm.voice_xp DESC
                        LIMIT 10
                    """
                    title = "🎤 Voice Leaderboard"
                    color = discord.Color.green()
                else:  # global
                    query = """
                        SELECT u.username, u.id as user_id, sm.global_level, sm.text_level, sm.voice_level
                        FROM server_members sm
                        JOIN discord_users u ON sm.user_id = u.id
                        WHERE sm.server_id = $1
                        ORDER BY sm.global_level DESC, sm.text_xp + sm.voice_xp DESC
                        LIMIT 10
                    """
                    title = "🏆 Global Leaderboard"
                    color = discord.Color.gold()
                
                leaderboard = await conn.fetch(query, str(interaction.guild.id))
                
                if not leaderboard:
                    await interaction.response.send_message(
                        "❌ No data available for leaderboard!",
                        ephemeral=True
                    )
                    return
                
                embed = discord.Embed(
                    title=title,
                    description=f"Top 10 members in {interaction.guild.name}",
                    color=color
                )
                
                medals = ["🥇", "🥈", "🥉"]
                
                for idx, row in enumerate(leaderboard, 1):
                    medal = medals[idx - 1] if idx <= 3 else f"#{idx}"
                    user = interaction.guild.get_member(int(row['user_id']))
                    username = user.display_name if user else row['username']
                    
                    if type == "text":
                        value = f"Level {row['text_level']} • {row['text_xp']:,} XP • {row['message_count']:,} msgs"
                    elif type == "voice":
                        hours = row['voice_time'] // 60
                        minutes = row['voice_time'] % 60
                        value = f"Level {row['voice_level']} • {row['voice_xp']:,} XP • {hours}h {minutes}m"
                    else:  # global
                        value = f"Level {row['global_level']} (Text: {row['text_level']}, Voice: {row['voice_level']})"
                    
                    embed.add_field(
                        name=f"{medal} {username}",
                        value=value,
                        inline=False
                    )
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error fetching leaderboard: {e}")
            await interaction.response.send_message("❌ An error occurred while fetching the leaderboard!", ephemeral=True)
    
    @app_commands.command(name="addxp", description="Add XP to a user (Admin only)")
    @app_commands.describe(
        user="The user to give XP to",
        amount="Amount of XP to add"
    )
    @app_commands.default_permissions(administrator=True)
    async def addxp(self, interaction: discord.Interaction, user: discord.Member, amount: int):
        """Add XP to a user (Admin only)"""
        
        if amount <= 0 or amount > 10000:
            await interaction.response.send_message("❌ XP amount must be between 1 and 10,000!", ephemeral=True)
            return
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Add XP to user
                result = await conn.fetchrow("""
                    UPDATE server_members 
                    SET xp = xp + $3
                    WHERE server_id = $1 AND user_id = $2
                    RETURNING xp, level
                """, str(interaction.guild.id), str(user.id), amount)
                
                if not result:
                    # Create user if they don't exist
                    await conn.execute("""
                        INSERT INTO server_members (server_id, user_id, xp)
                        VALUES ($1, $2, $3)
                    """, str(interaction.guild.id), str(user.id), amount)
                    new_xp = amount
                    current_level = 1
                else:
                    new_xp = result['xp']
                    current_level = result['level']
                
                # Calculate new level
                new_level = int((new_xp / 100) ** 0.5)
                
                if new_level > current_level:
                    await conn.execute("""
                        UPDATE server_members 
                        SET level = $3
                        WHERE server_id = $1 AND user_id = $2
                    """, str(interaction.guild.id), str(user.id), new_level)
                
                embed = discord.Embed(
                    title="✅ XP Added",
                    description=f"Added {amount:,} XP to {user.mention}",
                    color=discord.Color.green()
                )
                embed.add_field(name="New XP", value=f"{new_xp:,}", inline=True)
                embed.add_field(name="Level", value=new_level, inline=True)
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error adding XP: {e}")
            await interaction.response.send_message("❌ An error occurred while adding XP!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(LevelingCog(bot))