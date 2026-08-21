import db from '@/server/db';

export type RateCardCategoryForProcessing = {
  id: string;
  laborCategoryName: string;
  experienceLevel: string;
  billRate: number | null;
};

export default async function getRateCardCategoriesForProcessing(
  rateCardId: string
): Promise<RateCardCategoryForProcessing[]> {
  return db.rateCardCategory.findMany({
    where: { rateCardId },
    select: {
      id: true,
      laborCategoryName: true,
      experienceLevel: true,
      billRate: true,
    },
  });
}
