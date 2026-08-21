import { trpc } from '@/libs';

export function useRejectSharedDocument() {
  const utils = trpc.useContext();

  return trpc.shared.rejectSharedDocument.useMutation({
    onSuccess: () => {
      utils.shared.getSharedDocuments.invalidate();
    },
  });
}
