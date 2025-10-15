import { moderationCommands } from './moderation';
import { utilityCommands } from './utility';
import { ticketCommands } from './tickets';
import { giveawayCommands } from './giveaways';
import { embedCommands } from './embeds';
import { roleReactionCommands } from './roleReactions';

export const commands = [
  ...moderationCommands,
  ...utilityCommands,
  ...ticketCommands,
  ...giveawayCommands,
  ...embedCommands,
  ...roleReactionCommands,
];
