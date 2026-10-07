import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconHistory } from '@tabler/icons-react';

import { formatRelativeChatTime } from '@/features/chat/utils/chatHelperFunctions';

export type ArtifactVersionSummary = {
  versionNumber: number;
  content: string;
  createdAt: Date | string;
};

type ArtifactVersionSelectorProps = {
  versions: ArtifactVersionSummary[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onRestore: () => void;
  isRestoring: boolean;
};

const ArtifactVersionSelector = ({
  versions,
  selectedIndex,
  onSelectIndex,
  onRestore,
  isRestoring,
}: ArtifactVersionSelectorProps) => {
  const selected = versions[selectedIndex];
  const isLatest = selectedIndex === versions.length - 1;

  return (
    <Group spacing='sm' noWrap>
      <Group spacing='sm' noWrap>
        <Tooltip label='Previous version' position='bottom'>
          <ActionIcon
            size='sm'
            variant='subtle'
            data-testid='artifact-version-prev'
            disabled={selectedIndex === 0}
            onClick={() => onSelectIndex(selectedIndex - 1)}
          >
            <IconChevronLeft size={16} aria-label='Previous version' />
          </ActionIcon>
        </Tooltip>
        <Group spacing='sm' noWrap data-testid='artifact-version-label'>
          <Text size='sm' sx={(theme) => ({ fontWeight: theme.other.fontWeights.bold })}>
            Version {selected.versionNumber} of {versions.length}
          </Text>
          <Text size='sm' color='dimmed'>{formatRelativeChatTime(selected.createdAt)}</Text>
        </Group>
        <Tooltip label='Next version' position='bottom'>
          <ActionIcon
            size='sm'
            variant='subtle'
            data-testid='artifact-version-next'
            disabled={isLatest}
            onClick={() => onSelectIndex(selectedIndex + 1)}
          >
            <IconChevronRight size={16} aria-label='Next version' />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Button
        size='xs'
        variant='filled'
        color='teal'
        leftIcon={<IconHistory size={14} />}
        data-testid='artifact-version-restore'
        loading={isRestoring}
        disabled={isLatest}
        onClick={onRestore}
        style={{ visibility: isLatest ? 'hidden' : 'visible' }}
      >
        Restore this version
      </Button>
    </Group>
  );
};

export default ArtifactVersionSelector;
