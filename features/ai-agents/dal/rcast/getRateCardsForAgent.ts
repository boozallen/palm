import db from '@/server/db';

export type RateCardSummary = {
  id: string;
  filename: string;
  uploadStatus: string;
  createdAt: Date;
};

export default async function getRateCardsForAgent(
  agentId: string
): Promise<RateCardSummary[]> {
  return db.rateCard.findMany({
    where: {
      agentId,
      uploadStatus: 'completed',
    },
    select: {
      id: true,
      filename: true,
      uploadStatus: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
