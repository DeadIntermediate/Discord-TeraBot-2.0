import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  Guild,
  VoiceState,
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
  AudioPlayer,
  VoiceConnection,
} from '@discordjs/voice';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import ffmpegStatic from 'ffmpeg-static';
import { info, error } from '../../utils/logger';

if (ffmpegStatic) process.env.FFMPEG_PATH = ffmpegStatic;

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_MAX = 15;
const IDLE_DISCONNECT_MS  = 5 * 60 * 1000; // disconnect after 5 min of silence
const EMPTY_CHANNEL_GRACE = 30 * 1000;      // wait 30 s after last human leaves

// ── Voice map ────────────────────────────────────────────────────────────────

const VOICE_MAP: Record<string, { female: string; male: string; flag: string }> = {
  american:       { female: 'en-US-AriaNeural',    male: 'en-US-GuyNeural',       flag: '🇺🇸' },
  british:        { female: 'en-GB-SoniaNeural',   male: 'en-GB-RyanNeural',      flag: '🇬🇧' },
  australian:     { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural',   flag: '🇦🇺' },
  canadian:       { female: 'en-CA-ClaraNeural',   male: 'en-CA-LiamNeural',      flag: '🇨🇦' },
  irish:          { female: 'en-IE-EmilyNeural',   male: 'en-IE-ConnorNeural',    flag: '🇮🇪' },
  indian:         { female: 'en-IN-NeerjaNeural',  male: 'en-IN-PrabhatNeural',   flag: '🇮🇳' },
  'south-african':{ female: 'en-ZA-LeahNeural',    male: 'en-ZA-LukeNeural',      flag: '🇿🇦' },
  nigerian:       { female: 'en-NG-EzinneNeural',  male: 'en-NG-AbeoNeural',      flag: '🇳🇬' },
  philippine:     { female: 'en-PH-RosaNeural',    male: 'en-PH-JamesNeural',     flag: '🇵🇭' },
  singaporean:    { female: 'en-SG-LunaNeural',    male: 'en-SG-WayneNeural',     flag: '🇸🇬' },
  'new-zealand':  { female: 'en-NZ-MollyNeural',   male: 'en-NZ-MitchellNeural',  flag: '🇳🇿' },
};

const ACCENT_CHOICES = Object.keys(VOICE_MAP).map(key => ({
  name: key.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
  value: key,
}));

const GENDER_CHOICES = [
  { name: 'Female', value: 'female' },
  { name: 'Male',   value: 'male'   },
] as const;

const DEFAULT_VOICE       = VOICE_MAP['american'].female;
const DEFAULT_VOICE_LABEL = '🇺🇸 American — Female';

// ── Per-user voice preferences (session-scoped, in-memory) ──────────────────

const userVoicePrefs = new Map<string, { voice: string; voiceLabel: string }>();

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  text: string;
  voice: string;
  voiceLabel: string;
  userId: string;
}

interface GuildTTSState {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: QueueItem[];
  isPlaying: boolean;
  defaultVoice: string;
  defaultVoiceLabel: string;
  idleTimer: NodeJS.Timeout | null;
  emptyTimer: NodeJS.Timeout | null;
}

const guildStates = new Map<string, GuildTTSState>();

// ── Text sanitization ────────────────────────────────────────────────────────

function sanitizeText(raw: string, guild: Guild): string {
  return raw
    // <@123> / <@!123>  →  display name
    .replace(/<@!?(\d+)>/g, (_, id) => {
      const member = guild.members.cache.get(id);
      return member ? member.displayName : 'someone';
    })
    // <@&123>  →  role name
    .replace(/<@&(\d+)>/g, (_, id) => {
      const role = guild.roles.cache.get(id);
      return role ? `the ${role.name} role` : 'a role';
    })
    // <#123>  →  channel name
    .replace(/<#(\d+)>/g, (_, id) => {
      const ch = guild.channels.cache.get(id);
      return ch && 'name' in ch ? `the ${ch.name} channel` : 'a channel';
    })
    // <a:name:123> / <:name:123>  →  :name:
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
    // URLs  →  [link]
    .replace(/https?:\/\/\S+/g, '[link]')
    // Discord markdown noise
    .replace(/[*_~|`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Timer helpers ────────────────────────────────────────────────────────────

function clearIdleTimer(state: GuildTTSState): void {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
}

function startIdleTimer(state: GuildTTSState): void {
  clearIdleTimer(state);
  state.idleTimer = setTimeout(() => {
    const current = guildStates.get(state.guildId);
    if (!current || current.isPlaying) return;
    info(`TTS: idle timeout for guild ${state.guildId} — disconnecting`);
    current.connection.destroy();
  }, IDLE_DISCONNECT_MS);
}

// ── Audio helpers ────────────────────────────────────────────────────────────

async function synthesizeAndPlay(state: GuildTTSState, item: QueueItem): Promise<void> {
  state.isPlaying = true;
  clearIdleTimer(state);
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(item.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const audioStream = tts.toStream(item.text);
    const resource = createAudioResource(audioStream, { inputType: StreamType.Arbitrary });
    state.player.play(resource);
  } catch (err) {
    error('TTS synthesis error:', err);
    state.isPlaying = false;
    playNext(state);
  }
}

function playNext(state: GuildTTSState): void {
  if (state.queue.length === 0) {
    state.isPlaying = false;
    startIdleTimer(state);
    return;
  }
  const next = state.queue.shift()!;
  synthesizeAndPlay(state, next);
}

// ── Connection factory ───────────────────────────────────────────────────────

function createConnection(
  channelId: string,
  guildId: string,
  adapterCreator: any,
): GuildTTSState {
  const connection = joinVoiceChannel({
    channelId,
    guildId,
    adapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  const state: GuildTTSState = {
    guildId,
    connection,
    player,
    queue: [],
    isPlaying: false,
    defaultVoice: DEFAULT_VOICE,
    defaultVoiceLabel: DEFAULT_VOICE_LABEL,
    idleTimer: null,
    emptyTimer: null,
  };

  player.on(AudioPlayerStatus.Idle, () => {
    if (state.queue.length > 0) {
      playNext(state);
    } else {
      state.isPlaying = false;
      startIdleTimer(state);
    }
  });

  player.on('error', (err) => {
    error('TTS audio player error:', err);
    state.isPlaying = false;
    playNext(state);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    clearIdleTimer(state);
    if (state.emptyTimer) clearTimeout(state.emptyTimer);
    guildStates.delete(guildId);
    info(`TTS connection destroyed for guild ${guildId}`);
  });

  guildStates.set(guildId, state);
  return state;
}

// ── Empty-channel detection (called from voiceStateUpdate event) ─────────────

export function handleTTSVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
  // Ignore the bot's own state changes
  if (oldState.member?.user.bot) return;

  const guildId = oldState.guild.id;
  const state = guildStates.get(guildId);
  if (!state) return;

  const botChannelId = state.connection.joinConfig.channelId;

  // Someone joined the bot's channel — cancel any pending empty-channel timer
  if (newState.channelId === botChannelId && state.emptyTimer) {
    clearTimeout(state.emptyTimer);
    state.emptyTimer = null;
    return;
  }

  // Someone left the bot's channel — check if it's now empty
  if (oldState.channelId !== botChannelId) return;

  const channel = oldState.channel;
  if (!channel) return;

  const humanCount = channel.members.filter(m => !m.user.bot).size;
  if (humanCount > 0) return;

  // Channel is empty — start grace-period countdown
  if (state.emptyTimer) return; // already counting down

  state.emptyTimer = setTimeout(() => {
    const current = guildStates.get(guildId);
    if (!current) return;

    // Re-check: someone may have rejoined during the grace period
    const ch = oldState.guild.channels.cache.get(current.connection.joinConfig.channelId!);
    if (ch && 'members' in ch && (ch as any).members.filter((m: any) => !m.user.bot).size > 0) {
      current.emptyTimer = null;
      return;
    }

    info(`TTS: voice channel empty in guild ${guildId} — disconnecting`);
    current.player.stop(true);
    current.queue = [];
    clearIdleTimer(current);
    current.connection.destroy();
  }, EMPTY_CHANNEL_GRACE);
}

// ── Subcommand handlers ──────────────────────────────────────────────────────

async function handleJoin(interaction: ChatInputCommandInteraction, member: GuildMember) {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: 'You need to be in a voice channel first.', ephemeral: true });
    return;
  }

  if (guildStates.has(interaction.guild!.id)) {
    await interaction.reply({ content: "I'm already connected. Use `/tts leave` first to move me.", ephemeral: true });
    return;
  }

  createConnection(voiceChannel.id, interaction.guild!.id, interaction.guild!.voiceAdapterCreator);
  info(`TTS joined ${voiceChannel.name} in guild ${interaction.guild!.id}`);
  await interaction.reply({ content: `🔊 Joined **${voiceChannel.name}**! Use \`/tts say\` to speak.` });
}

async function handleLeave(interaction: ChatInputCommandInteraction) {
  const state = guildStates.get(interaction.guild!.id);
  if (!state) {
    await interaction.reply({ content: "I'm not in a voice channel.", ephemeral: true });
    return;
  }

  state.player.stop(true);
  state.queue = [];
  state.connection.destroy();
  await interaction.reply({ content: '👋 Left the voice channel and cleared the queue.' });
}

async function handleSay(interaction: ChatInputCommandInteraction, member: GuildMember) {
  const rawText = interaction.options.getString('text', true);
  const guild   = interaction.guild!;
  const guildId = guild.id;
  const userId  = interaction.user.id;

  let state = guildStates.get(guildId);

  if (!state) {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: "I'm not in a voice channel. Join one and use `/tts join`, or run `/tts say` from inside a voice channel.",
        ephemeral: true,
      });
      return;
    }
    state = createConnection(voiceChannel.id, guildId, guild.voiceAdapterCreator);
    info(`TTS auto-joined ${voiceChannel.name} in guild ${guildId}`);
  }

  if (state.queue.length >= QUEUE_MAX) {
    await interaction.reply({
      content: `The queue is full (**${QUEUE_MAX}** items). Wait for some to finish first.`,
      ephemeral: true,
    });
    return;
  }

  const text = sanitizeText(rawText, guild);
  if (!text) {
    await interaction.reply({ content: 'Nothing left to say after filtering that text.', ephemeral: true });
    return;
  }

  // Cancel empty-channel timer — someone is actively using TTS
  if (state.emptyTimer) {
    clearTimeout(state.emptyTimer);
    state.emptyTimer = null;
  }
  clearIdleTimer(state);

  // Use the caller's personal voice preference, falling back to server default
  const userPref   = userVoicePrefs.get(userId);
  const voice      = userPref?.voice      ?? state.defaultVoice;
  const voiceLabel = userPref?.voiceLabel ?? state.defaultVoiceLabel;

  state.queue.push({ text, voice, voiceLabel, userId });

  if (!state.isPlaying) {
    playNext(state);
    await interaction.reply({ content: `🗣️ Speaking now! *(${voiceLabel})*`, ephemeral: true });
  } else {
    await interaction.reply({
      content: `✅ Added to queue at position **${state.queue.length}**. *(${voiceLabel})*`,
      ephemeral: true,
    });
  }
}

async function handleSkip(interaction: ChatInputCommandInteraction) {
  const state = guildStates.get(interaction.guild!.id);
  if (!state) {
    await interaction.reply({ content: "I'm not in a voice channel.", ephemeral: true });
    return;
  }

  if (!state.isPlaying && state.queue.length === 0) {
    await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
    return;
  }

  // stop() triggers AudioPlayerStatus.Idle → playNext() runs automatically
  state.player.stop(true);
  await interaction.reply({ content: '⏭️ Skipped.' });
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  const state = guildStates.get(interaction.guild!.id);
  if (!state) {
    await interaction.reply({ content: "I'm not in a voice channel.", ephemeral: true });
    return;
  }

  state.queue = []; // clear first so Idle handler doesn't start the next item
  state.player.stop(true);
  state.isPlaying = false;
  clearIdleTimer(state);
  await interaction.reply({ content: '⏹️ Stopped and cleared the queue.' });
}

async function handleQueue(interaction: ChatInputCommandInteraction) {
  const state = guildStates.get(interaction.guild!.id);
  if (!state) {
    await interaction.reply({ content: "I'm not in a voice channel.", ephemeral: true });
    return;
  }

  const lines = state.queue.map((item, i) => {
    const preview = item.text.length > 60 ? item.text.slice(0, 60) + '…' : item.text;
    const user = interaction.guild!.members.cache.get(item.userId);
    const name = user?.displayName ?? 'Unknown';
    return `**${i + 1}.** ${preview}\n  └ ${item.voiceLabel} · requested by ${name}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🗣️ TTS Queue')
    .setDescription(
      (state.isPlaying ? '▶️ **Speaking now…**\n\n' : '') +
      (lines.length > 0 ? lines.join('\n\n') : '*(nothing queued)*')
    )
    .setFooter({ text: `${state.queue.length} / ${QUEUE_MAX} slots used` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleVoice(interaction: ChatInputCommandInteraction) {
  const accent = interaction.options.getString('accent', true);
  const gender = interaction.options.getString('gender', true) as 'male' | 'female';

  const entry = VOICE_MAP[accent];
  if (!entry) {
    await interaction.reply({ content: 'Unknown accent. Use `/tts voices` to see all options.', ephemeral: true });
    return;
  }

  const voiceName  = entry[gender];
  const accentLabel = accent.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const genderLabel = gender.charAt(0).toUpperCase() + gender.slice(1);
  const label       = `${entry.flag} ${accentLabel} — ${genderLabel}`;

  // Save as this user's personal preference
  userVoicePrefs.set(interaction.user.id, { voice: voiceName, voiceLabel: label });

  await interaction.reply({
    content: `🎙️ Your personal TTS voice is now **${label}**. All your \`/tts say\` messages will use this voice.`,
    ephemeral: true,
  });
}

async function handleVoices(interaction: ChatInputCommandInteraction) {
  const state    = guildStates.get(interaction.guild!.id);
  const userPref = userVoicePrefs.get(interaction.user.id);
  const myLabel  = userPref?.voiceLabel
    ?? state?.defaultVoiceLabel
    ?? `${DEFAULT_VOICE_LABEL} (server default)`;

  const rows = Object.entries(VOICE_MAP).map(([key, entry]) => {
    const name = key.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${entry.flag} **${name}** — Female \`${entry.female}\` · Male \`${entry.male}\``;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎙️ Available TTS Voices')
    .setDescription(rows.join('\n'))
    .addFields(
      { name: '📌 Your current voice', value: myLabel, inline: false },
      { name: '💡 How to change',      value: '`/tts voice gender:Female accent:Irish`', inline: false },
    )
    .setFooter({ text: 'Each user has their own voice — use /tts voice to set yours.' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Command export ───────────────────────────────────────────────────────────

export const ttsCommand = {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Text-to-Speech in a voice channel')
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join your current voice channel'))
    .addSubcommand(sub =>
      sub.setName('say')
        .setDescription('Speak text aloud in the voice channel')
        .addStringOption(opt =>
          opt.setName('text')
            .setDescription('Text to speak (max 500 characters)')
            .setRequired(true)
            .setMaxLength(500)))
    .addSubcommand(sub =>
      sub.setName('skip')
        .setDescription('Skip the currently playing item'))
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop speaking and clear the entire queue'))
    .addSubcommand(sub =>
      sub.setName('queue')
        .setDescription('Show what is queued up'))
    .addSubcommand(sub =>
      sub.setName('voice')
        .setDescription('Set your personal TTS voice')
        .addStringOption(opt =>
          opt.setName('gender')
            .setDescription('Speaker gender')
            .setRequired(true)
            .addChoices(...GENDER_CHOICES))
        .addStringOption(opt =>
          opt.setName('accent')
            .setDescription('Regional accent')
            .setRequired(true)
            .addChoices(...ACCENT_CHOICES)))
    .addSubcommand(sub =>
      sub.setName('voices')
        .setDescription('List all available accents and voices'))
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Leave the voice channel and clear the queue')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const member     = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'join':   await handleJoin(interaction, member);   break;
        case 'say':    await handleSay(interaction, member);    break;
        case 'skip':   await handleSkip(interaction);           break;
        case 'stop':   await handleStop(interaction);           break;
        case 'queue':  await handleQueue(interaction);          break;
        case 'voice':  await handleVoice(interaction);          break;
        case 'voices': await handleVoices(interaction);         break;
        case 'leave':  await handleLeave(interaction);          break;
      }
    } catch (err) {
      error(`TTS error in subcommand "${subcommand}":`, err);
      const msg = { content: 'An error occurred with the TTS command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};
