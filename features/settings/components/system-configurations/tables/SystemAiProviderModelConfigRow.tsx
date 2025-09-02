import { Grid, Select, Text, Tooltip, ThemeIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck, IconInfoCircle } from '@tabler/icons-react';

import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

interface SystemAiProviderModelConfigRowProps {
  systemAiProviderModelId: string | null;
}

export default function SystemAiProviderModelConfigRow({ systemAiProviderModelId }: SystemAiProviderModelConfigRowProps) {
  const {
    data: modelData,
    isPending: modelsIsPending,
    error: modelsError,
  } = useGetModels();

  const { mutateAsync: updateSystemConfig, error: updateSystemConfigError } = useUpdateSystemConfig();

  const modelOptions = modelData?.models.map((model) => ({
    value: model.id,
    label: model.name,
    group: model.providerLabel,
  })) ?? [];

  const defaultValue = systemAiProviderModelId ?? '';

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
        configField: SystemConfigFields.SystemAiProviderModelId,
        configValue: value,
      });
      notifications.show({
        id: 'update-system-ai-provider-model',
        title: 'System Model Updated',
        message: 'Model selection updated successfully',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    } catch (error) {
      notifications.show({
        id: 'update-system-ai-provider-model',
        title: 'Failed to Update',
        message: updateSystemConfigError?.message ?? 'An error occurred while updating the system model',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='system-ai-provider-model-config-row'>
      <td colSpan={2}>
        <Grid>
          <Grid.Col span={6}>
            <Group align='center' spacing='sm'>
              <label htmlFor='select-system-ai-provider-model'>Select System AI Provider Model</label>
              <Tooltip label='Set the AI model used in underlying AI processes, such as chat title summarizations and helpful suggestions'>
                <ThemeIcon size='xs'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
            <Select
              id='select-system-ai-provider-model'
              variant='default'
              data={modelOptions}
              value={modelOptions.length > 0 ? defaultValue : null}
              placeholder='No models available'
              onChange={handleModelChange}
              disabled={!modelOptions.length}
              pt='sm'
            />
          </Grid.Col>
        </Grid>
      </td>
    </tr>
  );
};

