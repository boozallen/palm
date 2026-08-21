import db from '@/server/db';

type RateCardStatus = 'pending' | 'processing' | 'completed' | 'failed';

export default async function updateRateCardStatus(
  rateCardId: string,
  status: RateCardStatus
): Promise<void> {
  await db.rateCard.update({
    where: { id: rateCardId },
    data: { uploadStatus: status },
  });
}
