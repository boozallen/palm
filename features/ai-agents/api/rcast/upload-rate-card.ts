import { trpc } from '@/libs';

export default function useUploadRateCard() {
  const utils = trpc.useUtils();

  return trpc.aiAgents.uploadRateCard.useMutation({
    onSuccess: () => {
      utils.aiAgents.getRateCards.invalidate();
    },
  });
}
