import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import SystemAiProviderModelConfigRow from './SystemAiProviderModelConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function SystemAiProviderModelSelectionTable() {
  const {
    data: systemConfig,
    isPending: systemConfigIsPending,
    error: systemConfigError,
  } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='system-ai-provider-model-selection-table'>
      <thead>
        <tr>
          <th colSpan={2}>System AI Provider Model</th>
        </tr>
      </thead>
      <tbody>
        <SystemAiProviderModelConfigRow systemAiProviderModelId={systemConfig.systemAiProviderModelId} />
      </tbody>
    </Table>
  );
}
