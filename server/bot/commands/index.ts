import { moderationCommands } from './moderation'
import { utilityCommands } from './utility'
import { ticketCommands } from './tickets'
import { giveawayCommands } from './giveaways'
import { embedCommands } from './embeds'
import { roleReactionCommands } from './roleReactions'
import * as streamsCommand from './streams'
import * as gamesCommand from './games'
import * as gamehelpCommand from './gamehelp'
import * as gamedemoCommand from './gamedemo'
// CAH commands removed
import * as helpCommand from './help'
import * as socialMediaCommand from './socialmedia'

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
  // CAH commands removed
  helpCommand,
  socialMediaCommand,
]
