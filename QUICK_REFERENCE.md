# Quick Reference: New Bot Framework

## Quick Start for New Commands

### 1. Basic Command Structure
```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../framework';
import { ResponseBuilder } from '../framework/ResponseBuilder';
import { ValidationHelpers } from '../framework/ValidationHelpers';

export const myCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('Does something cool')
    .addStringOption(opt => opt.setName('arg').setRequired(true)),
  
  cooldown: 3000, // Optional: milliseconds between uses
  requiredPermissions: [PermissionFlagsBits.ManageMessages], // Optional
  
  async execute(interaction) {
    // Your command code here
  }
};
```

---

## ResponseBuilder Quick Guide

### Success Response
```typescript
await interaction.reply(
  ResponseBuilder.success('Operation Complete')
    .setDescription('The operation was successful!')
    .addField('Result', 'Success', true)
    .build()
);
```

### Error Response
```typescript
await interaction.reply(
  ResponseBuilder.error('Operation Failed')
    .setDescription('An error occurred.')
    .setEphemeral() // Private message
    .build()
);
```

### Warning/Info
```typescript
ResponseBuilder.warning('Warning Title')
ResponseBuilder.info('Info Title')
```

### With Buttons
```typescript
ResponseBuilder.success('Choose an Action')
  .addButtonRow([
    ResponseBuilder.createButton('btn_id_1', 'Button 1'),
    ResponseBuilder.createButton('btn_id_2', 'Button 2', ButtonStyle.Danger),
  ])
  .build()
```

---

## ValidationHelpers Quick Guide

### Guild Validation
```typescript
if (!await ValidationHelpers.requireGuild(interaction)) return;
```

### Member Validation
```typescript
const member = await ValidationHelpers.requireMember(interaction, userId);
if (!member) return;
```

### Permission Validation
```typescript
if (!await ValidationHelpers.requirePermission(interaction, PermissionFlagsBits.Ban)) return;
```

### Bot Role Validation
```typescript
if (!await ValidationHelpers.validateBotCanInteract(interaction, targetMember)) return;
```

### Input Validation
```typescript
if (!await ValidationHelpers.validateStringLength(interaction, name, 3, 50, 'Name')) return;
if (!await ValidationHelpers.validateNumberRange(interaction, age, 1, 120, 'Age')) return;
```

---

## CommandManager Benefits

### Automatic Cooldowns
```typescript
cooldown: 5000 // 5 seconds between uses - automatic!
```

### Automatic Permission Checking
```typescript
requiredPermissions: [PermissionFlagsBits.KickMembers]
// CommandManager checks before execute() is called
```

### Automatic Error Handling
- All uncaught errors in `execute()` are caught
- User gets consistent error message
- Error logged for debugging

---

## File Locations

```
Framework Files:
- server/bot/framework/CommandManager.ts
- server/bot/framework/EventManager.ts
- server/bot/framework/ResponseBuilder.ts
- server/bot/framework/ValidationHelpers.ts
- server/bot/framework/index.ts

Examples:
- server/bot/commands/moderation-refactored-example.ts

Documentation:
- MODULARITY_GUIDE.md (full guide)
- OPTIMIZATION_REPORT.md (detailed report)
```

---

## Import Statements

```typescript
// Framework
import { CommandManager, Command } from '../framework';
import { ResponseBuilder, ResponseType } from '../framework';
import { ValidationHelpers } from '../framework';
import { EventManager, EventHandler } from '../framework';

// Discord
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ButtonStyle 
} from 'discord.js';

// Storage
import { storage } from '../../storage';
```

---

## Common Patterns

### Simple Command
```typescript
export const simpleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('simple')
    .setDescription('Simple command'),
  
  async execute(interaction) {
    await interaction.reply(
      ResponseBuilder.success('Done').build()
    );
  }
};
```

### Command with Validation
```typescript
export const validatedCommand: Command = {
  data: new SlashCommandBuilder()...
  requiredPermissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction) {
    if (!await ValidationHelpers.requireGuild(interaction)) return;
    // Command code
  }
};
```

### Command with User Target
```typescript
export const targetCommand: Command = {
  data: new SlashCommandBuilder()
    .addUserOption(opt => opt.setName('target').setRequired(true)),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target', true);
    const member = await ValidationHelpers.requireMember(interaction, target.id);
    if (!member) return;
    
    if (!await ValidationHelpers.validateBotCanInteract(interaction, member)) return;
    // Command code
  }
};
```

---

## Response Types

| Type | Color | Usage |
|------|-------|-------|
| `success()` | Green (0x2ecc71) | ✅ Successful operations |
| `error()` | Red (0xff0000) | ❌ Failed operations |
| `warning()` | Yellow (0xf39c12) | ⚠️ Warnings |
| `info()` | Blue (0x3498db) | ℹ️ Information |

---

## Cooldown Examples

```typescript
// No cooldown (default)
// Users can spam

// 1 second cooldown
cooldown: 1000

// 5 second cooldown
cooldown: 5000

// 30 second cooldown  
cooldown: 30000

// 1 minute cooldown
cooldown: 60000
```

---

## Testing a Refactored Command

1. Build the bot:
   ```bash
   npm run build
   ```

2. Start the bot:
   ```bash
   npm start
   ```

3. Test in Discord:
   - Use the command
   - Check for proper response formatting
   - Try to use again (should show cooldown message)
   - Check console for debug logs

4. Test error handling:
   - Try command without required permissions (should fail gracefully)
   - Try command on another user (should validate)

---

## Need Help?

1. **Framework Questions**: See `MODULARITY_GUIDE.md`
2. **Implementation Examples**: Check `moderation-refactored-example.ts`
3. **Detailed Report**: Read `OPTIMIZATION_REPORT.md`
4. **Framework Source**: Review files in `server/bot/framework/`

---

## Migration Checklist

When migrating a command:
- [ ] Import framework components
- [ ] Update command interface to use `Command` type
- [ ] Add `cooldown` property
- [ ] Replace validation logic with `ValidationHelpers`
- [ ] Replace response creation with `ResponseBuilder`
- [ ] Update error handling to use framework
- [ ] Test the command thoroughly
- [ ] Delete old response-building code
- [ ] Verify response styling is consistent

---

**Remember**: The framework handles the boring stuff, so you can focus on making great commands!
