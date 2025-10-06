import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Features from "@/components/features";
import DashboardPreview from "@/components/dashboard-preview";
import DiscordEmbeds from "@/components/discord-embeds";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Features />
      <DashboardPreview />
      <DiscordEmbeds />
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Discord Server?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of communities already using BotMaster to create engaging, well-moderated Discord servers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              className="bg-primary text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
              data-testid="button-add-to-discord-cta"
            >
              <i className="fab fa-discord mr-2"></i>
              Add to Discord - Free
            </button>
            <button 
              className="bg-secondary text-secondary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-secondary/80 transition-colors"
              data-testid="button-documentation"
            >
              <i className="fas fa-book mr-2"></i>
              Read Documentation
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Setup in under 5 minutes • 24/7 support
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
