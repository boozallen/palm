import { ActionIcon, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';

type EditUserEntryProps = Readonly<{
  entryId: string;
}>

export function EditUserEntry({ entryId }: EditUserEntryProps) {
  const { setEntryBeingEdited } = useChat();

  return (
    <Tooltip label='Edit Message' withArrow position='right'>
      <ActionIcon
        className='entry-hover-visible'
        onClick={() => setEntryBeingEdited(entryId)}
      >
        <IconPencil
          stroke={1}
          aria-label='Edit your message'
        />
      </ActionIcon>
    </Tooltip>
  );
}
