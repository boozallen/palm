import db from '@/server/db';

type CategoryWithSocCode = {
  id: string;
  mappedSocCode: string | null;
  laborCategoryName: string;
};

export default async function getCategoriesWithSocCodes(
  rateCardId: string
): Promise<CategoryWithSocCode[]> {
  return db.rateCardCategory.findMany({
    where: {
      rateCardId,
      mappedSocCode: { not: null },
    },
    select: {
      id: true,
      mappedSocCode: true,
      laborCategoryName: true,
    },
  });
}
