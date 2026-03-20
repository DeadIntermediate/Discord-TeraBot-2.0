import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../db';
import { streamNotifications } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { TwitchAPI } from './twitchAPI';
import { YouTubeAPI } from './youtubeAPI';
import { info, warn, error } from './logger';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const twitch = new TwitchAPI();
const youtube = new YouTubeAPI();

// ── Per-platform live check ───────────────────────────────────────────────────

async function checkStream(platform: string, username: string, platformUserId: string | null) {
  if (platform === 'twitch') {
    return twitch.getStreamData(username);
  }

  if (platform === 'youtube') {
    // YouTube API requires a channelId, not a username.
    // If we already resolved it, use it; otherwise resolve now.
    let channelId = platformUserId;
    if (!channelId) {
      channelId = await youtube.getChannelId(username);
    }
    if (!channelId) return { isLive: false };
    return youtube.getStreamData(channelId);
  }

  // Kick has no public API
  return null;
}

// ── Notification embed ────────────────────────────────────────────────────────

function buildLiveEmbed(
  platform: string,
  username: string,
  title?: string,
  game?: string,
  viewers?: number,
  thumbnailUrl?: string,
): EmbedBuilder {
  const COLORS: Record<string, number> = {
    twitch: 0x9146FF,
    youtube: 0xFF0000,
    kick: 0x53FC18,
  };
  const ICONS: Record<string, string> = {
    twitch: 'https://brand.twitch.tv/assets/images/black_RGB.png',
    youtube: 'https://www.youtube.com/s/desktop/28b0985e/img/favicon_144x144.png',
    kick: 'https://kick.com/favicon.ico',
  };
  const URLS: Record<string, (u: string) => string> = {
    twitch: u => `https://twitch.tv/${u}`,
    youtube: u => `https://youtube.com/@${u}`,
    kick: u => `https://kick.com/${u}`,
  };

  const embed = new EmbedBuilder()
    .setColor(COLORS[platform] ?? 0x7289DA)
    .setAuthor({ name: `${username} is now live on ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`, iconURL: ICONS[platform] })
    .setTitle(title ?? `${username} is streaming!`)
    .setURL(URLS[platform]?.(username) ?? '')
    .setTimestamp()
    .setFooter({ text: platform.charAt(0).toUpperCase() + platform.slice(1) });

  if (game)         embed.addFields({ name: 'Playing', value: game, inline: true });
  if (viewers != null) embed.addFields({ name: 'Viewers', value: viewers.toLocaleString(), inline: true });
  if (thumbnailUrl) embed.setImage(thumbnailUrl);

  return embed;
}

// ── Main poll ─────────────────────────────────────────────────────────────────

async function pollStreams(client: Client) {
  let rows: Awaited<ReturnType<typeof db.select>>
  try {
    rows = await db.select().from(streamNotifications).where(eq(streamNotifications.isActive, true));
  } catch (err) {
    error('Stream monitor: failed to query stream notifications:', err);
    return;
  }

  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      const result = await checkStream(row.platform, row.username, row.platformUserId ?? null);

      // Kick or unrecognised platform — skip silently
      if (result === null) continue;

      const wasLive = row.isLive ?? false;
      const nowLive = result.isLive;

      // ── Transition: offline → live ──────────────────────────────────────────
      if (!wasLive && nowLive) {
        // Persist live state and stream details
        const resolvedChannelId =
          row.platform === 'youtube' && !row.platformUserId
            ? await youtube.getChannelId(row.username)
            : row.platformUserId;

        await db.update(streamNotifications)
          .set({
            isLive: true,
            liveTitle: result.title ?? null,
            liveGame: result.game ?? null,
            liveViewers: result.viewers ?? null,
            liveStartedAt: new Date(),
            lastChecked: new Date(),
            platformUserId: resolvedChannelId ?? row.platformUserId,
          })
          .where(eq(streamNotifications.id, row.id));

        // Send notification
        const channel = client.channels.cache.get(row.channelId) as TextChannel | undefined;
        if (!channel?.isTextBased()) {
          warn(`Stream monitor: channel ${row.channelId} not found or not text-based`);
          continue;
        }

        const embed = buildLiveEmbed(row.platform, row.username, result.title, result.game, result.viewers, result.thumbnailUrl);
        const content = row.roleIdToPing ? `<@&${row.roleIdToPing}>` : undefined;
        const customMsg = row.notificationMessage
          ? row.notificationMessage
              .replace('{username}', row.username)
              .replace('{title}', result.title ?? '')
              .replace('{game}', result.game ?? '')
          : undefined;

        const msg = await channel.send({
          content: customMsg ?? content,
          embeds: [embed],
        });

        // Store message ID so we could edit it later if needed
        await db.update(streamNotifications)
          .set({ messageId: msg.id })
          .where(eq(streamNotifications.id, row.id));

        info(`Stream monitor: ${row.username} (${row.platform}) went live — notified #${channel.name}`);
      }

      // ── Transition: live → offline ──────────────────────────────────────────
      else if (wasLive && !nowLive) {
        await db.update(streamNotifications)
          .set({
            isLive: false,
            liveTitle: null,
            liveGame: null,
            liveViewers: null,
            liveStartedAt: null,
            messageId: null,
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, row.id));

        info(`Stream monitor: ${row.username} (${row.platform}) went offline`);
      }

      // ── Still live — update viewer count ───────────────────────────────────
      else if (wasLive && nowLive) {
        await db.update(streamNotifications)
          .set({
            liveViewers: result.viewers ?? null,
            liveTitle: result.title ?? null,
            lastChecked: new Date(),
          })
          .where(eq(streamNotifications.id, row.id));
      }

      // ── Still offline — just update lastChecked ────────────────────────────
      else {
        await db.update(streamNotifications)
          .set({ lastChecked: new Date() })
          .where(eq(streamNotifications.id, row.id));
      }
    } catch (err) {
      error(`Stream monitor: error processing ${row.username} (${row.platform}):`, err);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startStreamMonitor(client: Client) {
  if (intervalHandle) return; // already running

  info('Stream monitor: started (polling every 5 minutes)');

  // Run once immediately, then on interval
  pollStreams(client).catch(err => error('Stream monitor: initial poll error:', err));

  intervalHandle = setInterval(() => {
    pollStreams(client).catch(err => error('Stream monitor: poll error:', err));
  }, POLL_INTERVAL_MS);
}

export function stopStreamMonitor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    info('Stream monitor: stopped');
  }
}
