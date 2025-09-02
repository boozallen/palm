import Entry from '@/features/chat/components/entries/Entry';
import Markdown from '@/components/content/Markdown';
import type { RetryEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { Button } from '@mantine/core';
import { IconReload } from '@tabler/icons-react';

type RetryEntryProps = Readonly<{
  entry: RetryEntry;
  onRetry: () => void;
}>;

export default function RetryEntry({ entry, onRetry }: RetryEntryProps) {

  const actions = (
    <Button
      variant='default'
      bg='transparent'
      leftIcon={<IconReload stroke={1} />}
      onClick={onRetry}
      style={{ border: 'none' }}
      c='gray.6'
    >
      Retry
    </Button>
  );

  return (
    <Entry id={entry.id} avatar={null} role={MessageRole.Assistant} actions={actions}>
      <Markdown value='Error getting response from AI source'/>
    </Entry>
  );
}
