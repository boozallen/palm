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
    },
  });
}
