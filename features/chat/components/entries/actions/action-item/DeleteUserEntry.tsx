import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { useRemoveMessageModal } from '@/features/chat/modals/useRemoveMessageModal';
import { useChat } from '@/features/chat/providers/ChatProvider';

type DeleteUserEntryProps = Readonly<{
  entryId: string;
}>;

export function DeleteUserEntry({ entryId }: DeleteUserEntryProps) {
  const { chatId } = useChat();
  const { removeMessage } = useRemoveMessageModal(chatId ?? '');

  const handleDelete = () => {
    removeMessage(entryId);
  };

  return (
    <Tooltip label='Delete Message' withArrow position='right'>
      <ActionIcon
        className='entry-hover-visible'
        onClick={handleDelete}
      >
        <IconTrash
          stroke={1}
          aria-label='Delete Message'
        />
      </ActionIcon>
    </Tooltip>
  );
}
