import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { botController } from "./botControl";
import { testDatabaseConnection, closeDatabaseConnection } from "./db";
import { validateEnvironment, displayValidationResults } from "./utils/envValidator";

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
  console.log('🚀 Starting TeraBot server...\n');
  
  // Validate environment variables first
  const envValidation = validateEnvironment();
  displayValidationResults(envValidation);
  
  if (!envValidation.isValid) {
    console.error('❌ CRITICAL ERROR: Environment validation failed!');
    console.error('🔧 Please fix the above environment variable issues and restart.\n');
    process.exit(1);
  }
  
  // Test database connection second - critical for bot functionality
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DATABASE CONNECTION CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.error('\n❌ CRITICAL ERROR: Database connection failed!');
    console.error('💡 Please check:');
    console.error('   - DATABASE_URL environment variable is set correctly');
    console.error('   - PostgreSQL server is running and accessible');
    console.error('   - Database credentials are valid');
    console.error('   - Network connectivity to database server');
    console.error('\n🛑 Bot cannot start without database connectivity. Exiting...\n');
    process.exit(1);
  }
  
  console.log('✅ Database connectivity verified. Proceeding with bot startup...\n');
  
  // Start Discord bot using controller
  const botStarted = await botController.start();
  if (!botStarted) {
    console.error('❌ Failed to start Discord bot. Exiting...');
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
    console.log(`\n🛑 Received ${signal}. Graceful shutdown initiated...`);
    
    try {
      // Stop the Discord bot
      if (botController.isRunning()) {
        console.log('🤖 Stopping Discord bot...');
        await botController.stop();
      }
      
      // Close database connections
      console.log('📊 Closing database connections...');
      await closeDatabaseConnection();
      
      // Close the HTTP server
      console.log('🌐 Closing HTTP server...');
      server.close(() => {
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error('⚠️ Graceful shutdown timeout. Force exiting...');
        process.exit(1);
      }, 10000);
      
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
})();
