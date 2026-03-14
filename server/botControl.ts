import { log } from "./vite";
import { initializeBot, stopBot } from "./bot";
import { testDatabaseConnection } from "./db";

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
      
      // Verify database connectivity before starting bot
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        throw new Error("Database connection failed - bot cannot start without database");
      }
      
      await initializeBot();
      
      this.botStatus = "running";
      log("Discord bot started successfully");
      return true;
    } catch (error: any) {
      log(`Failed to start bot: ${error.message}`);
      this.botStatus = "error";
      this.lastError = error.message;
      
      // Log specific database connection errors with helpful details
      if (error.message.includes("database") || error.message.includes("connection")) {
        log("Database connection troubleshooting:");
        log("- Check if PostgreSQL server is running");
        log("- Verify DATABASE_URL environment variable");
        log("- Ensure database exists and credentials are correct");
        log("- Check network connectivity to database server");
      }
      
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
      stopBot();
      
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
