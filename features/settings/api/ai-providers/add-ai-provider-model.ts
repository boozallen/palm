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

        const updates: Partial<typeof oldData> = {};
        if (oldData.systemAiProviderModelId === null) {
          updates.systemAiProviderModelId = data.id;
        }
        if (oldData.fastAiProviderModelId === null) {
          updates.fastAiProviderModelId = data.id;
        }
        if (Object.keys(updates).length > 0) {
          return { ...oldData, ...updates };
        }
        return oldData;
      });
    },
  });
}
