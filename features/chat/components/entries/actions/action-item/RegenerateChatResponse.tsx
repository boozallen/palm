import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';

export default function RegenerateChatResponse() {
  const { mutateAsync: regenerateResponse } = useRegenerateResponse();

  return (
    <Tooltip
      label='Generate new response'
      withArrow
      position='right'
    >
      <ActionIcon
        className='entry-hover-visible'
        onClick={regenerateResponse}
      >
        <IconRefresh stroke={1} aria-label='Retry' />
      </ActionIcon>
    </Tooltip>
  );
}
