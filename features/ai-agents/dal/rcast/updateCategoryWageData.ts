import db from '@/server/db';
import { BlsWageData, DolWageData } from '@/features/ai-agents/shared/wage-data';

type UpdateCategoryWageDataInput = {
  categoryId: string;
  blsData: BlsWageData | null;
  dolData: DolWageData | null;
};

export default async function updateCategoryWageData({
  categoryId,
  blsData,
  dolData,
}: UpdateCategoryWageDataInput): Promise<void> {
  await db.rateCardCategory.update({
    where: { id: categoryId },
    data: {
      blsSalaryData: blsData ? (blsData as any) : undefined,
      dolSalaryData: dolData ? (dolData as any) : undefined,
      lastSalaryUpdate: new Date(),
    },
  });
}
