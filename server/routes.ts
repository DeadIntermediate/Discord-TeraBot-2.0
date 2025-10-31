import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertDiscordServerSchema, insertModerationLogSchema } from "@shared/schema";
import { z } from "zod";
import { botController } from "./botControl";
import { info, debug, warn, error } from './utils/logger';

export async function registerRoutes(app: Express): Promise<Server> {
  // Discord server routes
  app.get("/api/servers/:id", async (req, res) => {
    try {
      const server = await storage.getDiscordServer(req.params.id);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch server" });
    }
  });

  app.post("/api/servers", async (req, res) => {
    try {
      const data = insertDiscordServerSchema.parse(req.body);
      const server = await storage.createDiscordServer(data);
      res.status(201).json(server);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid server data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create server" });
    }
  });

  app.put("/api/servers/:id", async (req, res) => {
    try {
      const updates = req.body;
      const server = await storage.updateDiscordServer(req.params.id, updates);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ message: "Failed to update server" });
    }
  });

  // Server member routes
  app.get("/api/servers/:serverId/members", async (req, res) => {
    try {
      const members = await storage.getServerMembers(req.params.serverId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/servers/:serverId/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topMembers = await storage.getTopMembersByXP(req.params.serverId, limit);
      res.json(topMembers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Moderation routes
  app.get("/api/servers/:serverId/moderation", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getModerationLogs(req.params.serverId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch moderation logs" });
    }
  });

  app.post("/api/moderation", async (req, res) => {
    try {
      const data = insertModerationLogSchema.parse(req.body);
      const log = await storage.createModerationLog(data);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid moderation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create moderation log" });
    }
  });

  // Ticket routes
  app.get("/api/servers/:serverId/tickets", async (req, res) => {
    try {
      const status = req.query.status as string;
      const tickets = await storage.getServerTickets(req.params.serverId, status);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  app.put("/api/tickets/:id", async (req, res) => {
    try {
      const updates = req.body;
      const ticket = await storage.updateTicket(req.params.id, updates);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  // Giveaway routes
  app.get("/api/servers/:serverId/giveaways", async (req, res) => {
    try {
      const giveaways = await storage.getActiveGiveaways(req.params.serverId);
      res.json(giveaways);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch giveaways" });
    }
  });

  app.get("/api/giveaways/active", async (req, res) => {
    try {
      const giveaways = await storage.getActiveGiveaways();
      res.json(giveaways);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active giveaways" });
    }
  });

  // Dashboard statistics
  app.get("/api/servers/:serverId/stats", async (req, res) => {
    try {
      const serverId = req.params.serverId;
      
      // Get server info
      const server = await storage.getDiscordServer(serverId);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }

      // Get statistics
      const members = await storage.getServerMembers(serverId);
      const recentModerationLogs = await storage.getModerationLogs(serverId, 10);
      const activeTickets = await storage.getServerTickets(serverId, "open");
      const activeGiveaways = await storage.getActiveGiveaways(serverId);

      const stats = {
        memberCount: members.length,
        activeTickets: activeTickets.length,
        moderationActions: recentModerationLogs.length,
        activeGiveaways: activeGiveaways.length,
        recentModerationLogs: recentModerationLogs.slice(0, 5),
        activeGiveawaysList: activeGiveaways.slice(0, 3),
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch server statistics" });
    }
  });

  // Bot control routes
  app.get("/api/bot/status", async (_req, res) => {
    try {
      const status = botController.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bot status" });
    }
  });

  app.post("/api/bot/start", async (_req, res) => {
    try {
      const success = await botController.start();
      if (success) {
        res.json({ message: "Bot started successfully", status: botController.getStatus() });
      } else {
        res.status(400).json({ message: "Failed to start bot", status: botController.getStatus() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error starting bot" });
    }
  });

  app.post("/api/bot/stop", async (_req, res) => {
    try {
      const success = await botController.stop();
      if (success) {
        res.json({ message: "Bot stopped successfully", status: botController.getStatus() });
      } else {
        res.status(400).json({ message: "Failed to stop bot", status: botController.getStatus() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error stopping bot" });
    }
  });

  // OAuth routes for stream platform authentication
  app.get("/auth/twitch/login", (_req, res) => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000'}/auth/twitch/callback`;
      const scope = 'user:read:email';
      const state = Math.random().toString(36).substring(7); // Simple state generation
      
      // Store state in session for verification (in production, use proper session management)
      const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
      
      res.redirect(twitchAuthUrl);
    } catch (err) {
      error('Error initiating Twitch OAuth:', err);
      res.status(500).json({ message: 'Failed to initiate Twitch authentication' });
    }
  });

  app.get("/auth/twitch/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      
      if (!code) {
        return res.status(400).json({ message: 'Missing authorization code' });
      }

      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000'}/auth/twitch/callback`;

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Get user information
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-ID': clientId || '',
        } as Record<string, string>,
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user information');
      }

      const userData = await userResponse.json();
      const twitchUser = userData.data[0];

      // Return success with user info - display confirmation page
      const successHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Twitch Authentication Successful</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .container { background: white; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
              h1 { color: #667eea; margin-bottom: 10px; }
              p { color: #666; font-size: 16px; margin: 10px 0; }
              .info { background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: left; margin: 20px 0; }
              .info p { margin: 5px 0; font-family: monospace; }
              .warning { color: #d32f2f; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Twitch Authentication Successful!</h1>
              <p>Your Twitch account has been verified.</p>
              <div class="info">
                <p><strong>Username:</strong> ${twitchUser.login}</p>
                <p><strong>Display Name:</strong> ${twitchUser.display_name}</p>
              </div>
              <p class="warning">⚠️ Return to your Discord server to confirm your account in the modal that appears.</p>
              <p>You can close this window.</p>
            </div>
          </body>
        </html>
      `;
      res.send(successHtml);
    } catch (err) {
      error('Error handling Twitch OAuth callback:', err);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Failed</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .container { background: white; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
              h1 { color: #d32f2f; margin-bottom: 10px; }
              p { color: #666; font-size: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Authentication Failed</h1>
              <p>Something went wrong. Please try again.</p>
            </div>
          </body>
        </html>
      `;
      res.status(500).send(errorHtml);
    }
  });

  // YouTube OAuth routes (placeholder for future implementation)
  app.get("/auth/youtube/login", (_req, res) => {
    res.json({ message: 'YouTube OAuth not yet configured' });
  });

  // Kick OAuth routes
  app.get("/auth/kick/login", (_req, res) => {
    try {
      const clientId = process.env.KICK_CLIENT_ID;
      const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000'}/auth/kick/callback`;
      const scope = 'openid profile email';
      const state = Math.random().toString(36).substring(7);
      
      const kickAuthUrl = `https://auth.kick.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
      
      res.redirect(kickAuthUrl);
    } catch (err) {
      error('Error initiating Kick OAuth:', err);
      res.status(500).json({ message: 'Failed to initiate Kick authentication' });
    }
  });

  app.get("/auth/kick/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      
      if (!code) {
        return res.status(400).json({ message: 'Missing authorization code' });
      }

      const clientId = process.env.KICK_CLIENT_ID;
      const clientSecret = process.env.KICK_CLIENT_SECRET;
      const redirectUri = `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000'}/auth/kick/callback`;

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://auth.kick.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Get user information from Kick
      const userResponse = await fetch('https://api.kick.com/v1/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user information');
      }

      const userData = await userResponse.json();

      // Return success with user info - display confirmation page
      const successHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Kick Authentication Successful</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .container { background: white; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
              h1 { color: #667eea; margin-bottom: 10px; }
              p { color: #666; font-size: 16px; margin: 10px 0; }
              .info { background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: left; margin: 20px 0; }
              .info p { margin: 5px 0; font-family: monospace; }
              .warning { color: #d32f2f; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Kick Authentication Successful!</h1>
              <p>Your Kick account has been verified.</p>
              <div class="info">
                <p><strong>Username:</strong> ${userData.username}</p>
                <p><strong>Display Name:</strong> ${userData.display_name || userData.username}</p>
              </div>
              <p class="warning">⚠️ Return to your Discord server to confirm your account in the modal that appears.</p>
              <p>You can close this window.</p>
            </div>
          </body>
        </html>
      `;
      res.send(successHtml);
    } catch (err) {
      error('Error handling Kick OAuth callback:', err);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Failed</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .container { background: white; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
              h1 { color: #d32f2f; margin-bottom: 10px; }
              p { color: #666; font-size: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Authentication Failed</h1>
              <p>Something went wrong. Please try again.</p>
            </div>
          </body>
        </html>
      `;
      res.status(500).send(errorHtml);
    }
  });

  app.post("/api/bot/restart", async (_req, res) => {
    try {
      const success = await botController.restart();
      if (success) {
        res.json({ message: "Bot restarted successfully", status: botController.getStatus() });
      } else {
        res.status(400).json({ message: "Failed to restart bot", status: botController.getStatus() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error restarting bot" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    info('WebSocket client connected');

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        switch (data.type) {
          case 'subscribe_server':
            // Subscribe to server updates
            ws.send(JSON.stringify({
              type: 'subscribed',
              serverId: data.serverId
            }));
            break;
          
          case 'heartbeat':
            ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
            break;
        }
      } catch (err) {
        error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      info('WebSocket client disconnected');
    });

    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to BotMaster WebSocket'
      }));
    }
  });

  // Broadcast function for real-time updates
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Export broadcast function for use in other parts of the application
  (httpServer as any).broadcast = broadcast;

  return httpServer;
}
