import { eq, and, sql, inArray, not } from 'drizzle-orm';
import { db } from '../db';
import { 
  cahGames, 
  cahGamePlayers, 
  cahGameSubmissions, 
  cahWhiteCards, 
  cahBlackCards,
  cahGameStats,
  CahGame,
  CahGamePlayer,
  CahWhiteCard,
  CahBlackCard,
  CahGameSubmission,
  InsertCahGame,
  InsertCahGamePlayer,
  InsertCahGameSubmission
} from '../../shared/schema';

export interface CahGameState {
  game: CahGame;
  players: CahGamePlayer[];
  currentBlackCard: CahBlackCard | null;
  submissions: CahGameSubmission[];
  judgeId: string | null;
}

export interface CahPlayerHand {
  playerId: string;
  cards: CahWhiteCard[];
}

export interface GameSettings {
  maxPlayers: number;
  maxRounds: number;
  winCondition: number; // Points needed to win
  cardSets: string[]; // Which card sets to use
  judgeRotation: boolean; // If false, random judge each round
  allowCustomCards: boolean;
  familyFriendly: boolean;
}

export class CahGameEngine {
  private gameId: string;
  private gameState: CahGameState | null = null;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  /**
   * Create a new game
   */
  static async createGame(
    serverId: string,
    channelId: string,
    hostId: string,
    settings: Partial<GameSettings> = {}
  ): Promise<CahGameEngine> {
    const defaultSettings: GameSettings = {
      maxPlayers: 8,
      maxRounds: 10,
      winCondition: 5,
      cardSets: ['base'],
      judgeRotation: true,
      allowCustomCards: false,
      familyFriendly: false,
    };

    const gameSettings = { ...defaultSettings, ...settings };

    const gameData = {
      serverId,
      channelId,
      hostId,
      status: 'waiting' as const,
      maxPlayers: gameSettings.maxPlayers,
      maxRounds: gameSettings.maxRounds,
      settings: gameSettings,
      gameData: {
        winCondition: gameSettings.winCondition,
        usedBlackCards: [],
        usedWhiteCards: [],
        judgeRotationIndex: 0,
      },
    };

    const [game] = await db.insert(cahGames).values(gameData).returning();
    
    const engine = new CahGameEngine(game.id);
    await engine.loadGameState();
    
    return engine;
  }

  /**
   * Load game state from database
   */
  async loadGameState(): Promise<CahGameState> {
    const [game] = await db
      .select()
      .from(cahGames)
      .where(eq(cahGames.id, this.gameId));

    if (!game) {
      throw new Error('Game not found');
    }

    const players = await db
      .select()
      .from(cahGamePlayers)
      .where(and(
        eq(cahGamePlayers.gameId, this.gameId),
        eq(cahGamePlayers.isActive, true)
      ));

    let currentBlackCard: CahBlackCard | null = null;
    if (game.currentBlackCardId) {
      const [blackCard] = await db
        .select()
        .from(cahBlackCards)
        .where(eq(cahBlackCards.id, game.currentBlackCardId));
      currentBlackCard = blackCard || null;
    }

    const submissions = await db
      .select()
      .from(cahGameSubmissions)
      .where(and(
        eq(cahGameSubmissions.gameId, this.gameId),
        eq(cahGameSubmissions.round, game.currentRound)
      ));

    this.gameState = {
      game,
      players,
      currentBlackCard,
      submissions,
      judgeId: game.currentJudgeId,
    };

    return this.gameState;
  }

  /**
   * Add a player to the game
   */
  async addPlayer(userId: string): Promise<{ success: boolean; message: string }> {
    await this.loadGameState();
    
    if (!this.gameState) {
      return { success: false, message: 'Game not found' };
    }

    if (this.gameState.game.status !== 'waiting') {
      return { success: false, message: 'Game has already started' };
    }

    if (this.gameState.players.length >= this.gameState.game.maxPlayers) {
      return { success: false, message: 'Game is full' };
    }

    const existingPlayer = this.gameState.players.find(p => p.userId === userId);
    if (existingPlayer) {
      return { success: false, message: 'You are already in this game' };
    }

    // Deal starting hand
    const hand = await this.dealWhiteCards(7);

    const playerData: InsertCahGamePlayer = {
      gameId: this.gameId,
      userId,
      hand: hand.map(card => card.id),
      score: 0,
      isActive: true,
    };

    await db.insert(cahGamePlayers).values(playerData);
    await this.loadGameState(); // Refresh state

    return { success: true, message: 'Successfully joined the game!' };
  }

  /**
   * Remove a player from the game
   */
  async removePlayer(userId: string): Promise<{ success: boolean; message: string }> {
    await this.loadGameState();
    
    if (!this.gameState) {
      return { success: false, message: 'Game not found' };
    }

    const player = this.gameState.players.find(p => p.userId === userId);
    if (!player) {
      return { success: false, message: 'You are not in this game' };
    }

    // Mark player as inactive
    await db
      .update(cahGamePlayers)
      .set({ 
        isActive: false,
        leftAt: new Date()
      })
      .where(eq(cahGamePlayers.id, player.id));

    // If this was the judge, reassign judge
    if (this.gameState.judgeId === userId && this.gameState.game.status === 'active') {
      await this.assignRandomJudge();
    }

    // If host left, assign new host
    if (this.gameState.game.hostId === userId) {
      const remainingPlayers = this.gameState.players.filter(p => p.userId !== userId);
      if (remainingPlayers.length > 0) {
        await db
          .update(cahGames)
          .set({ hostId: remainingPlayers[0].userId })
          .where(eq(cahGames.id, this.gameId));
      }
    }

    await this.loadGameState();

    return { success: true, message: 'Left the game successfully' };
  }

  /**
   * Start the game
   */
  async startGame(): Promise<{ success: boolean; message: string }> {
    await this.loadGameState();
    
    if (!this.gameState) {
      return { success: false, message: 'Game not found' };
    }

    if (this.gameState.game.status !== 'waiting') {
      return { success: false, message: 'Game has already started' };
    }

    if (this.gameState.players.length < 3) {
      return { success: false, message: 'Need at least 3 players to start' };
    }

    // Start the first round
    const blackCard = await this.drawBlackCard();
    if (!blackCard) {
      return { success: false, message: 'No black cards available' };
    }

    const judgeId = this.gameState.players[0].userId;

    await db
      .update(cahGames)
      .set({
        status: 'active',
        startedAt: new Date(),
        currentJudgeId: judgeId,
        currentBlackCardId: blackCard.id,
        currentRound: 1,
      })
      .where(eq(cahGames.id, this.gameId));

    await this.loadGameState();

    return { success: true, message: 'Game started! Round 1 begins.' };
  }

  /**
   * Submit cards for current round
   */
  async submitCards(userId: string, cardIds: string[]): Promise<{ success: boolean; message: string }> {
    await this.loadGameState();
    
    if (!this.gameState) {
      return { success: false, message: 'Game not found' };
    }

    if (this.gameState.game.status !== 'active') {
      return { success: false, message: 'Game is not active' };
    }

    if (this.gameState.judgeId === userId) {
      return { success: false, message: 'Judge cannot submit cards' };
    }

    const player = this.gameState.players.find(p => p.userId === userId);
    if (!player) {
      return { success: false, message: 'You are not in this game' };
    }

    if (!this.gameState.currentBlackCard) {
      return { success: false, message: 'No black card for this round' };
    }

    if (cardIds.length !== this.gameState.currentBlackCard.pickCount) {
      return { success: false, message: `Must select ${this.gameState.currentBlackCard.pickCount} card(s)` };
    }

    // Check if player already submitted
    const existingSubmission = this.gameState.submissions.find(s => s.playerId === player.id);
    if (existingSubmission) {
      return { success: false, message: 'You have already submitted cards for this round' };
    }

    // Verify player has all submitted cards
    const playerHand = Array.isArray(player.hand) ? player.hand : [];
    const hasAllCards = cardIds.every(cardId => playerHand.includes(cardId));
    if (!hasAllCards) {
      return { success: false, message: 'You do not have one or more of the selected cards' };
    }

    // Submit cards
    const submissionData: InsertCahGameSubmission = {
      gameId: this.gameId,
      playerId: player.id,
      round: this.gameState.game.currentRound,
      whiteCardIds: cardIds,
      isWinner: false,
      votes: 0,
    };

    await db.insert(cahGameSubmissions).values(submissionData);

    // Remove submitted cards from player's hand
    const newHand = playerHand.filter(cardId => !cardIds.includes(cardId));
    await db
      .update(cahGamePlayers)
      .set({ hand: newHand })
      .where(eq(cahGamePlayers.id, player.id));

    await this.loadGameState();

    // Check if all non-judge players have submitted
    const nonJudgePlayers = this.gameState.players.filter(p => p.userId !== this.gameState.judgeId);
    const allSubmitted = nonJudgePlayers.every(player => 
      this.gameState!.submissions.some(s => s.playerId === player.id)
    );

    if (allSubmitted) {
      await db
        .update(cahGames)
        .set({ status: 'voting' })
        .where(eq(cahGames.id, this.gameId));
    }

    return { success: true, message: 'Cards submitted successfully!' };
  }

  /**
   * Judge selects winning submission
   */
  async selectWinner(userId: string, submissionId: string): Promise<{ success: boolean; message: string; winner?: CahGamePlayer }> {
    await this.loadGameState();
    
    if (!this.gameState) {
      return { success: false, message: 'Game not found' };
    }

    if (this.gameState.judgeId !== userId) {
      return { success: false, message: 'Only the judge can select the winner' };
    }

    if (this.gameState.game.status !== 'voting') {
      return { success: false, message: 'Not in voting phase' };
    }

    const submission = this.gameState.submissions.find(s => s.id === submissionId);
    if (!submission) {
      return { success: false, message: 'Invalid submission' };
    }

    const winner = this.gameState.players.find(p => p.id === submission.playerId);
    if (!winner) {
      return { success: false, message: 'Winner player not found' };
    }

    // Mark submission as winner
    await db
      .update(cahGameSubmissions)
      .set({ isWinner: true })
      .where(eq(cahGameSubmissions.id, submissionId));

    // Award point to winner
    await db
      .update(cahGamePlayers)
      .set({ score: winner.score + 1 })
      .where(eq(cahGamePlayers.id, winner.id));

    await this.loadGameState();

    // Check if game is over
    const gameSettings = this.gameState.game.settings as GameSettings;
    const winCondition = gameSettings.winCondition || 5;
    
    if ((winner.score + 1) >= winCondition) {
      await this.endGame(winner.userId);
      return { success: true, message: `${winner.userId} wins the game!`, winner };
    }

    // Start next round
    await this.startNextRound();

    return { success: true, message: 'Round complete! Starting next round.', winner };
  }

  /**
   * Start the next round
   */
  private async startNextRound(): Promise<void> {
    if (!this.gameState) return;

    const nextRound = this.gameState.game.currentRound + 1;
    
    // Check if max rounds reached
    if (nextRound > this.gameState.game.maxRounds) {
      // End game, find winner by highest score
      const winner = this.gameState.players.reduce((prev, current) => 
        (current.score > prev.score) ? current : prev
      );
      await this.endGame(winner.userId);
      return;
    }

    // Assign next judge
    const nextJudge = await this.getNextJudge();
    
    // Draw new black card
    const blackCard = await this.drawBlackCard();
    if (!blackCard) {
      throw new Error('No more black cards available');
    }

    // Deal cards to all players to refill hands to 7
    for (const player of this.gameState.players) {
      const currentHand = Array.isArray(player.hand) ? player.hand : [];
      const cardsNeeded = 7 - currentHand.length;
      
      if (cardsNeeded > 0) {
        const newCards = await this.dealWhiteCards(cardsNeeded);
        const newHand = [...currentHand, ...newCards.map(c => c.id)];
        
        await db
          .update(cahGamePlayers)
          .set({ hand: newHand })
          .where(eq(cahGamePlayers.id, player.id));
      }
    }

    // Update game state
    await db
      .update(cahGames)
      .set({
        currentRound: nextRound,
        currentJudgeId: nextJudge,
        currentBlackCardId: blackCard.id,
        status: 'active',
      })
      .where(eq(cahGames.id, this.gameId));

    await this.loadGameState();
  }

  /**
   * End the game
   */
  private async endGame(winnerId: string): Promise<void> {
    await db
      .update(cahGames)
      .set({
        status: 'finished',
        winnerId,
        endedAt: new Date(),
      })
      .where(eq(cahGames.id, this.gameId));

    // Update player statistics
    await this.updatePlayerStats();
  }

  /**
   * Get next judge based on rotation or random
   */
  private async getNextJudge(): Promise<string> {
    if (!this.gameState) throw new Error('No game state');

    const settings = this.gameState.game.settings as GameSettings;
    const gameData = this.gameState.game.gameData as any;

    if (settings.judgeRotation) {
      const rotationIndex = (gameData.judgeRotationIndex || 0) + 1;
      const nextJudgeIndex = rotationIndex % this.gameState.players.length;
      
      // Update rotation index
      await db
        .update(cahGames)
        .set({
          gameData: { ...gameData, judgeRotationIndex: rotationIndex }
        })
        .where(eq(cahGames.id, this.gameId));

      return this.gameState.players[nextJudgeIndex].userId;
    } else {
      // Random judge
      const randomIndex = Math.floor(Math.random() * this.gameState.players.length);
      return this.gameState.players[randomIndex].userId;
    }
  }

  /**
   * Draw a random black card that hasn't been used
   */
  private async drawBlackCard(): Promise<CahBlackCard | null> {
    if (!this.gameState) return null;

    const settings = this.gameState.game.settings as GameSettings;
    const gameData = this.gameState.game.gameData as any;
    const usedCards = gameData.usedBlackCards || [];

    const cardSets = settings.familyFriendly ? ['family', 'community'] : settings.cardSets;

    const [card] = await db
      .select()
      .from(cahBlackCards)
      .where(and(
        eq(cahBlackCards.isActive, true),
        inArray(cahBlackCards.cardSet, cardSets),
        not(inArray(cahBlackCards.id, usedCards))
      ))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (card) {
      // Mark card as used
      const newUsedCards = [...usedCards, card.id];
      await db
        .update(cahGames)
        .set({
          gameData: { ...gameData, usedBlackCards: newUsedCards }
        })
        .where(eq(cahGames.id, this.gameId));
    }

    return card || null;
  }

  /**
   * Deal white cards to a player
   */
  private async dealWhiteCards(count: number): Promise<CahWhiteCard[]> {
    if (!this.gameState) return [];

    const settings = this.gameState.game.settings as GameSettings;
    const gameData = this.gameState.game.gameData as any;
    const usedCards = gameData.usedWhiteCards || [];

    const cardSets = settings.familyFriendly ? ['family', 'community'] : settings.cardSets;

    const cards = await db
      .select()
      .from(cahWhiteCards)
      .where(and(
        eq(cahWhiteCards.isActive, true),
        inArray(cahWhiteCards.cardSet, cardSets),
        not(inArray(cahWhiteCards.id, usedCards))
      ))
      .orderBy(sql`RANDOM()`)
      .limit(count);

    // Mark cards as used
    const newUsedCards = [...usedCards, ...cards.map(c => c.id)];
    await db
      .update(cahGames)
      .set({
        gameData: { ...gameData, usedWhiteCards: newUsedCards }
      })
      .where(eq(cahGames.id, this.gameId));

    return cards;
  }

  /**
   * Assign random judge when current judge leaves
   */
  private async assignRandomJudge(): Promise<void> {
    if (!this.gameState) return;

    const activePlayers = this.gameState.players.filter(p => p.isActive);
    if (activePlayers.length === 0) return;

    const randomIndex = Math.floor(Math.random() * activePlayers.length);
    const newJudge = activePlayers[randomIndex];

    await db
      .update(cahGames)
      .set({ currentJudgeId: newJudge.userId })
      .where(eq(cahGames.id, this.gameId));
  }

  /**
   * Update player statistics after game ends
   */
  private async updatePlayerStats(): Promise<void> {
    if (!this.gameState) return;

    for (const player of this.gameState.players) {
      const isWinner = player.userId === this.gameState.game.winnerId;
      
      // Get or create stats record
      const [existingStats] = await db
        .select()
        .from(cahGameStats)
        .where(and(
          eq(cahGameStats.userId, player.userId),
          eq(cahGameStats.serverId, this.gameState.game.serverId)
        ));

      if (existingStats) {
        // Update existing stats
        await db
          .update(cahGameStats)
          .set({
            gamesPlayed: existingStats.gamesPlayed + 1,
            gamesWon: existingStats.gamesWon + (isWinner ? 1 : 0),
            roundsWon: existingStats.roundsWon + player.score,
            totalScore: existingStats.totalScore + player.score,
            lastPlayedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cahGameStats.id, existingStats.id));
      } else {
        // Create new stats record
        await db.insert(cahGameStats).values({
          userId: player.userId,
          serverId: this.gameState.game.serverId,
          gamesPlayed: 1,
          gamesWon: isWinner ? 1 : 0,
          roundsWon: player.score,
          totalScore: player.score,
          lastPlayedAt: new Date(),
        });
      }
    }
  }

  /**
   * Get player's hand
   */
  async getPlayerHand(userId: string): Promise<CahWhiteCard[]> {
    await this.loadGameState();
    
    if (!this.gameState) return [];

    const player = this.gameState.players.find(p => p.userId === userId);
    if (!player) return [];

    const handIds = Array.isArray(player.hand) ? player.hand : [];
    if (handIds.length === 0) return [];

    const cards = await db
      .select()
      .from(cahWhiteCards)
      .where(inArray(cahWhiteCards.id, handIds));

    return cards;
  }

  /**
   * Get game state
   */
  getGameState(): CahGameState | null {
    return this.gameState;
  }

  /**
   * Cancel/end game early
   */
  async cancelGame(): Promise<{ success: boolean; message: string }> {
    await db
      .update(cahGames)
      .set({
        status: 'cancelled',
        endedAt: new Date(),
      })
      .where(eq(cahGames.id, this.gameId));

    return { success: true, message: 'Game cancelled successfully' };
  }
}