import { trpc } from '@/libs';

export default function useAddDocumentToCollection() {
  const utils = trpc.useUtils();

  return trpc.shared.documentCollections.addDocumentToCollection.useMutation({
    onSuccess: () => {
      utils.shared.documentCollections.getCollections.invalidate();
      utils.shared.getDocuments.invalidate();
    },
  });
}
