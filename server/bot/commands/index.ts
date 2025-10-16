import { moderationCommands } from './moderation';
import { utilityCommands } from './utility';
import { ticketCommands } from './tickets';
import { giveawayCommands } from './giveaways';
import { embedCommands } from './embeds';
import { roleReactionCommands } from './roleReactions';
import * as streamsCommand from './streams';
import * as gamesCommand from './games';
import * as gamehelpCommand from './gamehelp';
import * as gamedemoCommand from './gamedemo';
import * as cahCommand from './cah';
import * as cahadminCommand from './cahadmin';

export const commands = [
  ...moderationCommands,
  ...utilityCommands,
  ...ticketCommands,
  ...giveawayCommands,
  ...embedCommands,
  ...roleReactionCommands,
  streamsCommand,
  gamesCommand,
  gamehelpCommand,
  gamedemoCommand,
  cahCommand,
  cahadminCommand,
];
