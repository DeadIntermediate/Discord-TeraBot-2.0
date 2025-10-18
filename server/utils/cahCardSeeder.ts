// CAH card seeder removed. This file is a small, safe placeholder so imports remain valid
// without keeping large copyrighted CAH card lists in the repository.

export async function seedCahCards(): Promise<void> {
  // Intentionally a noop to avoid seeding CAH cards. If you want to re-enable
  // seeding, restore from your private backup or contact the repo maintainer.
  return;
}

export async function seedAdditionalCards(): Promise<void> {
  // No-op placeholder for additional card sets.
  return;
}

export async function getCardStats(): Promise<{
  totalWhiteCards: number;
  totalBlackCards: number;
  cardSetBreakdown: any[];
}> {
  return { totalWhiteCards: 0, totalBlackCards: 0, cardSetBreakdown: [] };
}