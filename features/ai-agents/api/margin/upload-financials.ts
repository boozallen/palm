import { trpc } from '@/libs';

export default function useUploadFinancials() {
  const utils = trpc.useUtils();

  return trpc.aiAgents.uploadFinancials.useMutation({
    onSuccess: () => {
      utils.aiAgents.getMarginAnalyses.invalidate();
    },
  });
}
