import db from '@/server/db';

export type RateCardCategoryForDisplay = {
  id: string;
  laborCategoryName: string;
  experienceLevel: string;
  billRate: number | null;
  mappedSocCode: string | null;
  mappedSocTitle: string | null;
  blsSalaryData: unknown;
  dolSalaryData: unknown;
  lastSalaryUpdate: Date | null;
};

export default async function getRateCardCategoriesForDisplay(
  rateCardId: string,
  agentId: string
): Promise<RateCardCategoryForDisplay[] | null> {
  const rateCard = await db.rateCard.findFirst({
    where: { id: rateCardId, agentId },
  });

  if (!rateCard) {
    return null;
  }

  return db.rateCardCategory.findMany({
    where: { rateCardId },
    select: {
      id: true,
      laborCategoryName: true,
      experienceLevel: true,
      billRate: true,
      mappedSocCode: true,
      mappedSocTitle: true,
      blsSalaryData: true,
      dolSalaryData: true,
      lastSalaryUpdate: true,
    },
    orderBy: { laborCategoryName: 'asc' },
  });
}
