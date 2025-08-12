import { trpc } from '@/libs';

export default function useDeleteAiProviderModel() {
  const utils = trpc.useContext();

  return trpc.settings.deleteAiProviderModel.useMutation({
    onSuccess: (data) => {
      utils.settings.getModels.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          models: oldData.models.filter((model) => model.id !== data.id),
        };

        return newData;
      });

      utils.shared.getSystemConfig.invalidate();
    },
  });
}
