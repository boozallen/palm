import { Group, Text, Tooltip } from '@mantine/core';
import { IconBookmark, IconMessageCircle } from '@tabler/icons-react';
import { PromptStats } from '@/features/shared/types/prompt';

type PromptStatsBadgesProps = {
  stats: PromptStats;
};

export default function PromptStatsBadges({ stats }: PromptStatsBadgesProps) {
  const { bookmarkCount, usageCount } = stats;

  // Only show stats if they have positive values
  if (bookmarkCount === 0 && usageCount === 0) {
    return null;
  }

  return (
    <Group spacing='md'>
      {bookmarkCount > 0 && (
        <Tooltip label={`Bookmarked by ${bookmarkCount} ${bookmarkCount === 1 ? 'user' : 'users'}`}>
          <Group spacing='4px' style={{ cursor: 'default' }}>
            <IconBookmark size={16} />
            <Text size='xs'>{bookmarkCount}</Text>
          </Group>
        </Tooltip>
      )}
      {usageCount > 0 && (
        <Tooltip label={`Chatted with ${usageCount} ${usageCount === 1 ? 'time' : 'times'}`}>
          <Group spacing='4px' style={{ cursor: 'default' }}>
            <IconMessageCircle size={16} />
            <Text size='xs'>{usageCount}</Text>
          </Group>
        </Tooltip>
      )}
    </Group>
  );
}
