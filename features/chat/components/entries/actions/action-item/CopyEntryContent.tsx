import { ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

type CopyEntryContentProps = Readonly<{
  messageContent: string;
}>;

export default function CopyEntryContent({ messageContent }: CopyEntryContentProps) {

  return (
    <CopyButton value={messageContent} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Message Copied' : 'Copy Message'} withArrow position='right'>
          <ActionIcon
            data-testid='copy-button'
            className='entry-hover-visible'
            color={copied ? 'teal' : 'gray'}
            onClick={copy}
          >
            {copied ? <IconCheck stroke={1} /> : <IconCopy aria-label='Copy' stroke={1} data-testid='copy-icon' />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );

}
