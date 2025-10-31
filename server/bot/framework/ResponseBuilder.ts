/**
 * ResponseBuilder - Standardized response formatting for interactions
 * Ensures consistent embed styling and messages across all commands
 */

import {
  EmbedBuilder,
  InteractionReplyOptions,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from 'discord.js';

export enum ResponseType {
  Success = 0x2ecc71,
  Error = 0xff0000,
  Warning = 0xf39c12,
  Info = 0x3498db,
}

/**
 * Standardized response builder for consistent formatting
 */
export class ResponseBuilder {
  private embed: EmbedBuilder;
  private ephemeral = false;
  private components: ActionRowBuilder<ButtonBuilder>[] = [];

  constructor(type: ResponseType = ResponseType.Info, title: string = '') {
    this.embed = new EmbedBuilder()
      .setColor(type)
      .setTitle(title)
      .setTimestamp();
  }

  /**
   * Create a success response
   */
  static success(title: string = 'Success'): ResponseBuilder {
    return new ResponseBuilder(ResponseType.Success, `✅ ${title}`);
  }

  /**
   * Create an error response
   */
  static error(title: string = 'Error'): ResponseBuilder {
    return new ResponseBuilder(ResponseType.Error, `❌ ${title}`);
  }

  /**
   * Create a warning response
   */
  static warning(title: string = 'Warning'): ResponseBuilder {
    return new ResponseBuilder(ResponseType.Warning, `⚠️ ${title}`);
  }

  /**
   * Create an info response
   */
  static info(title: string = 'Information'): ResponseBuilder {
    return new ResponseBuilder(ResponseType.Info, `ℹ️ ${title}`);
  }

  /**
   * Set description
   */
  setDescription(description: string): this {
    this.embed.setDescription(description);
    return this;
  }

  /**
   * Add a field
   */
  addField(name: string, value: string, inline: boolean = false): this {
    this.embed.addFields({ name, value, inline });
    return this;
  }

  /**
   * Add multiple fields
   */
  addFields(...fields: Array<{ name: string; value: string; inline?: boolean }>): this {
    this.embed.addFields(
      fields.map(f => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false,
      }))
    );
    return this;
  }

  /**
   * Set thumbnail
   */
  setThumbnail(url: string): this {
    this.embed.setThumbnail(url);
    return this;
  }

  /**
   * Set image
   */
  setImage(url: string): this {
    this.embed.setImage(url);
    return this;
  }

  /**
   * Set footer
   */
  setFooter(text: string, iconURL?: string): this {
    this.embed.setFooter({ text, iconURL });
    return this;
  }

  /**
   * Make ephemeral (private)
   */
  setEphemeral(ephemeral: boolean = true): this {
    this.ephemeral = ephemeral;
    return this;
  }

  /**
   * Add button row
   */
  addButtonRow(buttons: ButtonBuilder[]): this {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    this.components.push(row);
    return this;
  }

  /**
   * Create simple button
   */
  static createButton(
    customId: string,
    label: string,
    style: ButtonStyle = ButtonStyle.Primary,
    emoji?: string
  ): ButtonBuilder {
    const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
    if (emoji) button.setEmoji(emoji);
    return button;
  }

  /**
   * Build response
   */
  build(): InteractionReplyOptions {
    return {
      embeds: [this.embed],
      components: this.components.length > 0 ? this.components : undefined,
      ephemeral: this.ephemeral,
    };
  }
}
