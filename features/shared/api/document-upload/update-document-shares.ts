import { trpc } from '@/libs';

export function useUpdateDocumentShares() {
  const utils = trpc.useUtils();

  return trpc.shared.updateDocumentShares.useMutation({
    onSuccess: () => {
      utils.shared.getSharedDocuments.invalidate();
    },
  });
}
