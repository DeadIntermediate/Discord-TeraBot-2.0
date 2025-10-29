/**
 * Tera Bot Status Rotation Library
 * Curated personality statuses that rotate on a randomized schedule
 */

type BotStatus = {
  activity: string;
  text: string;
  type: number;
};

const WATCHING_SUBJECTS: string[] = (() => {
  const subjects = [
    'member counts',
    'XP leaderboards',
    'stream queues',
    'moderation queues',
    'audit logs',
    'support inboxes',
    'voice lounges',
    'event calendars',
    'giveaway trackers',
    'status rotations',
    'analytics dashboards',
    'roadmap updates',
    'role syncs',
    'backup schedules',
    'ticket queues',
    'community highlights',
  ];

  const descriptors = [
    'climbing',
    'holding steady',
    'lighting up',
    'staying calm',
    'running smoothly',
    'hitting goals',
    'staying on track',
    'getting applause',
  ];

  const combos: string[] = [];
  for (const subject of subjects) {
    for (const descriptor of descriptors) {
      combos.push(`the ${subject} ${descriptor}`);
    }
  }

  return combos.slice(0, 96);
})();

const PLAYING_ACTIVITIES: string[] = (() => {
  const subjects = [
    'XP calculator',
    'moderation toolkit',
    'stream alert system',
    'giveaway planner',
    'backup manager',
    'voice XP tracker',
    'command router',
    'log viewer',
    'dashboard builder',
    'embed designer',
    'status scheduler',
    'role reaction lab',
    'ticket helper',
    'automation studio',
    'analytics suite',
    'event coordinator',
  ];

  const modes = [
    'showcase',
    'speedrun',
    'remix',
    'challenge',
    'simulation',
    'playtest',
  ];

  const combos: string[] = [];
  for (const subject of subjects) {
    for (const mode of modes) {
      combos.push(`the ${subject} ${mode}`);
    }
  }

  return combos;
})();

const THINKING_TOPICS: string[] = (() => {
  const topics = [
    'stream alert accuracy',
    'voice XP balance',
    'text XP fairness',
    'moderation workflows',
    'automation coverage',
    'backup resilience',
    'logging clarity',
    'dashboard usability',
    'command discovery',
    'onboarding flow',
    'community rewards',
    'alert customization',
    'role synchronization',
    'event planning',
    'API resilience',
    'uptime safeguards',
  ];

  const angles = [
    'improvements',
    'next steps',
    'scale strategies',
    'quality boosts',
    'user insights',
    'future upgrades',
  ];

  const combos: string[] = [];
  for (const topic of topics) {
    for (const angle of angles) {
      combos.push(`about ${topic} ${angle}`);
    }
  }

  return combos;
})();

const LISTENING_TARGETS: string[] = (() => {
  const subjects = [
    'moderator feedback',
    'community suggestions',
    'stream highlights',
    'voice chat vibes',
    'support tickets',
    'feature requests',
    'QA reports',
    'leaderboard cheers',
    'music queues',
    'event recaps',
    'roadmap updates',
    'patch notes',
    'beta testers',
    'new member intros',
    'analytics alerts',
    'guild trends',
  ];

  const contexts = [
    'coming in live',
    'rolling through',
    'dropping by',
    'from every guild',
    'echoing back',
  ];

  const combos: string[] = [];
  for (const subject of subjects) {
    for (const context of contexts) {
      combos.push(`to ${subject} ${context}`);
    }
  }

  return combos;
})();

const DOING_ACTIONS: string[] = (() => {
  const tasks = [
    'voice XP trackers',
    'stream alerts',
    'role syncs',
    'backup schedules',
    'moderation logs',
    'analytics dashboards',
    'ticket queues',
    'embed templates',
    'giveaway flows',
    'notification timing',
    'database queries',
    'command handlers',
    'worker health checks',
    'staging builds',
    'release notes',
    'support threads',
  ];

  const actions = [
    'maintaining',
    'tuning',
    'auditing',
    'polishing',
    'upgrading',
  ];

  const combos: string[] = [];
  for (const action of actions) {
    for (const task of tasks) {
      combos.push(`on ${action} ${task}`);
    }
  }

  return combos;
})();

const STREAMING_SEGMENTS: string[] = (() => {
  const subjects = [
    'server metrics',
    'XP leaderboards',
    'event highlights',
    'mod tips & tricks',
    'community shout-outs',
    'release notes',
    'voice XP breakdowns',
    'Tera Bot tutorials',
    'live system checks',
    'status rotations',
    'automation workshops',
    'update previews',
    'roadmap briefings',
    'announcement rundowns',
    'support spotlights',
    'weekly recaps',
  ];

  const contexts = [
    'live',
    'with commentary',
    'for the crew',
    'on repeat',
  ];

  const combos: string[] = [];
  for (const subject of subjects) {
    for (const context of contexts) {
      combos.push(`${subject} ${context}`);
    }
  }

  return combos;
})();

const BOT_STATUS_CATALOG: BotStatus[] = [
  ...WATCHING_SUBJECTS.map(text => ({ activity: 'Watching', text, type: 3 })),
  ...PLAYING_ACTIVITIES.map(text => ({ activity: 'Playing', text, type: 0 })),
  ...THINKING_TOPICS.map(text => ({ activity: 'Thinking', text, type: 2 })),
  ...LISTENING_TARGETS.map(text => ({ activity: 'Listening', text, type: 2 })),
  ...DOING_ACTIONS.map(text => ({ activity: 'Doing', text, type: 0 })),
  ...STREAMING_SEGMENTS.map(text => ({ activity: 'Streaming', text, type: 1 })),
];

export const BOT_STATUSES: BotStatus[] = BOT_STATUS_CATALOG.slice(0, 512);

// Shuffle and truncate to exactly 2048 statuses
export function getShuffledStatuses(): typeof BOT_STATUSES {
  const allStatuses = [...BOT_STATUSES];
  
  // If we have more than 2048, shuffle and take first 2048
  if (allStatuses.length > 2048) {
    return allStatuses
      .sort(() => Math.random() - 0.5)
      .slice(0, 2048);
  }
  
  // If less than 2048, duplicate and shuffle until we have enough
  while (allStatuses.length < 2048) {
    const batch = BOT_STATUSES.sort(() => Math.random() - 0.5);
    allStatuses.push(...batch);
  }
  
  return allStatuses.slice(0, 2048).sort(() => Math.random() - 0.5);
}

// Get a random status
export function getRandomStatus() {
  return BOT_STATUSES[Math.floor(Math.random() * BOT_STATUSES.length)];
}

// Get a random interval in milliseconds (1 second to 2 hours)
export function getRandomInterval(): number {
  // Define time ranges
  const intervals = [
    // Seconds (1-10)
    { min: 1 * 1000, max: 10 * 1000, label: 'seconds' },
    // Minutes (1-30)
    { min: 1 * 60 * 1000, max: 30 * 60 * 1000, label: 'minutes' },
    // Hours (0.5-2)
    { min: 30 * 60 * 1000, max: 2 * 60 * 60 * 1000, label: 'hours' },
  ];

  // Pick a random interval range
  const selectedRange = intervals[Math.floor(Math.random() * intervals.length)];
  
  // Pick a random time within that range
  const randomInterval = Math.floor(
    Math.random() * (selectedRange.max - selectedRange.min) + selectedRange.min
  );

  return randomInterval;
}
