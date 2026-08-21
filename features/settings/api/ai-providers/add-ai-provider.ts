import { trpc } from '@/libs';

export default function useAddAiProvider() {
  const utils = trpc.useContext();

  return trpc.settings.addAiProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getAiProviders.setData({}, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          aiProviders: [
            ...oldData.aiProviders,
            {
              id: data.provider.id,
              label: data.provider.label,
              createdAt: data.provider.createdAt,
              updatedAt: data.provider.updatedAt,
            },
          ],
        };
      });

      utils.settings.getAiProvider.setData({ id: data.provider.id }, () => {
        return {
          provider: data.provider,
        };
      });

      // A new provider starts with no models, so getModels has to be refetched for
      // the provider's (empty) model list to exist in the cache at all. Without it
      // the table can read a previous provider's entry until the admin reloads.
      utils.settings.getModels.invalidate();
    },
  });
}
