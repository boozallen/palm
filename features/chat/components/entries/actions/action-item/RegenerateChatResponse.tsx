import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRefresh } from '@tabler/icons-react';

import RegenerateResponseModal, { suppressRegenerateResponseWarningCookie } from '@/features/chat/components/modals/RegenerateResponseModal';
import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

type RegenerateChatResponseProps = {
  messageId: string;
}
export default function RegenerateChatResponse({
  messageId,
}: RegenerateChatResponseProps) {
  const { modelId } = useChat();
  const { data: availableModels } = useGetAvailableModels();
  const [opened, { open, close }] = useDisclosure();
  const { mutateAsync: regenerateResponse } = useRegenerateResponse(messageId);

  const isDisabled = !availableModels?.availableModels.find((model) => model.id === modelId);

  const tooltipLabel = !isDisabled ?
    'Generate new response' :
    'Unable to generate new response because model is no longer available';

  const handleRegenerateResponse = () => {
    const hideWarningMessage = localStorage
      .getItem(suppressRegenerateResponseWarningCookie)
      ?.toLowerCase()
      ?.trim() === 'true';

    if (hideWarningMessage) {
      regenerateResponse();
    } else {
      open();
    }
  };

  return (
    <Box>
      <RegenerateResponseModal
        modalOpened={opened}
        closeModalHandler={close}
        messageId={messageId}
      />
      <Tooltip
        label={tooltipLabel}
        withArrow
        position='right'
      >
        <Box>
          <ActionIcon
            className='entry-hover-visible'
            onClick={handleRegenerateResponse}
            disabled={isDisabled}
          >
            <IconRefresh stroke={1} aria-label='Retry' />
          </ActionIcon>
        </Box>
      </Tooltip>
    </Box>
  );
}
