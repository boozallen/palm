import { trpc } from '@/libs';

export default function useDeleteDocumentUploadProvider() {
  const utils = trpc.useUtils();

  return trpc.settings.deleteDocumentUploadProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getDocumentUploadProviders.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        };

        return {
          providers: oldData.providers.filter(
            (provider) => provider.id !== data.providerId
          ),
        };
      });

      utils.shared.getDocuments.invalidate();
      utils.shared.getSystemConfig.invalidate();
    },
  });
}
