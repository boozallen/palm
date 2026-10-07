import { ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { useChat } from '@/features/chat/providers/ChatProvider';

type CopyEntryContentProps = Readonly<{
  messageContent: string;
  messageId?: string;
}>;

export default function CopyEntryContent({ messageContent, messageId }: CopyEntryContentProps) {
  const { chatId } = useChat();
  const track = useTrackClientEvent();

  return (
    <CopyButton value={messageContent} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Message Copied' : 'Copy Message'} position='right'>
          <ActionIcon
            data-testid='copy-button'
            className='entry-hover-visible'
            color={copied ? 'teal' : 'gray'}
            onClick={() => {
              copy();
              track.copy.chatMessage(messageId, chatId);
            }}
          >
            {copied ? <IconCheck stroke={1} /> : <IconCopy aria-label='Copy' stroke={1} data-testid='copy-icon' />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );

}
