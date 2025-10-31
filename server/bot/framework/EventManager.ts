/**
 * EventManager - Centralized event handling with error resilience
 * Provides typed event handling and error recovery
 */

import { Client, ClientEvents } from 'discord.js';
import { error as logError, warn, debug } from '../../utils/logger';

export type EventKey = keyof ClientEvents;

export interface EventHandler<K extends EventKey> {
  name: string;
  execute(...args: ClientEvents[K]): Promise<void> | void;
  once?: boolean;
}

/**
 * Centralized event management with error handling
 */
export class EventManager {
  private handlers = new Map<EventKey, EventHandler<any>[]>();
  private errorHandlers: ((err: Error, eventName: string) => void)[] = [];

  /**
   * Register an event handler
   */
  registerHandler<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    debug(`✅ Registered event handler: ${handler.name} for event ${String(event)}`);
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers<K extends EventKey>(event: K, handlers: EventHandler<K>[]): void {
    handlers.forEach(handler => this.registerHandler(event, handler));
  }

  /**
   * Setup handlers on client
   */
  setupHandlers(client: Client): void {
    for (const [eventName, handlers] of this.handlers.entries()) {
      for (const handler of handlers) {
        const wrappedHandler = this.wrapHandler(handler, eventName);
        
        if (handler.once) {
          (client as any).once(eventName, wrappedHandler);
        } else {
          (client as any).on(eventName, wrappedHandler);
        }
      }
    }
    debug(`✅ EventManager: Set up ${this.handlers.size} event types`);
  }

  /**
   * Register error handler
   */
  onError(handler: (err: Error, eventName: string) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Wrap handler with error handling and logging
   */
  private wrapHandler<K extends EventKey>(handler: EventHandler<K>, eventName: K) {
    return async (...args: ClientEvents[K] extends any[] ? ClientEvents[K] : [ClientEvents[K]]) => {
      try {
        await (handler.execute as any)(...args);
      } catch (err) {
        const eventError = err instanceof Error ? err : new Error(String(err));
        logError(`❌ Error in event handler ${handler.name} (${String(eventName)}):`, eventError);
        
        // Call registered error handlers
        for (const errorHandler of this.errorHandlers) {
          try {
            errorHandler(eventError, String(eventName));
          } catch (ehErr) {
            logError('❌ Error in error handler:', ehErr);
          }
        }
      }
    };
  }
}

export const eventManager = new EventManager();
