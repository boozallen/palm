import { trpc } from '@/libs';

export function useShareDocument() {
  const utils = trpc.useUtils();

  return trpc.shared.shareDocument.useMutation({
    onSuccess: () => {
      utils.shared.getSharedDocuments.invalidate();
    },
  });
}

