import db from '@/server/db';

export type RateCardCategoryForExport = {
  laborCategoryName: string;
  experienceLevel: string;
  billRate: number | null;
  mappedSocCode: string | null;
  mappedSocTitle: string | null;
  blsSalaryData: unknown;
  dolSalaryData: unknown;
};

export type RateCardForExport = {
  filename: string;
  categories: RateCardCategoryForExport[];
};

export default async function getRateCardForExport(
  rateCardId: string,
  agentId: string
): Promise<RateCardForExport | null> {
  const rateCard = await db.rateCard.findFirst({
    where: { id: rateCardId, agentId },
    select: {
      filename: true,
      rateCardCategories: {
        select: {
          laborCategoryName: true,
          experienceLevel: true,
          billRate: true,
          mappedSocCode: true,
          mappedSocTitle: true,
          blsSalaryData: true,
          dolSalaryData: true,
        },
        orderBy: [
          { laborCategoryName: 'asc' },
          { experienceLevel: 'asc' },
        ],
      },
    },
  });

  if (!rateCard) {
    return null;
  }

  return {
    filename: rateCard.filename,
    categories: rateCard.rateCardCategories,
  };
}
