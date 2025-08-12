import { trpc } from '@/libs';

export default function useDeleteAiProvider() {
  const utils = trpc.useContext();

  return trpc.settings.deleteAiProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getAiProviders.setData({}, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = oldData.aiProviders.filter(
          (provider) => provider.id !== data.id
        );

        return {
          aiProviders: newData,
        };
      });

      utils.settings.getModels.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          models: oldData.models.filter(
            (model) => model.aiProviderId !== data.id
          ),
        };

        return newData;
      });
    },
  });
}
