import { trpc } from '@/libs/trpc';

export default function useCreateDocumentUploadProvider() {
  const utils = trpc.useUtils();

  return trpc.settings.createDocumentUploadProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getDocumentUploadProviders.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return { providers: [ ...oldData.providers, data ] };
      });
    },
  });
}
