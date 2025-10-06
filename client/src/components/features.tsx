import { Card, CardContent } from "@/components/ui/card";

export default function Features() {
  const features = [
    {
      icon: "fas fa-hand-wave",
      title: "Welcome Messages",
      description: "Send beautiful embedded welcome messages to new members with custom greetings and server information.",
      color: "primary",
    },
    {
      icon: "fas fa-shield-halved", 
      title: "Moderation Suite",
      description: "Complete moderation tools including kick, ban, mute, message clearing, and jail system for problematic users.",
      color: "destructive",
    },
    {
      icon: "fas fa-trophy",
      title: "Leveling System", 
      description: "Reward active members with XP and levels for both text and voice activity to encourage engagement.",
      color: "accent",
    },
    {
      icon: "fas fa-gift",
      title: "Giveaway System",
      description: "Host engaging giveaways with automatic entry management and winner selection for prizes and rewards.",
      color: "yellow-500",
    },
    {
      icon: "fas fa-ticket",
      title: "Support Tickets",
      description: "Built-in ticketing system for handling support requests and user questions with moderator management.",
      color: "blue-500",
    },
    {
      icon: "fas fa-mouse-pointer",
      title: "Role Reactions",
      description: "Enable users to self-assign roles by reacting to messages, making role management interactive and easy.",
      color: "purple-500",
    },
  ];

  const additionalFeatures = [
    {
      icon: "fas fa-music",
      title: "Music Bot",
      description: "Play, pause, skip music in voice channels",
    },
    {
      icon: "fas fa-broadcast-tower",
      title: "Stream Alerts", 
      description: "Auto-announce when users go live",
    },
    {
      icon: "fas fa-server",
      title: "Server Status",
      description: "Monitor Minecraft server status",
    },
    {
      icon: "fas fa-chart-line",
      title: "Analytics",
      description: "Track server growth and engagement",
    },
  ];

  return (
    <section id="features" className="py-20 px-4 bg-card/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Powerful Features for Every Community</h2>
          <p className="text-xl text-muted-foreground">From small friend groups to massive gaming communities</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="bg-card border border-border hover:border-primary/50 transition-colors group"
              data-testid={`feature-card-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 bg-${feature.color}/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-${feature.color}/20 transition-colors`}>
                  <i className={`${feature.icon} text-${feature.color} text-xl`}></i>
                </div>
                <h3 className="text-xl font-semibold mb-2" data-testid={`feature-title-${index}`}>
                  {feature.title}
                </h3>
                <p className="text-muted-foreground" data-testid={`feature-description-${index}`}>
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Features Grid */}
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {additionalFeatures.map((feature, index) => (
            <Card 
              key={index}
              className="bg-card/50 border border-border"
              data-testid={`additional-feature-${index}`}
            >
              <CardContent className="p-4">
                <i className={`${feature.icon} text-primary mb-2`}></i>
                <h4 className="font-semibold mb-1" data-testid={`additional-title-${index}`}>
                  {feature.title}
                </h4>
                <p className="text-sm text-muted-foreground" data-testid={`additional-description-${index}`}>
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
