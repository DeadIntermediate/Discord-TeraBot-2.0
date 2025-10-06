import discord
from discord.ext import commands, tasks
import asyncio
import os
import asyncpg
from dotenv import load_dotenv
import logging
import random

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)

class DiscordBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        intents.guilds = True
        intents.guild_messages = True
        intents.guild_reactions = True
        intents.voice_states = True
        
        super().__init__(
            command_prefix='!',
            intents=intents,
            help_command=None
        )
        
        # Database connection will be initialized in setup_hook
        self.db_pool = None
        self.status_index = 0
    
    async def setup_hook(self):
        """Called when the bot is starting up"""
        # Initialize database connection
        try:
            database_url = os.getenv('DATABASE_URL')
            if database_url:
                self.db_pool = await asyncpg.create_pool(database_url)
                print("Database connection established")
            else:
                print("Warning: DATABASE_URL not found")
        except Exception as e:
            print(f"Failed to connect to database: {e}")
        
        # Load cogs
        initial_cogs = [
            'cogs.moderation',
            'cogs.utility', 
            'cogs.events',
            'cogs.leveling',
            'cogs.giveaways',
            'cogs.role_reactions',
            'cogs.tickets',
            'cogs.streams',
            'cogs.anti_invite',
            'cogs.embeds'
        ]
        
        for cog in initial_cogs:
            try:
                await self.load_extension(cog)
                print(f"Loaded {cog}")
            except Exception as e:
                print(f"Failed to load {cog}: {e}")
        
        # Sync slash commands
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} command(s)")
        except Exception as e:
            print(f"Failed to sync commands: {e}")
    
    async def on_ready(self):
        """Called when the bot has logged in"""
        print(f'{self.user} has connected to Discord!')
        print(f'Bot is in {len(self.guilds)} guilds')
        
        # Start status rotation with random intervals
        if not self.change_status.is_running():
            self.change_status.start()
    
    @tasks.loop()
    async def change_status(self):
        """Rotate through different status messages with random intervals"""
        # Get total member count across all guilds
        total_members = sum(guild.member_count for guild in self.guilds)
        
        # Define status rotation list with fun and retro games
        statuses = [
            (discord.ActivityType.watching, f"{len(self.guilds)} servers"),
            (discord.ActivityType.watching, f"{total_members:,} members"),
            (discord.ActivityType.listening, "/help for commands"),
            (discord.ActivityType.playing, "Pac-Man 🟡"),
            (discord.ActivityType.playing, "Space Invaders 👾"),
            (discord.ActivityType.playing, "Pong 🏓"),
            (discord.ActivityType.playing, "Tetris 🟦"),
            (discord.ActivityType.playing, "Snake 🐍"),
            (discord.ActivityType.playing, "Galaga 🚀"),
            (discord.ActivityType.watching, "you type..."),
            (discord.ActivityType.listening, "to coffee brewing ☕"),
            (discord.ActivityType.competing, "in a staring contest 👀"),
            (discord.ActivityType.watching, "the server grow 📈"),
            (discord.ActivityType.playing, "hide and seek with bugs 🐛"),
            (discord.ActivityType.listening, "to keyboard clicks ⌨️"),
            (discord.ActivityType.watching, "pixels move"),
            (discord.ActivityType.playing, "with bits and bytes"),
            (discord.ActivityType.competing, "in the meme olympics 🏅"),
        ]
        
        # Pick a random status instead of sequential
        activity_type, status_text = random.choice(statuses)
        
        # Update bot status
        await self.change_presence(
            status=discord.Status.online,
            activity=discord.Activity(type=activity_type, name=status_text)
        )
        
        # Wait a random interval between 2-5 minutes before next change
        wait_time = random.randint(120, 300)  # 2-5 minutes in seconds
        await asyncio.sleep(wait_time)
    
    @change_status.before_loop
    async def before_change_status(self):
        """Wait until bot is ready before starting status rotation"""
        await self.wait_until_ready()
    
    async def close(self):
        """Called when the bot is shutting down"""
        if self.db_pool:
            await self.db_pool.close()
        await super().close()

async def main():
    bot = DiscordBot()
    
    # Get Discord bot token
    token = os.getenv('DISCORD_BOT_TOKEN')
    if not token:
        print("Error: DISCORD_BOT_TOKEN environment variable not set")
        return
    
    try:
        await bot.start(token)
    except KeyboardInterrupt:
        print("Bot stopped by user")
    except Exception as e:
        print(f"Bot error: {e}")
    finally:
        await bot.close()

if __name__ == "__main__":
    asyncio.run(main())