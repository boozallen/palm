import { trpc } from '@/libs';

export default function useUpdateAiProviderModel() {
  const utils = trpc.useContext();

  return trpc.settings.updateAiProviderModel.useMutation({
    onSuccess: (data) => {
      utils.settings.getModels.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          models: oldData.models.map((model) => {
            if (model.id === data.id) {
              return data;
            }

            return model;
          }),
        };
      });
    },
  });
}
