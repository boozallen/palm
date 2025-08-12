import { useEffect } from 'react';
import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import useGetAiProviders from '@/features/settings/api/get-ai-providers';
import { AnalyticsQuery } from '@/features/settings/types/analytics';

type AiProviderInputProps = Readonly<{
  form: UseFormReturnType<AnalyticsQuery>;
}>

export default function AiProviderInput({ form }: AiProviderInputProps) {

  const { data: aiProviders } = useGetAiProviders();

  const aiProvidersData = aiProviders?.aiProviders?.map((provider) => ({
    value: provider.id,
    label: provider.label,
  })) ?? [];

  useEffect(() => {
    if (aiProviders && aiProvidersData.length === 0 && form.values.aiProvider !== '') {
      form.setFieldValue('aiProvider', '');
    }
  });

  if (aiProvidersData.length !== 0) {
    aiProvidersData.unshift({ value: 'all', label: 'All providers' });
  }

  return (
    <Select
      label='AI Provider'
      mb='0'
      placeholder={aiProvidersData.length !== 0 ? 'Select AI provider' : 'No providers available'}
      data={aiProvidersData}
      disabled={aiProvidersData.length === 0}
      nothingFound='No AI providers available'
      {...form.getInputProps('aiProvider')}
    />
  );
}
