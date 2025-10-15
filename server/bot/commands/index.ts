import { moderationCommands } from './moderation';
import { utilityCommands } from './utility';
import { ticketCommands } from './tickets';
import { giveawayCommands } from './giveaways';
import { embedCommands } from './embeds';
import { roleReactionCommands } from './roleReactions';
import * as streamsCommand from './streams';

export const commands = [
  ...moderationCommands,
  ...utilityCommands,
  ...ticketCommands,
  ...giveawayCommands,
  ...embedCommands,
  ...roleReactionCommands,
  streamsCommand,
];
