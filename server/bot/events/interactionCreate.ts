import { Interaction, ChatInputCommandInteraction } from 'discord.js';

export async function interactionCreateHandler(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as any).commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    console.error('Error executing command:', error);
    
    const errorMessage = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true 
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}
