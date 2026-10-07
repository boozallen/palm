import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import FastAiProviderModelConfigRow from './FastAiProviderModelConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function FastAiProviderModelSelectionTable() {
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
    <Table data-testid='fast-ai-provider-model-selection-table'>
      <thead>
        <tr>
          <th>Fast AI Model</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <FastAiProviderModelConfigRow fastAiProviderModelId={systemConfig.fastAiProviderModelId} />
      </tbody>
    </Table>
  );
}
