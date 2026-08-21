import { trpc } from '@/libs';

export default function useDeleteDocument() {
  const utils = trpc.useUtils();

  return trpc.shared.deleteDocument.useMutation({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });
}
