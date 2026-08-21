import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import KnowledgeGraphAiProviderModelConfigRow from './KnowledgeGraphAiProviderModelConfigRow';
import FeatureManagementConfigRow from './FeatureManagementConfigRow';
import MemoryConfigRow from './MemoryConfigRow';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

export default function KnowledgeGraphAiProviderModelSelectionTable() {
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
    <Table data-testid='knowledge-graph-ai-provider-model-selection-table'>
      <thead>
        <tr>
          <th>Knowledge Graph (Neo4j)</th>
          <th>Enabled</th>
        </tr>
      </thead>
      <tbody>
        <tr data-testid='graph-process-configurations-section-header'>
          <td colSpan={2}>
            <Text size='xs' fw={700} color='gray.5' sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Graph Process Configurations
            </Text>
          </td>
        </tr>
        <KnowledgeGraphAiProviderModelConfigRow knowledgeGraphAiProviderModelId={systemConfig.knowledgeGraphAiProviderModelId} indent />
        <FeatureManagementConfigRow
          field={SystemConfigFields.KnowledgeGraphEntityResolutionEnabled}
          label='Enable Entity Resolution'
          checked={!!(systemConfig?.knowledgeGraphEntityResolutionEnabled ?? false)}
          indent
        />
        <tr data-testid='system-memory-section-header'>
          <td colSpan={2}>
            <Text size='xs' fw={700} color='gray.5' sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Memory
            </Text>
          </td>
        </tr>
        <MemoryConfigRow checked={!!(systemConfig?.memoryEnabled ?? false)} indent />
      </tbody>
    </Table>
  );
}