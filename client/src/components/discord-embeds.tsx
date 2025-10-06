export default function DiscordEmbeds() {
  return (
    <section className="py-20 px-4 bg-card/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Beautiful Discord Integration</h2>
          <p className="text-xl text-muted-foreground">See how your messages will look in Discord</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Welcome Message Example */}
          <div className="bg-[#36393f] p-4 rounded-lg" data-testid="discord-embed-welcome">
            <div className="text-xs text-[#72767d] mb-2">Today at 2:47 PM</div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-robot text-primary-foreground"></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-white font-semibold">BotMaster</span>
                  <span className="bg-primary text-xs px-1 rounded text-white">BOT</span>
                </div>
                <div className="bg-[#2f3136] border-l-4 border-primary p-4 rounded">
                  <div className="text-white font-semibold mb-2" data-testid="welcome-embed-title">
                    👋 Welcome to the Server!
                  </div>
                  <div className="text-[#dcddde] text-sm mb-3" data-testid="welcome-embed-description">
                    Hey <span className="text-primary">@NewUser</span>! Welcome to our amazing community. 
                    We're excited to have you here!
                  </div>
                  <div className="text-xs text-[#72767d]">
                    <div>📋 Check out #rules for server guidelines</div>
                    <div>💬 Introduce yourself in #introductions</div>
                    <div>🎮 Join us for games in voice channels!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Giveaway Example */}
          <div className="bg-[#36393f] p-4 rounded-lg" data-testid="discord-embed-giveaway">
            <div className="text-xs text-[#72767d] mb-2">Today at 3:15 PM</div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-robot text-primary-foreground"></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-white font-semibold">BotMaster</span>
                  <span className="bg-primary text-xs px-1 rounded text-white">BOT</span>
                </div>
                <div className="bg-[#2f3136] border-l-4 border-yellow-500 p-4 rounded">
                  <div className="text-white font-semibold mb-2" data-testid="giveaway-embed-title">
                    🎉 GIVEAWAY TIME!
                  </div>
                  <div className="text-[#dcddde] text-sm mb-3" data-testid="giveaway-embed-description">
                    We're giving away a <span className="font-semibold">$50 Steam Gift Card</span>!
                  </div>
                  <div className="text-xs text-[#72767d] mb-3">
                    <div>⏰ Ends: Tomorrow at 6:00 PM</div>
                    <div>👥 Entries: 234</div>
                  </div>
                  <div className="text-xs text-[#dcddde]">
                    React with 🎁 to enter!
                  </div>
                </div>
                <div className="flex items-center mt-2 space-x-2">
                  <span className="text-lg">🎁</span>
                  <span className="text-xs text-[#72767d]">234</span>
                </div>
              </div>
            </div>
          </div>

          {/* Server Info Example */}
          <div className="bg-[#36393f] p-4 rounded-lg" data-testid="discord-embed-serverinfo">
            <div className="text-xs text-[#72767d] mb-2">Today at 4:22 PM</div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-robot text-primary-foreground"></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-white font-semibold">BotMaster</span>
                  <span className="bg-primary text-xs px-1 rounded text-white">BOT</span>
                </div>
                <div className="bg-[#2f3136] border-l-4 border-accent p-4 rounded">
                  <div className="text-white font-semibold mb-2" data-testid="serverinfo-embed-title">
                    📊 Server Information
                  </div>
                  <div className="text-xs text-[#dcddde] space-y-1" data-testid="serverinfo-embed-details">
                    <div><span className="text-[#72767d]">Name:</span> My Gaming Server</div>
                    <div><span className="text-[#72767d]">Members:</span> 2,847 (2,234 humans, 613 bots)</div>
                    <div><span className="text-[#72767d]">Created:</span> March 15, 2022</div>
                    <div><span className="text-[#72767d]">Owner:</span> ServerOwner#1234</div>
                    <div><span className="text-[#72767d]">Channels:</span> 24 text, 8 voice</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
