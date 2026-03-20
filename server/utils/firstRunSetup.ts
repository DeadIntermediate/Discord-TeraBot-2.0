/**
 * First-run setup wizard.
 *
 * Runs before the server starts. If required env vars are missing from .env,
 * prompts the user interactively and writes their answers back to .env so the
 * values persist for all future runs.
 */

import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadDotenv } from 'dotenv';

const ENV_PATH = resolve(process.cwd(), '.env');
const EXAMPLE_PATH = resolve(process.cwd(), '.env.example');

// ── .env read/write helpers ───────────────────────────────────────────────────

function readEnvFile(): string {
  if (existsSync(ENV_PATH)) return readFileSync(ENV_PATH, 'utf8');
  if (existsSync(EXAMPLE_PATH)) return readFileSync(EXAMPLE_PATH, 'utf8');
  return '';
}

function setEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*`, 'm');
  return re.test(content) ? content.replace(re, line) : content + `\n${line}\n`;
}

function writeEnvFile(content: string) {
  writeFileSync(ENV_PATH, content, 'utf8');
}

// ── Masked prompt (hides input, shows * per character) ────────────────────────

async function promptSecret(rl: any, question: string): Promise<string> {
  // Write the question ourselves, then put stdin in raw mode so we can
  // intercept each keystroke without echoing it.
  return new Promise((resolve) => {
    let value = '';
    output.write(question);

    if (input.isTTY) {
      input.setRawMode(true);
    }
    input.resume();
    input.setEncoding('utf8');

    const onData = (char: string) => {
      if (char === '\r' || char === '\n') {
        // Enter pressed
        if (input.isTTY) input.setRawMode(false);
        input.pause();
        input.removeListener('data', onData);
        output.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        // Ctrl+C
        output.write('\n');
        process.exit(0);
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write('\b \b');
        }
      } else {
        value += char;
        output.write('*');
      }
    };

    input.on('data', onData);
  });
}

// ── Questions ─────────────────────────────────────────────────────────────────

interface Question {
  key: string;
  label: string;
  required: boolean;
  secret?: boolean;
  hint?: string;
}

const QUESTIONS: Question[] = [
  {
    key: 'DISCORD_BOT_TOKEN',
    label: 'Discord Bot Token',
    required: true,
    secret: true,
    hint: 'discord.com/developers/applications → Your App → Bot → Token',
  },
  {
    key: 'DISCORD_CLIENT_ID',
    label: 'Discord Application / Client ID',
    required: true,
    hint: 'discord.com/developers/applications → Your App → General Information',
  },
  {
    key: 'DATABASE_URL',
    label: 'PostgreSQL Database URL',
    required: true,
    hint: 'postgresql://user:password@host:5432/dbname',
  },
  {
    key: 'RAWG_API_KEY',
    label: 'RAWG API Key (for /game commands)',
    required: false,
    hint: 'rawg.io/apidocs — free key, leave blank to skip',
  },
  {
    key: 'TWITCH_CLIENT_ID',
    label: 'Twitch Client ID (for stream notifications)',
    required: false,
    hint: 'dev.twitch.tv/console/apps — leave blank to skip',
  },
  {
    key: 'TWITCH_CLIENT_SECRET',
    label: 'Twitch Client Secret',
    required: false,
    secret: true,
    hint: 'Same Twitch app as above — leave blank to skip',
  },
  {
    key: 'YOUTUBE_API_KEY',
    label: 'YouTube Data API Key (for stream notifications)',
    required: false,
    hint: 'console.cloud.google.com → YouTube Data API v3 — leave blank to skip',
  },
];

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSetupIfNeeded(): Promise<void> {
  // Load whatever is already in .env into process.env
  loadDotenv({ path: ENV_PATH });

  // Determine which required vars are missing
  const missing = QUESTIONS.filter(q => q.required && !process.env[q.key]);
  if (missing.length === 0) return; // Nothing to do

  const banner = `
╔══════════════════════════════════════════════════════════════╗
║              TeraBot 2.0 — First-Run Setup                  ║
╠══════════════════════════════════════════════════════════════╣
║  Some required configuration is missing.                     ║
║  Answer the prompts below and your answers will be saved     ║
║  to .env so you won't be asked again.                        ║
║                                                              ║
║  Press Enter to skip optional items.                         ║
╚══════════════════════════════════════════════════════════════╝
`;
  output.write(banner + '\n');

  const rl = createInterface({ input, output, terminal: false });
  let envContent = readEnvFile();

  for (const q of QUESTIONS) {
    const current = process.env[q.key];

    // Skip if already set
    if (current) continue;

    // Skip optional if we already ran through required ones and the user
    // hasn't been asked yet — but still ask them once
    const tag = q.required ? ' (required)' : ' (optional, press Enter to skip)';
    output.write(`\n${q.required ? '🔴' : '🟡'} ${q.label}${tag}\n`);
    if (q.hint) output.write(`   ↳ ${q.hint}\n`);

    let answer: string;
    if (q.secret) {
      answer = await promptSecret(rl, '   → ');
    } else {
      answer = (await rl.question('   → ')).trim();
    }

    if (!answer) {
      if (q.required) {
        output.write(`   ⚠️  This field is required. Re-run the bot once you have the value.\n`);
        // Write a blank placeholder so we still exit cleanly
        envContent = setEnvValue(envContent, q.key, '');
      }
      continue;
    }

    // Save to file and live process.env
    envContent = setEnvValue(envContent, q.key, answer);
    process.env[q.key] = answer;
    output.write(`   ✅ Saved.\n`);
  }

  rl.close();
  writeEnvFile(envContent);
  output.write('\n✅ Configuration saved to .env\n\n');
}
