import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Users, 
  Shield, 
  Ticket, 
  Gift, 
  BarChart3, 
  Settings,
  ArrowLeft,
  Activity,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Power
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Mock server ID for demo - in real app this would come from auth/params
const DEMO_SERVER_ID = "123456789";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: botStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/bot/status'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const { data: serverStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/servers', DEMO_SERVER_ID, 'stats'],
    enabled: true,
  });

  const startBotMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/bot/start'),
    onSuccess: () => {
      toast({
        title: "Bot Started",
        description: "The Discord bot has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
    },
    onError: () => {
      toast({
        title: "Start Failed",
        description: "Failed to start the bot. Check the logs for details.",
        variant: "destructive",
      });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/bot/stop'),
    onSuccess: () => {
      toast({
        title: "Bot Stopped",
        description: "The Discord bot has been stopped.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
    },
    onError: () => {
      toast({
        title: "Stop Failed",
        description: "Failed to stop the bot.",
        variant: "destructive",
      });
    },
  });

  const restartBotMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/bot/restart'),
    onSuccess: () => {
      toast({
        title: "Bot Restarting",
        description: "The Discord bot is restarting...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
    },
    onError: () => {
      toast({
        title: "Restart Failed",
        description: "Failed to restart the bot.",
        variant: "destructive",
      });
    },
  });

  const isLoading = statusLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const botRunning = (botStatus as any)?.running || false;
  const botStatusText = (botStatus as any)?.status || "unknown";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-home">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Power className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold" data-testid="text-server-name">Bot Control Panel</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-server-status">
                    Discord Bot Management
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={botRunning ? "default" : "secondary"} 
                className={botRunning ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"} 
                data-testid="status-connected"
              >
                <Activity className="h-3 w-3 mr-1" />
                {botStatusText}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Control Bar */}
      <div className="bg-card/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Bot Controls:</h3>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => startBotMutation.mutate()}
                disabled={botRunning || startBotMutation.isPending}
                data-testid="button-start-bot"
                className="bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Start
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => stopBotMutation.mutate()}
                disabled={!botRunning || stopBotMutation.isPending}
                data-testid="button-stop-bot"
              >
                <StopCircle className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => restartBotMutation.mutate()}
                disabled={restartBotMutation.isPending}
                data-testid="button-restart-bot"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${restartBotMutation.isPending ? 'animate-spin' : ''}`} />
                Restart
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-2">
                  <Button
                    variant={activeTab === "overview" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("overview")}
                    data-testid="nav-overview"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Overview
                  </Button>
                  <Button
                    variant={activeTab === "moderation" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("moderation")}
                    data-testid="nav-moderation"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Moderation
                  </Button>
                  <Button
                    variant={activeTab === "leveling" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("leveling")}
                    data-testid="nav-leveling"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Leveling
                  </Button>
                  <Button
                    variant={activeTab === "giveaways" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("giveaways")}
                    data-testid="nav-giveaways"
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Giveaways
                  </Button>
                  <Button
                    variant={activeTab === "tickets" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("tickets")}
                    data-testid="nav-tickets"
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    Tickets
                  </Button>
                  <Button
                    variant={activeTab === "settings" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("settings")}
                    data-testid="nav-settings"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Members</p>
                          <p className="text-2xl font-bold" data-testid="stat-total-members">
                            {(serverStats as any)?.memberCount || 0}
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Tickets</p>
                          <p className="text-2xl font-bold" data-testid="stat-active-tickets">
                            {(serverStats as any)?.activeTickets || 0}
                          </p>
                        </div>
                        <Ticket className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Mod Actions</p>
                          <p className="text-2xl font-bold" data-testid="stat-mod-actions">
                            {(serverStats as any)?.moderationActions || 0}
                          </p>
                        </div>
                        <Shield className="h-8 w-8 text-destructive" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Giveaways</p>
                          <p className="text-2xl font-bold" data-testid="stat-active-giveaways">
                            {(serverStats as any)?.activeGiveaways || 0}
                          </p>
                        </div>
                        <Gift className="h-8 w-8 text-accent" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bot Status Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Bot Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <span className="font-medium">Status</span>
                        <Badge variant={botRunning ? "default" : "secondary"} className={botRunning ? "bg-green-500" : ""}>
                          {botStatusText}
                        </Badge>
                      </div>
                      {(botStatus as any)?.pid && (
                        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                          <span className="font-medium">Process ID</span>
                          <span className="text-muted-foreground">{(botStatus as any).pid}</span>
                        </div>
                      )}
                      {(botStatus as any)?.lastError && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <span className="text-sm text-destructive">{(botStatus as any).lastError}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "settings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Bot Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Feature Controls</h3>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="anti-invite">Anti-Invite System</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically remove Discord invite links from messages
                          </p>
                        </div>
                        <Switch id="anti-invite" data-testid="toggle-anti-invite" />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="leveling">Leveling System</Label>
                          <p className="text-sm text-muted-foreground">
                            Track member activity with XP and levels
                          </p>
                        </div>
                        <Switch id="leveling" defaultChecked data-testid="toggle-leveling" />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="welcome">Welcome Messages</Label>
                          <p className="text-sm text-muted-foreground">
                            Send welcome messages when members join
                          </p>
                        </div>
                        <Switch id="welcome" defaultChecked data-testid="toggle-welcome" />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="tickets">Ticket System</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow members to create support tickets
                          </p>
                        </div>
                        <Switch id="tickets" defaultChecked data-testid="toggle-tickets" />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="streams">Stream Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Send notifications when streamers go live
                          </p>
                        </div>
                        <Switch id="streams" defaultChecked data-testid="toggle-streams" />
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Button className="w-full" data-testid="button-save-settings">
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "moderation" && (
              <Card>
                <CardHeader>
                  <CardTitle>Moderation Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Configure moderation settings and view recent actions. This section will show moderation logs, 
                    automated punishment settings, and warning systems.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === "leveling" && (
              <Card>
                <CardHeader>
                  <CardTitle>Leveling System</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Manage the server leveling system, XP rewards, and role assignments. View member statistics 
                    and configure leveling channels.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === "giveaways" && (
              <Card>
                <CardHeader>
                  <CardTitle>Giveaway Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Create and manage server giveaways. Set up prizes, entry requirements, and automatic 
                    winner selection.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === "tickets" && (
              <Card>
                <CardHeader>
                  <CardTitle>Support Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Configure the ticket system for user support. Set up categories, auto-responses, 
                    and staff assignment rules.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
