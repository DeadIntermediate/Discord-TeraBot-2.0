import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Navbar() {
  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <i className="fas fa-robot text-primary-foreground"></i>
                </div>
                <span className="text-xl font-bold" data-testid="text-brand-name">BotMaster</span>
              </div>
            </div>
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <a 
              href="#features" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-features"
            >
              Features
            </a>
            <Link href="/dashboard">
              <a 
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-dashboard"
              >
                Dashboard
              </a>
            </Link>
            <a 
              href="#pricing" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-pricing"
            >
              Pricing
            </a>
            <Button 
              className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              data-testid="button-add-to-discord-nav"
            >
              Add to Discord
            </Button>
          </div>
          <button 
            className="md:hidden text-foreground"
            data-testid="button-mobile-menu"
          >
            <i className="fas fa-bars"></i>
          </button>
        </div>
      </div>
    </nav>
  );
}
