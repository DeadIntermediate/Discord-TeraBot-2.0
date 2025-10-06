import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto text-center">
        <div className="mb-8">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
            <i className="fas fa-sparkles mr-1"></i>
            Now with Advanced Moderation
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
          Complete Discord<br />Community Management
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Everything you need to manage your Discord server: moderation tools, leveling systems, 
          giveaways, music, and more. Built for communities of all sizes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            data-testid="button-add-to-server"
          >
            <i className="fab fa-discord mr-2"></i>
            Add to Server
          </Button>
          <Button 
            variant="secondary"
            className="bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
            data-testid="button-view-demo"
          >
            <i className="fas fa-play mr-2"></i>
            View Demo
          </Button>
        </div>
        <div className="mt-12 flex justify-center items-center space-x-8 text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-servers">150K+</div>
            <div className="text-sm">Servers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-users">5M+</div>
            <div className="text-sm">Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-uptime">99.9%</div>
            <div className="text-sm">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  );
}
