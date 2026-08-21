import { Stack, ThemeIcon, Tooltip, Box, Indicator } from '@mantine/core';

import { getSourceConfig } from '@/features/chat/utils/chatHelperFunctions';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import GraphingStatusPopover from './GraphingStatusPopover';
import { ActiveGraphBuildClient } from '@/features/graph-database/dal/getActiveGraphBuilds';

interface SelectedSource {
  id: string;
  label: string;
  type: 'knowledge-base' | 'document';
}

interface CollapsedSourcesListProps {
  selectedSources: SelectedSource[];
  onSourceClick?: (sourceId: string, sourceType: 'knowledge-base' | 'document') => void;
  graphedSourceIds?: string[];
  ungraphableSourceIds?: string[];
  graphingSourceIds?: string[];
  useGraph?: boolean;
}

export default function CollapsedSourcesList({ selectedSources, onSourceClick, graphedSourceIds = [], ungraphableSourceIds = [], graphingSourceIds = [], useGraph = false }: CollapsedSourcesListProps) {
  const { data: userGraphDatabaseAccess } = useGetUserGraphDatabaseAccess();
  const { data: activeGraphBuilds } = useGetActiveGraphBuilds();
  const { data: systemConfig } = useGetSystemConfig();

  // Helper to get graph build info for a document. Use newDocumentIds (the
  // job's processing subset) with a fallback to the full documentIds union,
  // matching ExpandedSourcesList so the popover attaches to the doc actually
  // being processed.
  const getGraphBuildInfo = (documentId: string): ActiveGraphBuildClient | null => {
    if (!activeGraphBuilds) {
      return null;
    }
    return activeGraphBuilds.find(build => (build.newDocumentIds ?? build.documentIds).includes(documentId)) || null;
  };

  return (
    <Stack spacing='md' align='center'>
      {selectedSources.map((source) => {
        const { color, icon: Icon } = getSourceConfig(source);
        const hasGraphAccess = userGraphDatabaseAccess?.hasAccess ?? false;
        const isGraphed = hasGraphAccess && graphedSourceIds.includes(source.id);
        const isUngraphable = hasGraphAccess && ungraphableSourceIds.includes(source.id);
        const isGraphing = hasGraphAccess && graphingSourceIds.includes(source.id);
        const showNotGraphedWarning = !isGraphed && !isUngraphable && !isGraphing && useGraph && hasGraphAccess;
        const showGraphingIndicator = isGraphing;
        const showUngraphableIndicator = isUngraphable && useGraph;

        const buildInfo = getGraphBuildInfo(source.id);
        const indicatorColor = showGraphingIndicator ? 'yellow' : showUngraphableIndicator ? 'gray' : 'red';
        const showIndicator = showNotGraphedWarning || showGraphingIndicator || showUngraphableIndicator;

        const iconElement = (
          <Box>
            <Indicator
              disabled={!showIndicator}
              color={indicatorColor}
              size={10}
              offset={4}
              position='top-end'
            >
              <ThemeIcon
                size='md'
                c={color}
                style={{ cursor: 'pointer' }}
                onClick={() => onSourceClick?.(source.id, source.type)}
              >
                <Icon stroke={1.5} />
              </ThemeIcon>
            </Indicator>
          </Box>
        );

        // Use popover for graphing state, tooltip for others
        if (isGraphing) {
          return (
            <GraphingStatusPopover
              key={source.id}
              buildInfo={buildInfo}
              entityResolutionEnabled={systemConfig?.knowledgeGraphEntityResolutionEnabled ?? false}
            >
              {iconElement}
            </GraphingStatusPopover>
          );
        }

        const tooltipLabel = isUngraphable
          ? 'This source cannot be added to the knowledge graph.'
          : showNotGraphedWarning
          ? 'This source is not in your knowledge graph. Regenerate the graph to include it.'
          : source.label;

        return (
          <Tooltip
            key={source.id}
            label={tooltipLabel}
            position='right'
            multiline
          >
            {iconElement}
          </Tooltip>
        );
      })}
    </Stack>
  );
}
