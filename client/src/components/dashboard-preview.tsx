import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPreview() {
  return (
    <section id="dashboard" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Intuitive Management Dashboard</h2>
          <p className="text-xl text-muted-foreground">Configure everything from one central location</p>
        </div>

        <Card className="bg-card rounded-2xl border border-border overflow-hidden shadow-2xl">
          {/* Dashboard Header */}
          <div className="bg-secondary/50 p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-robot text-primary-foreground"></i>
                </div>
                <div>
                  <h3 className="font-semibold" data-testid="dashboard-server-name">My Gaming Server</h3>
                  <p className="text-sm text-muted-foreground" data-testid="dashboard-server-info">
                    2,847 members • Online
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-accent/10 text-accent" data-testid="dashboard-status">
                  <i className="fas fa-circle text-xs mr-1"></i>
                  Connected
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-secondary/30 p-4">
              <nav className="space-y-2">
                <a 
                  href="#" 
                  className="flex items-center space-x-3 bg-primary/10 text-primary px-3 py-2 rounded-lg"
                  data-testid="dashboard-nav-overview"
                >
                  <i className="fas fa-chart-pie"></i>
                  <span>Dashboard</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-moderation"
                >
                  <i className="fas fa-shield-halved"></i>
                  <span>Moderation</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-welcome"
                >
                  <i className="fas fa-hand-wave"></i>
                  <span>Welcome</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-leveling"
                >
                  <i className="fas fa-trophy"></i>
                  <span>Leveling</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-giveaways"
                >
                  <i className="fas fa-gift"></i>
                  <span>Giveaways</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-tickets"
                >
                  <i className="fas fa-ticket"></i>
                  <span>Tickets</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-3 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  data-testid="dashboard-nav-settings"
                >
                  <i className="fas fa-cog"></i>
                  <span>Settings</span>
                </a>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Members</p>
                        <p className="text-2xl font-bold" data-testid="dashboard-stat-members">2,847</p>
                      </div>
                      <i className="fas fa-users text-primary text-2xl"></i>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Tickets</p>
                        <p className="text-2xl font-bold" data-testid="dashboard-stat-tickets">12</p>
                      </div>
                      <i className="fas fa-ticket text-blue-500 text-2xl"></i>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Mod Actions</p>
                        <p className="text-2xl font-bold" data-testid="dashboard-stat-modactions">47</p>
                      </div>
                      <i className="fas fa-gavel text-destructive text-2xl"></i>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Commands/Day</p>
                        <p className="text-2xl font-bold" data-testid="dashboard-stat-commands">1,234</p>
                      </div>
                      <i className="fas fa-terminal text-accent text-2xl"></i>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-card border border-border">
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">Recent Moderation</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
                            <i className="fas fa-ban text-destructive text-xs"></i>
                          </div>
                          <div>
                            <p className="font-medium" data-testid="dashboard-modlog-1">User banned</p>
                            <p className="text-sm text-muted-foreground">SpamBot#1234</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">2m ago</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                            <i className="fas fa-volume-mute text-yellow-500 text-xs"></i>
                          </div>
                          <div>
                            <p className="font-medium" data-testid="dashboard-modlog-2">User muted</p>
                            <p className="text-sm text-muted-foreground">ToxicPlayer#5678</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">15m ago</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border border-border">
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-4">Active Giveaways</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium" data-testid="dashboard-giveaway-1">$50 Steam Gift Card</p>
                          <Badge className="bg-accent/20 text-accent">Active</Badge>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>234 entries</span>
                          <span>Ends in 2d 4h</span>
                        </div>
                      </div>
                      <div className="p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium" data-testid="dashboard-giveaway-2">Game Key Bundle</p>
                          <Badge className="bg-primary/20 text-primary">Ending Soon</Badge>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>156 entries</span>
                          <span>Ends in 4h</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
