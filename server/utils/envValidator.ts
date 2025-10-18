/**
 * Environment Variable Validator
 * Validates required environment variables and provides helpful error messages
 */
import { info, warn, error } from './logger';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check required environment variables
  const requiredVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN
  };

  const skipDb = process.env.SKIP_DB === 'true';
  const skipDiscord = process.env.SKIP_DISCORD === 'true';

  // Validate DATABASE_URL
  if (!requiredVars.DATABASE_URL && !skipDb) {
    result.isValid = false;
    result.errors.push('DATABASE_URL is not set');
    result.errors.push('Set it to: postgresql://username:password@host:port/database');
  } else if (requiredVars.DATABASE_URL) {
    // Validate DATABASE_URL format
    const dbUrlPattern = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
    if (!dbUrlPattern.test(requiredVars.DATABASE_URL)) {
      result.isValid = false;
      result.errors.push('DATABASE_URL format is invalid');
      result.errors.push('Expected format: postgresql://username:password@host:port/database');
    }
  }

  // Validate DISCORD_BOT_TOKEN
  if (!requiredVars.DISCORD_BOT_TOKEN && !skipDiscord) {
    result.isValid = false;
    result.errors.push('DISCORD_BOT_TOKEN is not set');
    result.errors.push('Get your bot token from https://discord.com/developers/applications');
  } else if (requiredVars.DISCORD_BOT_TOKEN) {
    // Basic token format validation
    if (requiredVars.DISCORD_BOT_TOKEN.length < 50) {
      result.warnings.push('DISCORD_BOT_TOKEN seems too short - verify it is correct');
    }
  }

  // Check optional environment variables
  const optionalVars = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  };

  if (!optionalVars.NODE_ENV) {
    result.warnings.push('NODE_ENV is not set (defaulting to production)');
  }

  if (!optionalVars.PORT) {
    result.warnings.push('PORT is not set (defaulting to 5000)');
  }

  return result;
}

export function displayValidationResults(result: ValidationResult): void {
  info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  info('🔍 ENVIRONMENT VARIABLE VALIDATION');
  info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (result.isValid) {
    info('✅ All required environment variables are set correctly');
  } else {
    error('❌ Environment validation failed:');
    result.errors.forEach(err => {
      error(`   • ${err}`);
    });
  }

  if (result.warnings.length > 0) {
    warn('\n⚠️  Warnings:');
    result.warnings.forEach(warning => {
      warn(`   • ${warning}`);
    });
  }

  info('');
}