import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { warn, error as logError } from './logger';

// Load .env from project root
loadDotenv({ path: resolve(process.cwd(), '.env') });

// Define schema for all configuration
const ConfigSchema = z.object({
  // Discord
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().optional(),
  
  // Database  
  DATABASE_URL: z.string().optional(),
  SKIP_DB: z.enum(['true', 'false']).default('false'),
  
  // APIs (optional)
  RAWG_API_KEY: z.string().optional(),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) return config;

  try {
    config = ConfigSchema.parse(process.env);
    
    // Log which optional features are available
    if (!config.RAWG_API_KEY) {
      warn('⚠️  RAWG_API_KEY not set — /game commands will not work');
    }
    if (!config.TWITCH_CLIENT_ID) {
      warn('⚠️  TWITCH_CLIENT_ID not set — Twitch stream notifications disabled');
    }
    if (!config.YOUTUBE_API_KEY) {
      warn('⚠️  YOUTUBE_API_KEY not set — YouTube notifications disabled');
    }
    
    if (config.SKIP_DB === 'true') {
      warn('⚠️  SKIP_DB=true — Database disabled, running in memory-stub mode');
    }
    
    return config;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
      logError(`\n❌ Configuration Error:\n${issues}\n`);
      
      const required = [
        'DISCORD_BOT_TOKEN'
      ];
      const optional = [
        'DATABASE_URL (unless SKIP_DB=true)',
        'RAWG_API_KEY',
        'TWITCH_CLIENT_ID & TWITCH_CLIENT_SECRET',
        'YOUTUBE_API_KEY'
      ];
      
      console.error('\nRequired configuration:');
      required.forEach(item => console.error(`  • ${item}`));
      console.error('\nOptional configuration:');
      optional.forEach(item => console.error(`  • ${item}`));
      console.error('\nCreate a .env file with these variables or set them in your environment.\n');
    }
    throw err;
  }
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}
