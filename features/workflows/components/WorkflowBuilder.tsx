/**
 * WorkflowBuilder
 */

import { Box, Group } from '@mantine/core';
import PrimitivePalette from '@/features/workflows/components/PrimitivePalette';
import Canvas from '@/features/workflows/components/Canvas';
import SimpleView from '@/features/workflows/components/SimpleView';

export type WorkflowViewMode = 'canvas' | 'simple';

interface WorkflowBuilderProps {
  workflowId?: string;
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
  executionPanel?: React.ReactNode;
  generatorPanel?: React.ReactNode;
  viewMode?: WorkflowViewMode;
  executionTrace?: Array<{ primitiveId: string; status: string }>;
  isExecuting?: boolean;
}

export default function WorkflowBuilder({ workflowId, onSaveNodeConfig, executionPanel, generatorPanel, viewMode = 'canvas', executionTrace, isExecuting }: WorkflowBuilderProps) {
  return (
    <Box
      bg='dark.5'
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        flexGrow: 1,
        border: '1px solid var(--mantine-color-dark-3)',
        boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.6), 0 4px 16px -2px rgba(0, 0, 0, 0.4), 0 2px 8px -1px rgba(0, 0, 0, 0.3)',
        position: 'relative',
      }}
    >
      <Group spacing={0} style={{ height: '100%' }} align='stretch'>
        {viewMode === 'canvas' && <PrimitivePalette />}
        <Box style={{
          flex: 1,
          position: 'relative',
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderLeft: viewMode === 'canvas' ? '1px solid var(--mantine-color-dark-4)' : 'none',
        }}>
          {viewMode === 'canvas' ? (
            <Canvas
              workflowId={workflowId}
              onSaveNodeConfig={onSaveNodeConfig}
              executionTrace={executionTrace}
              isExecuting={isExecuting}
            />
          ) : (
            <SimpleView
              workflowId={workflowId}
              onSaveNodeConfig={onSaveNodeConfig}
            />
          )}
        </Box>
        {generatorPanel}
        {executionPanel}
      </Group>
    </Box>
  );
}
