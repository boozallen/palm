import { hasApiEndpoint, isBedrockConfig } from '@/features/shared/types';
import { trpc } from '@/libs';

export default function useUpdateAiProvider() {
  const utils = trpc.useContext();

  return trpc.settings.updateAiProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getAiProviders.setData({}, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          aiProviders: oldData.aiProviders.map((aiProvider) => {
            if (aiProvider.id === data.provider.id) {
              // id and createdAt are immutable
              return {
                ...aiProvider,
                label: data.provider.label,
                updatedAt: data.provider.updatedAt,
              };
            }

            return aiProvider;
          }),
        };
      });

      utils.settings.getAiProvider.setData({
        id: data.provider.id,
      }, {
        provider: {
          id: data.provider.id,
          typeId: data.provider.typeId,
          label: data.provider.label,
          config: {
            id: data.provider.config.id,
            apiEndpoint: hasApiEndpoint(data.provider.config) ? data.provider.config.apiEndpoint : null,
            region: isBedrockConfig(data.provider.config) ? data.provider.config.region : null,
          },
          inputCostPerMillionTokens: data.provider.inputCostPerMillionTokens,
          outputCostPerMillionTokens: data.provider.outputCostPerMillionTokens,
          createdAt: data.provider.createdAt,
          updatedAt: data.provider.updatedAt,
        },
      });
    },
  });
}
