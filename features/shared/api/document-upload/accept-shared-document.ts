import { trpc } from '@/libs';

export default function useAcceptSharedDocument() {
  const utils = trpc.useContext();

  return trpc.shared.acceptSharedDocument.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await utils.shared.getSharedDocuments.cancel();

      // Snapshot the previous value
      const previousData = utils.shared.getSharedDocuments.getData();

      // Optimistically update to remove the accepted document from incoming shares
      utils.shared.getSharedDocuments.setData(undefined, (old) => {
        if (!old) {
          return old;
        }

        return {
          ...old,
          incoming: old.incoming.filter(doc => doc.id !== variables.sharedDocumentId),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      // Refresh the incoming shares list (the accepted share is removed) and the
      // user's document library, where the accepted copy now appears. Without the
      // getDocuments invalidation the new copy only shows after a page refresh.
      // Graph-related invalidations for graphed shares happen in the component.
      utils.shared.getSharedDocuments.invalidate();
      utils.shared.getDocuments.invalidate();
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.shared.getSharedDocuments.setData(undefined, context.previousData);
      }
    },
  });
}
