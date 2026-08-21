import { trpc } from '@/libs';

export default function useRemoveDocumentFromCollection() {
  const utils = trpc.useUtils();

  return trpc.shared.documentCollections.removeDocumentFromCollection.useMutation({
    onSuccess: () => {
      utils.shared.documentCollections.getCollections.invalidate();
      utils.shared.getDocuments.invalidate();
    },
  });
}
