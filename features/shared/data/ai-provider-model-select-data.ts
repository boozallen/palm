import { useMemo } from 'react';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { filterModelsByProviderIds } from '@/features/shared/utils/filterAvailableModels';

type SelectModelItem = {
  label: string;
  value: string;
  group: string;
};

type AiProviderModelSelectData = {
  modelOptions: SelectModelItem[];
  modelsIsError: boolean;
  modelsError: any; // Update the type of modelsError as needed
};

// When aiProviderIds is passed, options are narrowed to those providers only
// (e.g. a workflow pinned to a single user group).
export const useGetAiProviderModelSelectData = ({
  aiProviderIds,
}: { aiProviderIds?: string[] } = {}): AiProviderModelSelectData => {
  const {
    data: modelData,
    isError: modelsIsError,
    error: modelsError,
  } = useGetAvailableModels();

  const modelOptions = useMemo(() => {
    if (!modelData) {
      return [];
    }

    return filterModelsByProviderIds(modelData.availableModels, aiProviderIds).map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    }));
  }, [modelData, aiProviderIds]);

  return { modelOptions, modelsIsError, modelsError };
};
