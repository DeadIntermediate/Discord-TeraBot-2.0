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
import * as helpCommand from './help'
import { ttsCommand } from './tts'
import { contextMenuCommands } from './contextMenus'
import { panelCommand } from './panels'

export const commands = [
  ...moderationCommands,
  ...utilityCommands,
  ...ticketCommands,
  ...giveawayCommands,
  ...embedCommands,
  ...roleReactionCommands,
  ...contextMenuCommands,
  panelCommand,
  streamsCommand,
  gamesCommand,
  gamehelpCommand,
  gamedemoCommand,
  helpCommand,
  ttsCommand,
]
