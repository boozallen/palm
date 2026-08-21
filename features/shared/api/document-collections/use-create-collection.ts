import { trpc } from '@/libs';

export default function useCreateCollection() {
  const utils = trpc.useUtils();

  return trpc.shared.documentCollections.createCollection.useMutation({
    onSuccess: () => {
      utils.shared.documentCollections.getCollections.invalidate();
    },
  });
}
