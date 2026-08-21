import { trpc } from '@/libs';

export default function useExportRateCard() {
  return trpc.aiAgents.exportRateCard.useMutation();
}
