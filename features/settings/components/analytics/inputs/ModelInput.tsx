import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect, useMemo } from 'react';

import useGetModels from '@/features/settings/api/ai-providers/get-models';
import { AnalyticsQuery } from '@/features/settings/types/analytics';

type ModelInputProps = Readonly<{
  form: UseFormReturnType<AnalyticsQuery>;
}>

export default function ModelInput({ form }: ModelInputProps) {

  const { data: models } = useGetModels();

  // Dynamically set models data based on selected AI provider
  const modelsData = useMemo(() => {
    if (!models || models.models.length === 0) {
      return [];
    }

    const filteredModels = form.values.aiProvider === 'all' ?
      models.models :
      models.models.filter((model) => model.aiProviderId === form.values.aiProvider);

    const modelsOptions = filteredModels.map((model) => ({
      value: model.id,
      label: model.name,
    }));

    modelsOptions.unshift({ value: 'all', label: 'All models' });

    return modelsOptions;
  }, [models, form.values.aiProvider]);

  useEffect(() => {
    const modelValues = modelsData.map((model) => model.value);

    // Reset model value if no models available
    if (models && modelsData.length === 0 && form.values.model !== '') {
      form.setFieldValue('model', '');
    }

    if (form.values.model && !modelValues.includes(form.values.model) && modelsData.length > 0) {
      form.setFieldValue('model', 'all');
    }

    if (form.values.aiProvider === 'all' && (modelValues.length > 0 && form.values.model !== 'all')) {
      form.setFieldValue('model', 'all');
    }

  }, [modelsData, form, models]);

  return (
    <Select
      label='Model'
      mb='0'
      placeholder={modelsData.length !== 0 ? 'Select model' : 'No models available'}
      data={modelsData}
      disabled={form.values.aiProvider === 'all' || modelsData.length === 0}
      nothingFound='No models available'
      {...form.getInputProps('model')}
      value={form.values.model ?? null}
    />
  );
}
