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
