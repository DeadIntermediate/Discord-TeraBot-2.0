import { moderationCommands } from './moderation';
import { utilityCommands } from './utility';

export const commands = [
  ...moderationCommands,
  ...utilityCommands,
];
