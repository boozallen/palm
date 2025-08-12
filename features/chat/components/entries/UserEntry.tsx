import Entry from '@/features/chat/components/entries/Entry';
import { UserAvatar } from '@/features/chat/components/entries/elements/Avatars';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { IconTrash } from '@tabler/icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';

type UserEntryProps = Readonly<{
  entry: MessageEntry;
  onDelete: (_id: string) => void;
}>;

export default function UserEntry({ entry, onDelete }: UserEntryProps) {
  const actions = (
    <Tooltip label='Delete Message' withArrow position='right'>
      <ActionIcon
        className='entry-hover-visible'
        onClick={() => onDelete(entry.id)}
      >
        <IconTrash
          stroke={1}
          data-testid='icon-trash'
          aria-label='Delete'
        />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Entry id={entry.id} avatar={<UserAvatar />} role={MessageRole.User} actions={actions}>
      <pre className='user-entry-content'>
        {entry.content}
      </pre>
    </Entry>
  );
}
