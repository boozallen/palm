import { trpc } from '@/libs/trpc';

export default function useUpdateDocumentUploadProvider() {
  const utils = trpc.useUtils();

  return trpc.settings.updateDocumentUploadProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getDocumentUploadProviders.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          providers: oldData.providers.map((p) => (p.id === data.id ? data : p)),
        };
      });
    },
  });
}
