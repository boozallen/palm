import { Grid, Select, Text, Tooltip, ThemeIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck, IconInfoCircle } from '@tabler/icons-react';

import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

interface KnowledgeGraphAiProviderModelConfigRowProps {
  knowledgeGraphAiProviderModelId: string | null;
  indent?: boolean;
}

export default function KnowledgeGraphAiProviderModelConfigRow({ knowledgeGraphAiProviderModelId, indent }: KnowledgeGraphAiProviderModelConfigRowProps) {
  const {
    data: modelData,
    isPending: modelsIsPending,
    error: modelsError,
  } = useGetModels();

  const { mutateAsync: updateSystemConfig } = useUpdateSystemConfig();

  const noneOption = { value: '', label: '(None)' };

  // Embedding models can't serve the completions this config drives.
  const modelOptions = modelData?.models
    .filter((model) => !model.embeddingsOnly)
    .map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    })) ?? [];

  const selectOptions = modelOptions.length > 0 ? [noneOption, ...modelOptions] : [];
  const defaultValue = knowledgeGraphAiProviderModelId ?? '';

  if (modelsIsPending) {
    return (
      <tr>
        <td colSpan={2}>
          <Loading />
        </td>
      </tr>
    );
  }

  if (modelsError) {
    return (
      <tr>
        <td colSpan={2}>
          <Text>{modelsError.message}</Text>
        </td>
      </tr>
    );
  }

  const handleModelChange = async (value: string) => {
    try {
      await updateSystemConfig({
        configField: SystemConfigFields.KnowledgeGraphAiProviderModelId,
        configValue: value === '' ? null : value,
      });
      const successMessage = value.length ? 'Model selection updated successfully' : 'Knowledge graph model has been removed.';
      notifications.show({
        id: 'update-knowledge-graph-ai-provider-model',
        title: 'Knowledge Graph Model Updated',
        message: successMessage,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    } catch (error) {
      notifications.show({
        id: 'update-knowledge-graph-ai-provider-model',
        title: 'Failed to Update',
        message: error instanceof Error ? error.message : 'An error occurred while updating the knowledge graph model',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='knowledge-graph-ai-provider-model-config-row'>
      <td>
        <Grid pl={indent ? 'xl' : undefined}>
          <Grid.Col span={6}>
            <Group align='center' spacing='sm'>
              <label htmlFor='select-knowledge-graph-ai-provider-model'>Knowledge Graph AI Provider Model</label>
              <Tooltip label='Set the AI model used for knowledge graph operations, such as entity extraction and relationship analysis'>
                <ThemeIcon size='xs'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
            <Select
              id='select-knowledge-graph-ai-provider-model'
              variant='default'
              data={selectOptions}
              value={modelOptions.length > 0 ? defaultValue : null}
              placeholder='No models available'
              onChange={handleModelChange}
              disabled={!modelOptions.length}
              pt='sm'
            />
          </Grid.Col>
        </Grid>
      </td>
      <td></td>
    </tr>
  );
};