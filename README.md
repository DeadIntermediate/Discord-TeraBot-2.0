# 🤖 Project TeraBot 2.0

### Created by Josh — Terabyte Gaming Network (TGN)

TeraBot 2.0 is a custom-built **Discord bot** designed for the **Terabyte Gaming Network**, a large-scale multi-server Minecraft network.  
This project is being rewritten from **Python (Discord.py)** to **Node.js (Discord.js)** for better scalability, modularity, and ecosystem support.

---

## 🧩 Overview

**Terabyte Gaming Network (TGN)** runs on multiple backend Minecraft servers using **Paper** and **Folia**, connected through a **Velocity proxy**.  
TeraBot 2.0 acts as a bridge between Discord, TeamSpeak 3, and the Minecraft network — providing unified tools for community management, moderation, analytics, and automation.

---

## ⚙️ Core Features

### 🧠 General Features
- Welcome and leave messages (embedded with username, avatar, and member count)
- `/serverinfo` command displaying guild stats, creation date, and bot/server details
- Ticket system with cross-platform (Discord + TeamSpeak) visibility
- Giveaway system for digital rewards (gift cards, game keys, etc.)
- Stream notifications for Twitch, YouTube, Kick, or TikTok
- Custom embed creator directly within Discord

### 🎮 Game Integration
- Real-time Minecraft server status embeds (auto-refresh every 3–5 minutes)
- Cross-server **currency** and **leveling** systems (shared between multiple guilds)
- Toggle options for shared features per guild
- Integration with **TGN’s rank system** and webhooks

### 🧑‍💻 Moderation & Security
- **Jail command:** restricts user access to a single text channel
- **Keyword filter:** four strictness levels (non-strict, low, medium, high)
- **Minimum account age restriction:** set by guild admins
- **Role reaction/self-role assignment system**

### 📊 Analytics & Dashboard
- Web-based configuration dashboard for server admins and bot owner
- Customizable layout and color themes per guild
- Command usage tracking and activity analytics
- Grafana integration for advanced data visualization

---

## 🧩 Planned Integrations

### 🗣️ TeamSpeak 3 (TS3-TeraBot)
- Shared ticket system (Discord ↔ TS3)
- Leveling system (text + voice activity)
- Join/leave tracking across both platforms
- Role/permission management through text commands

---

## 💾 System Infrastructure

- **Development Host:** Raspberry Pi  
- **Production Host:** VPS (Debian-based)
- **Process Management:** tmux + systemd
- **Auto-Restart Script:** retries 3 times, sends alert if persistent failure
- **Version Control:** GitHub (`Discord-TeraBot-2.0`)
- **Deployment (Future):** Docker containers with guild sharding for scalability

---

## 🧠 Copilot Guidance

When generating or suggesting code, Copilot should:
1. Use **Discord.js (latest stable)** and **Node.js (LTS)** standards.
2. Favor **modular structure** (`commands/`, `events/`, `features/`, etc.).
3. Utilize **async/await** for asynchronous operations.
4. Prioritize **error handling** and **code maintainability**.
5. Optimize for **performance** and **cross-server compatibility**.
6. Ensure compatibility with **Linux-based** environments (Debian).

---

## 🧰 Related Systems

| Project | Description |
|----------|-------------|
| **Project TeraRanks** | Global + per-server rank system for TGN |
| **Project Skyblock** | Cooperative Skyblock world powered by BentoBox |
| **Project PluginRepo** | Centralized plugin repository with symlinks |
| **Project FiLine Wall** | Raspberry Pi–based call filter system |
| **Project Linktree Clone** | Creator-friendly, analytics-rich link hub |

---

## 🪄 Vision

TeraBot 2.0 is built to unify the **Discord**, **TeamSpeak**, and **Minecraft** communities under a single intelligent system.  
Its goal is to make managing servers easier, more interactive, and more data-driven — while maintaining Josh’s signature “no pay-to-win, pure fun” philosophy across all of TGN.

---

**Author:** Josh (DeadIntermediate / RealDeadIntermed)  
**Network:** [Terabyte Gaming Network](https://terabytegaming.net) *(Placeholder link)*  
**Language:** Node.js (Discord.js)  
**Version:** `2.0.0-dev`

---
