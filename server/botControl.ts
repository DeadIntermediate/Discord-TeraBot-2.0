import { spawn, ChildProcess } from "child_process";
import { log } from "./vite";

class BotController {
  private botProcess: ChildProcess | null = null;
  private botStatus: "running" | "stopped" | "starting" | "error" = "stopped";
  private lastError: string | null = null;

  async start(): Promise<boolean> {
    if (this.botProcess) {
      log("Bot is already running");
      return false;
    }

    try {
      this.botStatus = "starting";
      log("Starting Python Discord bot...");
      
      this.botProcess = spawn("python", ["-u", "python_bot/main.py"], {
        stdio: ["inherit", "pipe", "pipe"],
        env: { ...process.env }
      });

      this.botProcess.stdout?.on("data", (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          log(`[Bot] ${line}`);
          if (line.includes("has connected to Discord")) {
            this.botStatus = "running";
          }
        });
      });

      this.botProcess.stderr?.on("data", (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => log(`[Bot] ${line}`));
      });

      this.botProcess.on("close", (code) => {
        log(`Python bot exited with code ${code}`);
        this.botStatus = "stopped";
        this.botProcess = null;
        if (code !== 0) {
          this.botStatus = "error";
          this.lastError = `Bot exited with code ${code}`;
        }
      });

      this.botProcess.on("error", (error) => {
        log(`Bot process error: ${error.message}`);
        this.botStatus = "error";
        this.lastError = error.message;
      });

      // Wait a bit to see if the process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (error: any) {
      log(`Failed to start bot: ${error.message}`);
      this.botStatus = "error";
      this.lastError = error.message;
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.botProcess) {
      log("Bot is not running");
      return false;
    }

    try {
      log("Stopping Python Discord bot...");
      this.botProcess.kill("SIGTERM");
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.botProcess) {
        this.botProcess.kill("SIGKILL");
      }
      
      this.botProcess = null;
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
      pid: this.botProcess?.pid,
      lastError: this.lastError
    };
  }

  isRunning(): boolean {
    return this.botStatus === "running" && this.botProcess !== null;
  }
}

export const botController = new BotController();
