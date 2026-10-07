import { Box, Group, Text, Badge, UnstyledButton, ThemeIcon } from '@mantine/core';

import { ToolResult } from '@/features/chat/types/agent-trace';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { useChat } from '@/features/chat/providers/ChatProvider';

type EditArtifactResultRowProps = Readonly<{
  results: ToolResult[];
  diffStat?: { added: number; removed: number };
}>;

type ArtifactFileBadgeProps = Readonly<{
  result: ToolResult;
  diffStat?: { added: number; removed: number };
}>;

export function ArtifactFileBadge({ result, diffStat }: ArtifactFileBadgeProps) {
  const { setSelectedArtifact } = useChat();
  const { color, icon: Icon } = getFileTypeConfig(result.title ?? '');

  return (
    <Group spacing={6} noWrap sx={{ minWidth: 0, overflow: 'hidden' }}>
      <ThemeIcon size={14} c={color} variant='transparent' style={{ pointerEvents: 'none', flexShrink: 0 }}>
        <Icon size={14} stroke={2} />
      </ThemeIcon>
      <UnstyledButton
        onClick={() => result.artifact && setSelectedArtifact(result.artifact)}
        disabled={!result.artifact}
        data-testid='artifact-filename'
        sx={{ minWidth: 0, overflow: 'hidden' }}
      >
        <Text
          size='xs'
          c='gray.4'
          td={result.artifact ? 'underline' : undefined}
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {result.title}
        </Text>
      </UnstyledButton>
      {!!diffStat?.added && (
        <Badge size='xs' variant='filled' bg='green.9' c='green.1' fw={700} tt='none'>
          +{diffStat.added}
        </Badge>
      )}
      {!!diffStat?.removed && (
        <Badge size='xs' variant='filled' bg='red.9' c='red.1' fw={700} tt='none'>
          -{diffStat.removed}
        </Badge>
      )}
    </Group>
  );
}

export default function EditArtifactResultRow({ results, diffStat }: EditArtifactResultRowProps) {
  return (
    <Box mt={4}>
      {results.map((result, index) => (
        <ArtifactFileBadge key={index} result={result} diffStat={diffStat} />
      ))}
    </Box>
  );
}
