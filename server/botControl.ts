import { log } from "./vite";
import { initializeBot, client } from "./bot";

class BotController {
  private botStatus: "running" | "stopped" | "starting" | "error" = "stopped";
  private lastError: string | null = null;

  async start(): Promise<boolean> {
    if (this.botStatus === "running") {
      log("Bot is already running");
      return false;
    }

    try {
      this.botStatus = "starting";
      log("Starting Discord bot...");
      
      await initializeBot();
      
      this.botStatus = "running";
      log("Discord bot started successfully");
      return true;
    } catch (error: any) {
      log(`Failed to start bot: ${error.message}`);
      this.botStatus = "error";
      this.lastError = error.message;
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (this.botStatus !== "running") {
      log("Bot is not running");
      return false;
    }

    try {
      log("Stopping Discord bot...");
      client.destroy();
      
      this.botStatus = "stopped";
      log("Bot stopped");
      return true;
    } catch (error: any) {
      log(`Failed to stop bot: ${error.message}`);
      this.lastError = error.message;
      return false;
    }
  }

  async restart(): Promise<boolean> {
    log("Restarting bot...");
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.start();
  }

  getStatus() {
    return {
      status: this.botStatus,
      running: this.botStatus === "running",
      lastError: this.lastError
    };
  }

  isRunning(): boolean {
    return this.botStatus === "running";
  }
}

export const botController = new BotController();
