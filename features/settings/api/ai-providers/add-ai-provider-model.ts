import { trpc } from '@/libs';

export default function useAddAiProviderModel() {
  const utils = trpc.useContext();

  return trpc.settings.addAiProviderModel.useMutation({
    onSuccess: (data) => {
      utils.settings.getModels.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return { models: [...oldData.models, data] };
      });

      utils.shared.getSystemConfig.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        if (oldData.systemAiProviderModelId === null) {
          return {
            ...oldData,
            systemAiProviderModelId: data.id,
          };
        }
        else {
          return oldData;
        }
      });
    },
  });
}
