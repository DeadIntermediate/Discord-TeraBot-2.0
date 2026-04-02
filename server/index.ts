// Load and validate configuration before anything else
import { loadConfig } from './utils/configLoader';
loadConfig();

import { runSetupIfNeeded } from './utils/firstRunSetup';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { botController } from "./botControl";
import { testDatabaseConnection, closeDatabaseConnection } from "./db";
import { validateEnvironment, displayValidationResults } from "./utils/envValidator";
import { info, warn, error, debug } from './utils/logger';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Interactive first-run setup — prompts for missing required vars and saves to .env
  await runSetupIfNeeded();

  info('🚀 Starting TeraBot server...\n');

  // Validate environment variables first
  const envValidation = validateEnvironment();
  displayValidationResults(envValidation);
  
  if (!envValidation.isValid) {
    error('❌ CRITICAL ERROR: Environment validation failed!');
    error('🔧 Please fix the above environment variable issues and restart.\n');
    process.exit(1);
  }
  
  // Test database connection second - critical for bot functionality
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  debug('📊 DATABASE CONNECTION CHECK');
  debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
  error('\n❌ CRITICAL ERROR: Database connection failed!');
  error('💡 Please check:');
  error('   - DATABASE_URL environment variable is set correctly');
  error('   - PostgreSQL server is running and accessible');
  error('   - Database credentials are valid');
  error('   - Network connectivity to database server');
  error('\n🛑 Bot cannot start without database connectivity. Exiting...\n');
    process.exit(1);
  }
  
  info('✅ Database connectivity verified. Proceeding with bot startup...\n');
  
  // Start Discord bot using controller
  const botStarted = await botController.start();
  if (!botStarted) {
    error('❌ Failed to start Discord bot. Exiting...');
    await closeDatabaseConnection();
    process.exit(1);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
  info(`\n🛑 Received ${signal}. Graceful shutdown initiated...`);
    
    try {
      // Stop the Discord bot
      if (botController.isRunning()) {
  info('🤖 Stopping Discord bot...');
        await botController.stop();
      }
      
      // Close database connections
  info('📊 Closing database connections...');
      await closeDatabaseConnection();
      
      // Close the HTTP server
  info('🌐 Closing HTTP server...');
      server.close(() => {
  info('✅ Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
    error('⚠️ Graceful shutdown timeout. Force exiting...');
        process.exit(1);
      }, 10000);
      
    } catch (errObj) {
      error('❌ Error during graceful shutdown:', errObj);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (err) => {
    error('💥 Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
})();
