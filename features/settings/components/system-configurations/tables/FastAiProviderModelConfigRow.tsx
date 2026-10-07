import { Grid, Select, Text, Tooltip, ThemeIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck, IconInfoCircle } from '@tabler/icons-react';

import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

interface FastAiProviderModelConfigRowProps {
  fastAiProviderModelId: string | null;
}

export default function FastAiProviderModelConfigRow({ fastAiProviderModelId }: FastAiProviderModelConfigRowProps) {
  const {
    data: modelData,
    isPending: modelsIsPending,
    error: modelsError,
  } = useGetModels();

  const { mutateAsync: updateSystemConfig } = useUpdateSystemConfig();

  const noneOption = { value: '', label: '(None)' };

  const modelOptions = modelData?.models
    .filter((model) => !model.embeddingsOnly)
    .map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    })) ?? [];

  const selectOptions = modelOptions.length > 0 ? [noneOption, ...modelOptions] : [];
  const defaultValue = fastAiProviderModelId ?? '';

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
        configField: SystemConfigFields.FastAiProviderModelId,
        configValue: value === '' ? null : value,
      });
      const successMessage = value.length ? 'Model selection updated successfully' : 'Fast AI model has been removed.';
      notifications.show({
        id: 'update-fast-ai-provider-model',
        title: 'Fast AI Model Updated',
        message: successMessage,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    } catch (error) {
      notifications.show({
        id: 'update-fast-ai-provider-model',
        title: 'Failed to Update',
        message: error instanceof Error ? error.message : 'An error occurred while updating the fast AI model',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='fast-ai-provider-model-config-row'>
      <td>
        <Grid>
          <Grid.Col span={6}>
            <Group align='center' spacing='sm'>
              <label htmlFor='select-fast-ai-provider-model'>Fast AI Provider Model</label>
              <Tooltip label='A lightweight, fast model used for internal agent operations such as tool planning and routing. Choose a cost-effective model like Haiku.'>
                <ThemeIcon size='xs'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
            <Select
              id='select-fast-ai-provider-model'
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
}
