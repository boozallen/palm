import db from '@/server/db';

type UpdateCategorySocMappingInput = {
  categoryId: string;
  socCode: string;
  socTitle: string;
};

export default async function updateCategorySocMapping({
  categoryId,
  socCode,
  socTitle,
}: UpdateCategorySocMappingInput): Promise<void> {
  await db.rateCardCategory.update({
    where: { id: categoryId },
    data: {
      mappedSocCode: socCode,
      mappedSocTitle: socTitle,
    },
  });
}
