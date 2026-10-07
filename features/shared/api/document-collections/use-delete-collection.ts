import { trpc } from '@/libs';

export default function useDeleteCollection() {
  const utils = trpc.useUtils();

  return trpc.shared.documentCollections.deleteCollection.useMutation({
    onSuccess: () => {
      utils.shared.documentCollections.getCollections.invalidate();
      utils.shared.getDocuments.invalidate();
    },
  });
}
