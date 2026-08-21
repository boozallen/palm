/**
 * LLM Prompt Configuration Form
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Stack, Textarea, Select, Text, Box } from '@mantine/core';

import useGetAvailableModels from '@/features/shared/api/get-available-models';
import AiConfigSlider from '@/features/shared/components/forms/inputs/AiConfigSlider';
import { useGetAiProviderModelSelectData } from '@/features/shared/data/ai-provider-model-select-data';
import { AiProviderType } from '@/features/shared/types/ai-provider';
import PromptSelector from '@/features/workflows/components/nodes/config/inputs/PromptSelector';
import { NodeConfigProps, PromptConfig as PromptConfigType } from '@/features/workflows/types/primitive';

const PENALTY_PROVIDER_TYPES = new Set([
  AiProviderType.OpenAi,
  AiProviderType.AzureOpenAi,
]);

export default function PromptConfig({ config: rawConfig, onChange: rawOnChange }: Readonly<NodeConfigProps>) {
  const onChangeProp = rawOnChange as unknown as (config: PromptConfigType) => void;
  const { modelOptions } = useGetAiProviderModelSelectData();
  const { data: modelsData } = useGetAvailableModels();

  const [config, setConfig] = useState<PromptConfigType>(rawConfig as unknown as PromptConfigType);

  // Sync parent → local when the parent prop changes (e.g. on modal open)
  useEffect(() => {
    setConfig(rawConfig as unknown as PromptConfigType);
  }, [rawConfig]);

  const updateField = useCallback(<K extends keyof PromptConfigType>(key: K, value: PromptConfigType[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      onChangeProp(next);
      return next;
    });
  }, [onChangeProp]);

  const selectedProviderTypeId = useMemo(() => {
    if (!config.model || !modelsData?.availableModels) {
      return null;
    }
    const match = modelsData.availableModels.find((m) => m.id === config.model);
    return match?.aiProviderTypeId ?? null;
  }, [config.model, modelsData]);

  const showPenalties = selectedProviderTypeId !== null
    && PENALTY_PROVIDER_TYPES.has(selectedProviderTypeId);

  // Clear penalty values when switching to a provider that doesn't support them
  useEffect(() => {
    if (selectedProviderTypeId !== null && !PENALTY_PROVIDER_TYPES.has(selectedProviderTypeId)) {
      if (config.frequencyPenalty || config.presencePenalty) {
        setConfig((prev) => {
          const next = { ...prev, frequencyPenalty: undefined, presencePenalty: undefined };
          onChangeProp(next);
          return next;
        });
      }
    }
  }, [selectedProviderTypeId, config.frequencyPenalty, config.presencePenalty, onChangeProp]);

  return (
    <Stack spacing='xs'>

      <PromptSelector
        onSelect={(instructions) => updateField('prompt', instructions)}
      />

      <Textarea
        label='Prompt'
        placeholder='e.g. Review the website content against the checklist and identify any gaps.'
        value={config.prompt ?? config.promptText ?? ''}
        onChange={(e) => updateField('prompt', e.currentTarget.value)}
        autosize
        maxRows={20}
        required
      />

      <Select
        label='Model'
        placeholder='Select AI model'
        value={config.model || ''}
        onChange={(value) => updateField('model', value || '')}
        data={modelOptions}
        searchable
        required
      />

      {config.model && <Box mb='sm'>
        <Text mb='xs'fw={500}  size='sm'>Model parameters</Text>
        <Grid>
          <Grid.Col span={6}>
            <AiConfigSlider
              label='Temperature'
              value={config.temperature ?? 0.5}
              onChange={(value) => updateField('temperature', value)}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <AiConfigSlider
              label='Top P'
              value={config.topP ?? 0.5}
              onChange={(value) => updateField('topP', value)}
            />
          </Grid.Col>
        </Grid>

        {showPenalties && (
          <Grid>
            <Grid.Col span={6}>
              <AiConfigSlider
                label='Frequency Penalty'
                min={0}
                max={2}
                step={0.01}
                value={config.frequencyPenalty ?? 0}
                onChange={(value) => updateField('frequencyPenalty', value)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <AiConfigSlider
                label='Presence Penalty'
                min={0}
                max={2}
                step={0.01}
                value={config.presencePenalty ?? 0}
                onChange={(value) => updateField('presencePenalty', value)}
              />
            </Grid.Col>
          </Grid>
        )}
      </Box>}
    </Stack>
  );
}
