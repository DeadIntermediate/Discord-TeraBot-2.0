/**
 * XP formula: level N requires (N × 100) XP to advance.
 *   Level 1→2:  100 XP
 *   Level 2→3:  200 XP
 *   Level 3→4:  300 XP
 *   ...
 * Total XP to reach level N = 100 × N(N-1)/2
 */
export const XP_PER_LEVEL_MULTIPLIER = 100;

export interface LevelInfo {
  level: number;       // current level (starts at 1)
  xpInLevel: number;   // XP earned within the current level
  xpForNext: number;   // XP needed to reach next level
}

export function calculateLevel(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, totalXp);

  while (remaining >= XP_PER_LEVEL_MULTIPLIER * level) {
    remaining -= XP_PER_LEVEL_MULTIPLIER * level;
    level++;
  }

  return {
    level,
    xpInLevel: remaining,
    xpForNext: XP_PER_LEVEL_MULTIPLIER * level,
  };
}
