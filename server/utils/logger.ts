const levelPriority: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel = levelPriority[configured] ?? 2;

function shouldLog(level: keyof typeof levelPriority) {
  return levelPriority[level] <= currentLevel;
}

export function info(...args: any[]) {
  if (shouldLog('info')) console.info(...args);
}

export function warn(...args: any[]) {
  if (shouldLog('warn')) console.warn(...args);
}

export function error(...args: any[]) {
  if (shouldLog('error')) console.error(...args);
}

export function debug(...args: any[]) {
  if (shouldLog('debug')) console.debug(...args);
}

export default { info, warn, error, debug };
