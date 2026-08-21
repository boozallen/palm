import { trpc } from '@/libs';

export default function useUpdateCollection() {
  const utils = trpc.useUtils();

  return trpc.shared.documentCollections.updateCollection.useMutation({
    onSuccess: () => {
      utils.shared.documentCollections.getCollections.invalidate();
    },
  });
}
