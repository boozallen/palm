import { useState } from 'react';
import { Box, Text, List, Popover, ThemeIcon, Progress, Button } from '@mantine/core';
import { IconCircleCheckFilled, IconCircleFilled, IconCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import type { ActiveGraphBuildClient } from '@/features/graph-database/dal/getActiveGraphBuilds';
import useCancelGraphBuild from '@/features/graph-database/api/cancel-graph-build';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { trpc } from '@/libs';

interface GraphingStatusPopoverProps {
  buildInfo: ActiveGraphBuildClient | null | undefined;
  entityResolutionEnabled: boolean;
  children: React.ReactElement;
}

export default function GraphingStatusPopover({ buildInfo, entityResolutionEnabled, children }: GraphingStatusPopoverProps) {
  const [opened, setOpened] = useState(false);
  const utils = trpc.useUtils();
  const cancelGraphBuild = useCancelGraphBuild();
  const { setCancelledGraphIds } = useChat();

  if (!buildInfo) {
    return children;
  }

  const isCancelling = buildInfo.status === 'Cancelling';

  const handleCancel = async () => {
    try {
      const result = await cancelGraphBuild.mutateAsync({ graphId: buildInfo.graphId });
      notifications.show({
        title: result.success ? 'Cancellation requested' : 'Cannot cancel',
        message: result.message,
        color: result.success ? 'blue' : 'orange',
      });
      if (result.success) {
        // Marks this graphId so the graphStatus->Completed handler (SourcesSidebar)
        // knows a settle to Completed here was a rollback, not a genuine finish,
        // and skips the "success" tooltip.
        setCancelledGraphIds((prev) => (prev.includes(buildInfo.graphId) ? prev : [...prev, buildInfo.graphId]));
      }
      utils.graph.getActiveGraphBuilds.invalidate();
      // Only refetch graphed-documents once the rollback has actually settled
      // (queued/no-active-job path). For an active-job cancel the worker hasn't
      // rolled back yet — refetching now would race the in-flight extraction and
      // could transiently show a not-yet-rolled-back document as graphed. The
      // existing graphStatus->Completed effect refetches once the row actually
      // settles.
      if (result.settled) {
        utils.graph.getGraphedDocuments.invalidate();
      }
    } catch (error) {
      notifications.show({
        title: 'Cancellation failed',
        message: error instanceof Error ? error.message : 'Failed to cancel graph build',
        color: 'red',
      });
    }
  };

  const totalSteps = entityResolutionEnabled ? 3 : 2;

  // Map currentStep to step number
  const getCurrentStepNumber = (currentStep: string | undefined): number => {
    if (!currentStep) {
      return 1;
    }

    if (currentStep.includes('Processing chunks') || currentStep.includes('Processed')) {
      return 1;
    }

    if (currentStep.includes('resolution')) {
      return 2;
    }

    if (currentStep.includes('Completed')) {
      return entityResolutionEnabled ? 3 : 2;
    }

    return 1;
  };

  const currentStepNumber = getCurrentStepNumber(buildInfo.currentStep);

  // Live chunk-level progress (meaningful during the extraction step only)
  const progressPct =
    buildInfo.progress ??
    (buildInfo.totalChunks
      ? Math.round(((buildInfo.processedChunks ?? 0) / buildInfo.totalChunks) * 100)
      : null);

  const getCurrentFilename = (step: string | undefined): string | null => {
    if (!step) {
      return null;
    }
    const match = step.match(/^(?:Extracting|Processed|Skipped already-extracted)\s+(.+)$/);
    return match ? match[1] : null;
  };
  const currentFilename = currentStepNumber === 1 ? getCurrentFilename(buildInfo.currentStep) : null;

  // Helper to render step indicator icon
  const getStepIndicator = (stepNumber: number) => {
    if (stepNumber < currentStepNumber) {
      // Completed step - green
      return (
        <ThemeIcon size={16} radius='xl' color='green' variant='filled'>
          <IconCircleCheckFilled size={16} />
        </ThemeIcon>
      );
    } else if (stepNumber === currentStepNumber) {
      // Current step - orange
      return (
        <ThemeIcon size={16} radius='xl' color='orange' variant='filled'>
          <IconCircleFilled size={16} />
        </ThemeIcon>
      );
    } else {
      // Pending step - gray outline
      return (
        <ThemeIcon size={16} radius='xl' color='gray' variant='outline'>
          <IconCircle size={16} />
        </ThemeIcon>
      );
    }
  };

  return (
    <div
      onMouseEnter={() => setOpened(true)}
      onMouseLeave={() => setOpened(false)}
    >
      <Popover position='right' withinPortal shadow='md' width={400} opened={opened}>
        <Popover.Target>
          {children}
        </Popover.Target>
      <Popover.Dropdown>
        <Box>
          <Text size='sm' fw={600} mb='xs' color='gray.0'>
            Building Knowledge Graph
          </Text>
          <Text size='xs' color='gray.3' mb='xs'>
            Currently on step {currentStepNumber} of {totalSteps}
            {currentStepNumber === 1 && progressPct != null ? ` · ${progressPct}% complete` : ''}. This may take several hours for large documents.
          </Text>
          <Text size='xs' color='orange.3' mb='sm' fw={500}>
            Files are locked to prevent conflicts during processing.
          </Text>
          <Button
            size='xs'
            variant='outline'
            color='red'
            fullWidth
            mb='sm'
            loading={cancelGraphBuild.isPending}
            disabled={isCancelling}
            onClick={handleCancel}
          >
            {isCancelling ? 'Cancelling...' : 'Cancel build'}
          </Button>
          <List size='xs' spacing='md' listStyleType='none'>
            <List.Item
              icon={getStepIndicator(1)}
            >
              <Text size='xs' fw={currentStepNumber === 1 ? 600 : 400} mb={4} color='gray.1'>
                Step 1: Reading and processing content
              </Text>
              {currentStepNumber === 1 && buildInfo.totalChunks != null && buildInfo.totalChunks > 0 && (
                <Box pl='md' mb={6}>
                  <Progress value={progressPct ?? 0} size='sm' radius='xl' color='cyan' mb={4} />
                  <Text size='xs' color='gray.3'>
                    {buildInfo.processedChunks ?? 0} / {buildInfo.totalChunks} chunks
                  </Text>
                  {currentFilename && (
                    <Text size='xs' color='gray.4'>
                      Now extracting: {currentFilename}
                    </Text>
                  )}
                </Box>
              )}
              <Text size='xs' color='gray.4' pl='md' mb={2}>
                • Document split into chunks and analyzed with AI
              </Text>
              <Text size='xs' color='gray.4' pl='md'>
                • Entities and relationships are extracted
              </Text>
            </List.Item>
            {entityResolutionEnabled && (
              <List.Item
                icon={getStepIndicator(2)}
              >
                <Text size='xs' fw={currentStepNumber === 2 ? 600 : 400} mb={4} color='gray.1'>
                  Step 2: Entity resolution
                </Text>
                <Text size='xs' color='gray.4' pl='md' mb={2}>
                  • Duplicate entities are merged
                </Text>
                <Text size='xs' color='gray.4' pl='md'>
                  • Cross-references established across documents
                </Text>
              </List.Item>
            )}
            <List.Item
              icon={getStepIndicator(totalSteps)}
            >
              <Text size='xs' fw={currentStepNumber === totalSteps ? 600 : 400} mb={4} color='gray.1'>
                Step {totalSteps}: Finalizing
              </Text>
              <Text size='xs' color='gray.4' pl='md' mb={2}>
                • Database indexed for fast queries
              </Text>
              <Text size='xs' color='gray.4' pl='md'>
                • Graph validated and unlocked
              </Text>
            </List.Item>
          </List>
        </Box>
      </Popover.Dropdown>
    </Popover>
    </div>
  );
}
