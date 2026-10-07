import {
  Stack,
  Group,
  Text,
  Badge,
  Box,
  ScrollArea,
  Button,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconEye, IconChevronRight, IconPin, IconPinFilled, IconSquareCheck, IconSquare } from '@tabler/icons-react';

import { GraphNode, GraphEdge } from './GraphVisualization';

// Resolved document chrome for a node/edge — computed by the parent (which owns the
// document color/name maps) and passed in so this component stays purely presentational.
export interface GraphElementDocumentInfo {
  name: string;
  color: string;
  borderColor: string;
}

interface GraphElementDetailProps {
  kind: 'node' | 'edge';
  node?: GraphNode | null;
  edge?: GraphEdge | null;
  graphNodes: GraphNode[];
  documentInfo?: GraphElementDocumentInfo | null;
  onViewSource?: () => void;
  onCollapse?: () => void;
  /** Whether the element shown is the pinned one (card stays open through selection changes). */
  pinned?: boolean;
  /** Toggle the pin on the element shown. When provided, a 📌 button renders in the header. */
  onTogglePin?: () => void;
  /** Whether the element shown is in the selection set (from any source — table, Select all, this card). */
  selected?: boolean;
  /** Toggle the element shown in/out of the selection set. When provided, a "Selected" button renders. */
  onToggleSelected?: () => void;
}

// Property keys that are internal plumbing and should not be surfaced in the detail view.
const NODE_PROP_EXCLUDE = [
  'id', 'userId', 'documentId', 'needsEmbedding', 'embeddingId', 'endPosition',
  'startPosition', 'contentNum', 'tokenCount', 'documentUploadProviderId', 'totalTokens',
];
const EDGE_PROP_EXCLUDE = ['id', 'userId', 'documentId', 'chunkId', 'decidedBy', 'phase', 'needsEmbedding'];

const labelBadgeColor = (label: string): string | undefined =>
  label === 'Entity' ? '#96CEB4'
    : label === 'Concept' ? '#45B7D1'
      : label === 'Chunk' ? '#DDA0DD'
        : label === 'Document' ? '#E8A87C'
          : undefined;

const DocumentChip = ({ info }: { info: GraphElementDocumentInfo }) => (
  <Group spacing={6} noWrap pt={6} sx={{ borderTop: '1px solid #2C2E33' }}>
    <Box sx={{ width: 10, height: 10, backgroundColor: info.color, border: `2px solid ${info.borderColor}`, flexShrink: 0 }} />
    <Text size={10} fw={700} color='gray.4' tt='uppercase' lineClamp={1}>{info.name}</Text>
  </Group>
);

const PropertyRow = ({ propKey, value }: { propKey: string; value: unknown }) => (
  <Box pt={6} sx={{ borderTop: '1px solid #2C2E33' }}>
    <Text size={10} fw={700} color='gray.4' tt='uppercase' mb={2}>{propKey}</Text>
    <Text size='xs' color='gray.3' style={{ wordBreak: 'break-word' }}>
      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
    </Text>
  </Box>
);

/**
 * Right-pane detail renderer for a single node OR edge. Docked full-height; the same renderer
 * is driven by hover (transient) and by single-selection (persistent), so reading an element
 * is decoupled from the selection/operation set. Stays pure: the View-Source action is passed
 * down (no useChat coupling) and document chrome is resolved by the parent via documentInfo.
 */
export default function GraphElementDetail({
  kind,
  node,
  edge,
  graphNodes,
  documentInfo,
  onViewSource,
  onCollapse,
  pinned,
  onTogglePin,
  selected,
  onToggleSelected,
}: GraphElementDetailProps) {
  if (kind === 'node' && !node) {return null;}
  if (kind === 'edge' && !edge) {return null;}

  const showChunkSource = kind === 'node'
    && !!node?.labels?.includes('Chunk')
    && !!node?.properties?.documentId
    && !!onViewSource;

  return (
    <Stack
      spacing={0}
      w={200}
      bg='dark.6'
      style={{
        borderLeft: '1px solid #2C2E33',
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
      }}
    >
      <Group position='apart' p='sm' bg='dark.5' noWrap>
        <Text size='xs' fw={500} color='gray.3'>
          {kind === 'node' ? 'Node Details' : 'Edge Details'}
        </Text>
        <Group spacing={4} noWrap>
          {onTogglePin && (
            <Tooltip label={pinned ? 'Unpin this card' : 'Pin this card (keeps it open while you select other things)'} position='left' withinPortal>
              <ActionIcon
                size='xs'
                variant={pinned ? 'filled' : 'subtle'}
                color='gray'
                aria-label={pinned ? 'Unpin details' : 'Pin details'}
                onClick={onTogglePin}
              >
                {pinned ? <IconPinFilled size={12} /> : <IconPin size={12} />}
              </ActionIcon>
            </Tooltip>
          )}
          {onCollapse && (
            <Tooltip label='Hide details' position='left' withinPortal>
              <ActionIcon size='xs' variant='subtle' aria-label='Collapse details' onClick={onCollapse}>
                <IconChevronRight size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {onToggleSelected && (
        <Box px='sm' pt='xs'>
          <Tooltip
            label={selected ? 'Remove from selection' : 'Add to selection (for bulk actions like Isolate)'}
            position='left'
            withinPortal
          >
            <Button
              size='xs'
              compact
              aria-pressed={!!selected}
              variant={selected ? 'filled' : 'outline'}
              color='red'
              leftIcon={selected ? <IconSquareCheck size={14} /> : <IconSquare size={14} />}
              onClick={onToggleSelected}
              styles={{ leftIcon: { marginRight: 6 } }}
            >
              {selected ? 'Deselect' : 'Select'}
            </Button>
          </Tooltip>
        </Box>
      )}

      {showChunkSource && (
        <Box px='sm' pt='xs'>
          <Button
            size='xs'
            variant='light'
            color='blue'
            rightIcon={<IconEye size={14} />}
            onClick={onViewSource}
            fullWidth
          >
            View Source
          </Button>
        </Box>
      )}

      <ScrollArea h='100%' px='sm' py='xs'>
        {kind === 'node' && node && (
          <Stack spacing={8}>
            <Group spacing='xs'>
              {node.labels.map((label, index) => (
                <Badge
                  key={index}
                  size='xs'
                  variant='filled'
                  sx={{ backgroundColor: labelBadgeColor(label), color: '#1A1B1E' }}
                >
                  {label}
                </Badge>
              ))}
            </Group>

            {documentInfo && <DocumentChip info={documentInfo} />}

            {node.properties && Object.entries(node.properties)
              .filter(([key]) => !NODE_PROP_EXCLUDE.includes(key))
              .map(([key, value]) => (
                <PropertyRow key={key} propKey={key} value={value} />
              ))}
          </Stack>
        )}

        {kind === 'edge' && edge && (
          <Stack spacing={8}>
            <Group spacing='xs'>
              <Badge size='xs' variant='filled' sx={{ backgroundColor: '#555', color: '#ddd' }}>
                {edge.type}
              </Badge>
            </Group>

            <Box pt={6} sx={{ borderTop: '1px solid #2C2E33' }}>
              <Text size={10} fw={700} color='gray.4' tt='uppercase' mb={2}>from</Text>
              <Text size='xs' color='gray.3'>
                {graphNodes.find(n => n.id === edge.from)?.label || edge.from}
              </Text>
            </Box>

            <Box pt={6} sx={{ borderTop: '1px solid #2C2E33' }}>
              <Text size={10} fw={700} color='gray.4' tt='uppercase' mb={2}>to</Text>
              <Text size='xs' color='gray.3'>
                {graphNodes.find(n => n.id === edge.to)?.label || edge.to}
              </Text>
            </Box>

            {documentInfo && <DocumentChip info={documentInfo} />}

            {edge.properties && Object.entries(edge.properties)
              .filter(([key]) => !EDGE_PROP_EXCLUDE.includes(key))
              .map(([key, value]) => (
                <PropertyRow key={key} propKey={key} value={value} />
              ))}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
}
