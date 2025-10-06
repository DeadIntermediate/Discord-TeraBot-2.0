export default function Footer() {
  return (
    <footer className="bg-card border-t border-border py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-robot text-primary-foreground"></i>
              </div>
              <span className="text-xl font-bold" data-testid="footer-brand-name">BotMaster</span>
            </div>
            <p className="text-muted-foreground text-sm" data-testid="footer-description">
              The complete Discord bot solution for community management and engagement.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Features</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-moderation"
                >
                  Moderation Tools
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-leveling"
                >
                  Leveling System
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-giveaways"
                >
                  Giveaways
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-music"
                >
                  Music Bot
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-documentation"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-discord-server"
                >
                  Discord Server
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-status"
                >
                  Status Page
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-contact"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-privacy"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-terms"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="hover:text-foreground transition-colors"
                  data-testid="footer-link-gdpr"
                >
                  GDPR
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground" data-testid="footer-copyright">
            © 2024 BotMaster. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-social-discord"
            >
              <i className="fab fa-discord"></i>
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-social-github"
            >
              <i className="fab fa-github"></i>
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-social-twitter"
            >
              <i className="fab fa-twitter"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
