import discord
from discord.ext import commands
from discord import app_commands
from datetime import datetime, timedelta
import json

class GiveawayCog(commands.Cog):
    """Giveaway management commands"""
    
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="giveaway", description="Create a new giveaway")
    @app_commands.describe(
        prize="What prize is being given away",
        duration="Duration in hours",
        winners="Number of winners (default: 1)",
        channel="Channel to post the giveaway (optional)"
    )
    @app_commands.default_permissions(manage_guild=True)
    async def create_giveaway(self, interaction: discord.Interaction, 
                             prize: str, duration: int, winners: int = 1,
                             channel: discord.TextChannel = None):
        """Create a new giveaway"""
        
        if duration <= 0 or duration > 720:  # Max 30 days
            await interaction.response.send_message("❌ Duration must be between 1 hour and 720 hours (30 days)!", ephemeral=True)
            return
        
        if winners <= 0 or winners > 20:
            await interaction.response.send_message("❌ Number of winners must be between 1 and 20!", ephemeral=True)
            return
        
        target_channel = channel or interaction.channel
        
        if not isinstance(target_channel, discord.TextChannel):
            await interaction.response.send_message("❌ Giveaways can only be posted in text channels!", ephemeral=True)
            return
        
        # Calculate end time
        end_time = datetime.utcnow() + timedelta(hours=duration)
        end_timestamp = int(end_time.timestamp())
        
        # Create giveaway embed
        embed = discord.Embed(
            title="🎉 GIVEAWAY TIME!",
            description=f"**Prize:** {prize}\n\n**Winners:** {winners}\n**Ends:** <t:{end_timestamp}:R>",
            color=discord.Color.gold()
        )
        embed.add_field(
            name="How to Enter",
            value="React with 🎁 to enter this giveaway!",
            inline=False
        )
        embed.set_footer(text=f"Hosted by {interaction.user}")
        embed.timestamp = datetime.utcnow()
        
        try:
            # Send the giveaway message
            giveaway_msg = await target_channel.send(embed=embed)
            await giveaway_msg.add_reaction("🎁")
            
            # Store in database
            if self.bot.db_pool:
                try:
                    async with self.bot.db_pool.acquire() as conn:
                        await conn.execute("""
                            INSERT INTO giveaways 
                            (server_id, channel_id, message_id, host_id, title, prize, 
                             winner_count, entries, is_active, ends_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        """, str(interaction.guild.id), str(target_channel.id), 
                             str(giveaway_msg.id), str(interaction.user.id),
                             "Giveaway", prize, winners, "[]", True, end_time)
                        
                        print(f"Created giveaway in database: {prize}")
                        
                except Exception as e:
                    print(f"Error saving giveaway to database: {e}")
            
            # Confirm creation
            confirmation = discord.Embed(
                title="✅ Giveaway Created!",
                description=f"Giveaway has been created in {target_channel.mention}",
                color=discord.Color.green()
            )
            
            await interaction.response.send_message(embed=confirmation, ephemeral=True)
            
        except discord.Forbidden:
            await interaction.response.send_message("❌ I don't have permission to send messages in that channel!", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ An error occurred: {e}", ephemeral=True)
    
    @app_commands.command(name="gend", description="End a giveaway early")
    @app_commands.describe(message_id="The message ID of the giveaway to end")
    @app_commands.default_permissions(manage_guild=True)
    async def end_giveaway(self, interaction: discord.Interaction, message_id: str):
        """End a giveaway early and pick winners"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Get giveaway data
                giveaway = await conn.fetchrow("""
                    SELECT * FROM giveaways 
                    WHERE message_id = $1 AND server_id = $2 AND is_active = true
                """, message_id, str(interaction.guild.id))
                
                if not giveaway:
                    await interaction.response.send_message("❌ No active giveaway found with that message ID!", ephemeral=True)
                    return
                
                # Get the message
                channel = interaction.guild.get_channel(int(giveaway['channel_id']))
                if not channel:
                    await interaction.response.send_message("❌ Giveaway channel not found!", ephemeral=True)
                    return
                
                try:
                    message = await channel.fetch_message(int(message_id))
                except discord.NotFound:
                    await interaction.response.send_message("❌ Giveaway message not found!", ephemeral=True)
                    return
                
                # Get reactions
                reaction = None
                for r in message.reactions:
                    if str(r.emoji) == "🎁":
                        reaction = r
                        break
                
                if not reaction:
                    await interaction.response.send_message("❌ No entries found for this giveaway!", ephemeral=True)
                    return
                
                # Get users who reacted (exclude bots)
                users = []
                async for user in reaction.users():
                    if not user.bot and user.id != self.bot.user.id:
                        users.append(user)
                
                if not users:
                    # No entries
                    embed = discord.Embed(
                        title="😕 Giveaway Ended",
                        description=f"**{giveaway['prize']}**\n\nNo valid entries! Better luck next time.",
                        color=discord.Color.red()
                    )
                    await message.edit(embed=embed)
                    
                    # Mark as ended in database
                    await conn.execute("""
                        UPDATE giveaways 
                        SET is_active = false, winners = '[]'
                        WHERE message_id = $1
                    """, message_id)
                    
                else:
                    # Pick winners
                    import random
                    winner_count = min(giveaway['winner_count'], len(users))
                    winners = random.sample(users, winner_count)
                    
                    # Update giveaway message
                    winner_mentions = [user.mention for user in winners]
                    embed = discord.Embed(
                        title="🎉 Giveaway Ended!",
                        description=f"**{giveaway['prize']}**\n\n**Winners:**\n" + "\n".join(winner_mentions),
                        color=discord.Color.gold()
                    )
                    embed.set_footer(text=f"Ended early by {interaction.user}")
                    
                    await message.edit(embed=embed)
                    
                    # Announce winners
                    await channel.send(f"🎉 Congratulations {', '.join(winner_mentions)}! You won **{giveaway['prize']}**!")
                    
                    # Update database
                    winner_ids = [str(user.id) for user in winners]
                    await conn.execute("""
                        UPDATE giveaways 
                        SET is_active = false, winners = $2
                        WHERE message_id = $1
                    """, message_id, json.dumps(winner_ids))
                
                await interaction.response.send_message("✅ Giveaway ended successfully!", ephemeral=True)
                
        except Exception as e:
            print(f"Error ending giveaway: {e}")
            await interaction.response.send_message("❌ An error occurred while ending the giveaway!", ephemeral=True)
    
    @app_commands.command(name="glist", description="List active giveaways")
    async def list_giveaways(self, interaction: discord.Interaction):
        """List all active giveaways in the server"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                giveaways = await conn.fetch("""
                    SELECT prize, channel_id, message_id, ends_at, winner_count
                    FROM giveaways 
                    WHERE server_id = $1 AND is_active = true
                    ORDER BY ends_at ASC
                """, str(interaction.guild.id))
                
                if not giveaways:
                    await interaction.response.send_message("❌ No active giveaways in this server!", ephemeral=True)
                    return
                
                embed = discord.Embed(
                    title="🎁 Active Giveaways",
                    color=discord.Color.gold()
                )
                
                for g in giveaways[:10]:  # Limit to 10
                    channel = interaction.guild.get_channel(int(g['channel_id']))
                    channel_name = channel.name if channel else "Unknown"
                    
                    end_timestamp = int(g['ends_at'].timestamp())
                    
                    embed.add_field(
                        name=f"🎁 {g['prize']}",
                        value=f"Channel: #{channel_name}\nWinners: {g['winner_count']}\nEnds: <t:{end_timestamp}:R>",
                        inline=True
                    )
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error listing giveaways: {e}")
            await interaction.response.send_message("❌ An error occurred while fetching giveaways!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(GiveawayCog(bot))