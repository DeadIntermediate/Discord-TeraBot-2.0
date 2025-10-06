import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

class TicketModal(discord.ui.Modal, title="Create Support Ticket"):
    """Modal for creating a ticket"""
    
    subject = discord.ui.TextInput(
        label="What do you need help with?",
        placeholder="Brief description of your issue...",
        max_length=100,
        required=True
    )
    
    def __init__(self, cog):
        super().__init__()
        self.cog = cog
    
    async def on_submit(self, interaction: discord.Interaction):
        """Called when the modal is submitted"""
        await self.cog.create_ticket_channel(interaction, str(self.subject))

class CreateTicketButton(discord.ui.View):
    """Persistent button for creating tickets"""
    
    def __init__(self, cog):
        super().__init__(timeout=None)
        self.cog = cog
    
    @discord.ui.button(label="📩 Create Ticket", style=discord.ButtonStyle.primary, custom_id="create_ticket_button")
    async def create_ticket_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Button click handler"""
        modal = TicketModal(self.cog)
        await interaction.response.send_modal(modal)

class CloseTicketButton(discord.ui.View):
    """Persistent button for closing tickets"""
    
    def __init__(self, cog):
        super().__init__(timeout=None)
        self.cog = cog
    
    @discord.ui.button(label="🔒 Close Ticket", style=discord.ButtonStyle.danger, custom_id="close_ticket_button")
    async def close_ticket_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Close ticket button handler"""
        await self.cog.close_ticket_handler(interaction, "Closed via button")

class TicketsCog(commands.Cog):
    """Support ticket system for server members"""
    
    def __init__(self, bot):
        self.bot = bot
        # Register persistent views
        bot.add_view(CreateTicketButton(self))
        bot.add_view(CloseTicketButton(self))
    
    async def create_ticket_channel(self, interaction: discord.Interaction, subject: str):
        """Helper method to create a ticket channel"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            # Check if user already has an open ticket
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
                existing = await conn.fetchrow("""
                    SELECT id, channel_id FROM tickets 
                    WHERE server_id = $1 AND user_id = $2 AND status = 'open'
                """, str(interaction.guild.id), str(interaction.user.id))
                
                if existing:
                    channel = interaction.guild.get_channel(int(existing['channel_id']))
                    if channel:
                        await interaction.response.send_message(
                            f"❌ You already have an open ticket! Please use {channel.mention}",
                            ephemeral=True
                        )
                        return
                
                # Create ticket category if it doesn't exist
                category = discord.utils.get(interaction.guild.categories, name="Tickets")
                if not category:
                    try:
                        category = await interaction.guild.create_category("Tickets")
                    except discord.Forbidden:
                        await interaction.response.send_message(
                            "❌ I don't have permission to create categories!",
                            ephemeral=True
                        )
                        return
                
                # Create private ticket channel
                overwrites = {
                    interaction.guild.default_role: discord.PermissionOverwrite(read_messages=False),
                    interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                    interaction.guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                }
                
                # Add support role if it exists
                support_role = discord.utils.get(interaction.guild.roles, name="Support")
                if support_role:
                    overwrites[support_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
                
                channel_name = f"ticket-{interaction.user.name}-{interaction.user.discriminator}"
                ticket_channel = await interaction.guild.create_text_channel(
                    name=channel_name,
                    category=category,
                    overwrites=overwrites
                )
                
                # Create Discord user if not exists
                await conn.execute("""
                    INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        discriminator = EXCLUDED.discriminator,
                        avatar = EXCLUDED.avatar
                """, str(interaction.user.id), interaction.user.name, 
                     interaction.user.discriminator,
                     interaction.user.avatar.key if interaction.user.avatar else None,
                     interaction.user.bot)
                
                # Save ticket to database
                await conn.execute("""
                    INSERT INTO tickets 
                    (server_id, user_id, channel_id, subject, status, priority)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, str(interaction.guild.id), str(interaction.user.id), 
                     str(ticket_channel.id), subject, "open", "medium")
                
                # Send ticket info in the new channel
                embed = discord.Embed(
                    title=f"🎫 Support Ticket",
                    description=f"**Subject:** {subject}\n\n{interaction.user.mention}, a support member will assist you shortly!",
                    color=discord.Color.blue()
                )
                embed.add_field(
                    name="📝 How to Close",
                    value="Click the button below or use `/closeticket`",
                    inline=False
                )
                embed.set_footer(text=f"Ticket by {interaction.user}")
                embed.timestamp = discord.utils.utcnow()
                
                # Add close button
                view = CloseTicketButton(self)
                await ticket_channel.send(embed=embed, view=view)
                
                # Notify user
                await interaction.response.send_message(
                    f"✅ Ticket created! Please go to {ticket_channel.mention}",
                    ephemeral=True
                )
                
                print(f"Created ticket for {interaction.user}: {subject}")
                
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to create channels!",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error creating ticket: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while creating your ticket!",
                ephemeral=True
            )
    
    @app_commands.command(name="ticket", description="Create a support ticket")
    @app_commands.describe(subject="What do you need help with?")
    async def create_ticket(self, interaction: discord.Interaction, subject: str):
        """Create a new support ticket"""
        await self.create_ticket_channel(interaction, subject)
    
    @app_commands.command(name="setupticket", description="Set up the ticket system")
    @app_commands.default_permissions(manage_channels=True)
    async def setup_ticket(self, interaction: discord.Interaction):
        """Set up ticket category and create ticket channel"""
        
        try:
            # Create or get Ticket category
            category = discord.utils.get(interaction.guild.categories, name="Ticket")
            if not category:
                category = await interaction.guild.create_category("Ticket")
            
            # Check if "create-a-ticket" channel already exists
            existing_channel = discord.utils.get(category.channels, name="create-a-ticket")
            if existing_channel:
                await interaction.response.send_message(
                    f"❌ Ticket system already set up! Channel: {existing_channel.mention}",
                    ephemeral=True
                )
                return
            
            # Create the "create-a-ticket" channel
            overwrites = {
                interaction.guild.default_role: discord.PermissionOverwrite(
                    read_messages=True,
                    send_messages=False
                ),
                interaction.guild.me: discord.PermissionOverwrite(
                    read_messages=True,
                    send_messages=True
                )
            }
            
            ticket_channel = await interaction.guild.create_text_channel(
                name="create-a-ticket",
                category=category,
                overwrites=overwrites,
                topic="Click the button below to create a support ticket"
            )
            
            # Create embed with instructions
            embed = discord.Embed(
                title="🎫 Support Tickets",
                description="Need help? Create a ticket and our support team will assist you!",
                color=discord.Color.blue()
            )
            embed.add_field(
                name="📝 How to Create a Ticket",
                value="**Option 1:** Click the button below\n**Option 2:** Use the `/ticket` command anywhere",
                inline=False
            )
            embed.add_field(
                name="ℹ️ What Happens Next?",
                value="• A private channel will be created just for you\n• Only you and support staff can see it\n• Our team will respond as soon as possible",
                inline=False
            )
            embed.set_footer(text="Click the button below to get started!")
            
            # Send message with button
            view = CreateTicketButton(self)
            await ticket_channel.send(embed=embed, view=view)
            
            # Confirm to admin
            await interaction.response.send_message(
                f"✅ Ticket system set up successfully!\nChannel created: {ticket_channel.mention}",
                ephemeral=True
            )
            
            print(f"Set up ticket system in {interaction.guild.name}")
            
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to create categories or channels!",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error setting up ticket system: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while setting up the ticket system!",
                ephemeral=True
            )
    
    async def close_ticket_handler(self, interaction: discord.Interaction, reason: str = "No reason provided"):
        """Handler for closing tickets (used by both button and command)"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if this channel is a ticket
                ticket = await conn.fetchrow("""
                    SELECT * FROM tickets 
                    WHERE channel_id = $1 AND status = 'open'
                """, str(interaction.channel.id))
                
                if not ticket:
                    await interaction.response.send_message(
                        "❌ This command can only be used in ticket channels!",
                        ephemeral=True
                    )
                    return
                
                # Check permissions - ticket owner or staff can close
                is_owner = str(interaction.user.id) == ticket['user_id']
                is_staff = interaction.user.guild_permissions.manage_channels
                
                if not (is_owner or is_staff):
                    await interaction.response.send_message(
                        "❌ You don't have permission to close this ticket!",
                        ephemeral=True
                    )
                    return
                
                # Update ticket status
                await conn.execute("""
                    UPDATE tickets 
                    SET status = 'closed', closed_at = NOW()
                    WHERE channel_id = $1
                """, str(interaction.channel.id))
                
                # Send closing message
                embed = discord.Embed(
                    title="🔒 Ticket Closed",
                    description=f"**Closed by:** {interaction.user.mention}\n**Reason:** {reason}",
                    color=discord.Color.red()
                )
                embed.set_footer(text="This channel will be deleted in 10 seconds")
                
                await interaction.response.send_message(embed=embed)
                
                # Delete channel after delay
                await discord.utils.sleep_until(discord.utils.utcnow() + discord.timedelta(seconds=10))
                await interaction.channel.delete(reason=f"Ticket closed by {interaction.user}")
                
                print(f"Closed ticket in channel {interaction.channel.id}")
                
        except discord.NotFound:
            pass  # Channel already deleted
        except Exception as e:
            print(f"Error closing ticket: {e}")
            if not interaction.response.is_done():
                await interaction.response.send_message(
                    "❌ An error occurred while closing the ticket!",
                    ephemeral=True
                )
    
    @app_commands.command(name="closeticket", description="Close the current ticket")
    @app_commands.describe(reason="Reason for closing (optional)")
    async def close_ticket(self, interaction: discord.Interaction, reason: str = "No reason provided"):
        """Close a support ticket"""
        await self.close_ticket_handler(interaction, reason)
    
    @app_commands.command(name="assignticket", description="Assign a ticket to a support member")
    @app_commands.describe(member="The support member to assign")
    @app_commands.default_permissions(manage_channels=True)
    async def assign_ticket(self, interaction: discord.Interaction, member: discord.Member):
        """Assign a ticket to a support member"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                # Check if this channel is a ticket
                ticket = await conn.fetchrow("""
                    SELECT * FROM tickets 
                    WHERE channel_id = $1 AND status = 'open'
                """, str(interaction.channel.id))
                
                if not ticket:
                    await interaction.response.send_message(
                        "❌ This command can only be used in ticket channels!",
                        ephemeral=True
                    )
                    return
                
                # Create Discord user if not exists
                await conn.execute("""
                    INSERT INTO discord_users (id, username, discriminator, avatar, is_bot)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        discriminator = EXCLUDED.discriminator,
                        avatar = EXCLUDED.avatar
                """, str(member.id), member.name, member.discriminator,
                     member.avatar.key if member.avatar else None, member.bot)
                
                # Update ticket assignment
                await conn.execute("""
                    UPDATE tickets 
                    SET assigned_to = $1
                    WHERE channel_id = $2
                """, str(member.id), str(interaction.channel.id))
                
                # Give assigned member access to the channel
                await interaction.channel.set_permissions(
                    member,
                    read_messages=True,
                    send_messages=True
                )
                
                embed = discord.Embed(
                    title="👤 Ticket Assigned",
                    description=f"{member.mention} has been assigned to this ticket!",
                    color=discord.Color.green()
                )
                
                await interaction.response.send_message(embed=embed)
                print(f"Assigned ticket to {member}")
                
        except Exception as e:
            print(f"Error assigning ticket: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while assigning the ticket!",
                ephemeral=True
            )
    
    @app_commands.command(name="ticketlist", description="View all open tickets")
    @app_commands.default_permissions(manage_channels=True)
    async def list_tickets(self, interaction: discord.Interaction):
        """List all open tickets in the server"""
        
        if not self.bot.db_pool:
            await interaction.response.send_message("❌ Database connection not available!", ephemeral=True)
            return
        
        try:
            async with self.bot.db_pool.acquire() as conn:
                tickets = await conn.fetch("""
                    SELECT t.*, u.username 
                    FROM tickets t
                    JOIN discord_users u ON t.user_id = u.id
                    WHERE t.server_id = $1 AND t.status = 'open'
                    ORDER BY t.created_at DESC
                """, str(interaction.guild.id))
                
                if not tickets:
                    await interaction.response.send_message(
                        "❌ No open tickets in this server!",
                        ephemeral=True
                    )
                    return
                
                embed = discord.Embed(
                    title="🎫 Open Tickets",
                    description=f"There are {len(tickets)} open ticket(s)",
                    color=discord.Color.blue()
                )
                
                for ticket in tickets[:10]:  # Limit to 10
                    channel = interaction.guild.get_channel(int(ticket['channel_id']))
                    channel_mention = channel.mention if channel else "Channel Deleted"
                    
                    assigned = "Unassigned"
                    if ticket['assigned_to']:
                        assigned_user = interaction.guild.get_member(int(ticket['assigned_to']))
                        assigned = assigned_user.mention if assigned_user else "Unknown"
                    
                    embed.add_field(
                        name=f"📝 {ticket['subject'][:50]}",
                        value=f"User: <@{ticket['user_id']}>\nChannel: {channel_mention}\nAssigned: {assigned}\nPriority: {ticket['priority']}",
                        inline=False
                    )
                
                if len(tickets) > 10:
                    embed.set_footer(text=f"Showing 10 of {len(tickets)} tickets")
                
                await interaction.response.send_message(embed=embed)
                
        except Exception as e:
            print(f"Error listing tickets: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while fetching tickets!",
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(TicketsCog(bot))
