import { useMemo } from 'react';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

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

export const useGetAiProviderModelSelectData = (): AiProviderModelSelectData => {
  const {
    data: modelData,
    isError: modelsIsError,
    error: modelsError,
  } = useGetAvailableModels();

  const modelOptions = useMemo(() => {
    if (!modelData) {
      return [];
    }

    return modelData.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    }));
  }, [modelData]);

  return { modelOptions, modelsIsError, modelsError };
};
