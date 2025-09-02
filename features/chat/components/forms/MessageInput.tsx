import React from 'react';
import { ActionIcon, Center, Flex, Textarea, Box } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { IconArrowNarrowRight } from '@tabler/icons-react';

import { ChatFormValues } from '@/features/chat/components/forms/ChatForm';
import { ModelUnavailableToolTip } from '@/features/shared/components/forms/ModelUnavailableToolTip';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useChat } from '@/features/chat/providers/ChatProvider';
import SelectedTextComponent from '@/features/chat/components/entries/elements/SelectedText';

type MessageInputProps = Readonly<{
  form: UseFormReturnType<ChatFormValues>;
  isDisabled: boolean;
  isPending: boolean;
  handleSubmit: () => void;
}>;

export default function MessageInput({
  form,
  isDisabled,
  isPending,
  handleSubmit,
}: MessageInputProps) {
  const { data: models, isPending: modelsIsPending } = useGetAvailableModels(); // TODO: make endpoint for getting just one model
  const { modelId, chatId, selectedArtifact, selectedText, setSelectedText } = useChat();

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSubmitDisabled) {
      e.preventDefault();
      handleSubmit();
    }
  };

  let isModelSelected = !!modelId;
  let tooltipMessage = '';

  // Determine the tooltip message based on the current state of the chat
  if (chatId === null) {
    if (models?.availableModels.length === 0) {
      tooltipMessage =
        'There are currently no large language models available to chat with.';
      isModelSelected = false;
    } else if (!modelId) {
      tooltipMessage = 'Please select a model to start a new chat.';
      isModelSelected = false;
    }
  } else if (!modelId || !models?.availableModels.find((m) => m.id === modelId)) {
    tooltipMessage =
      'The model used for this chat is no longer available. Please begin a new chat.';
    isModelSelected = false;
  }

  const isSubmitDisabled =
    isDisabled || !isModelSelected || form.values.message === '';
  const isTooltipDisabled =
    (!isDisabled && isModelSelected) || tooltipMessage === '';
  const isInputDisabled = modelsIsPending || !models?.availableModels.length;

  return (
    <Box
      py='md'
      px={selectedArtifact ? 'md' : 'lg'}
      w='100%'
      bg='dark.5'
      style={{
        ...(selectedArtifact && {
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }),
      }}
    >
      {selectedText && (
        <Box>
          <SelectedTextComponent
            selectedText={selectedText}
            onRemove={() => setSelectedText(null)}
          />
        </Box>
      )}
      <Flex
        justify='center'
        align='end'
        gap='sm'
      >
        <Center w='100%'>
          <Textarea
            aria-label='Write message here'
            data-testid='chat-input-textarea'
            placeholder='Type something here...'
            mb='0'
            p='md'
            pl={0}
            w='100%'
            radius='md'
            {...form.getInputProps('message')}
            onKeyDown={onKeyDown}
            autosize
            minRows={1}
            maxRows={8}
            styles={(theme) => ({
              input: {
                border: `1px solid ${theme.colors.dark[1]}`,
                padding: `${theme.spacing.md}!important`,
              },
            })}
            disabled={isInputDisabled}
          />
          <ModelUnavailableToolTip
            message={tooltipMessage}
            disabled={isTooltipDisabled}
          >
            <ActionIcon
              aria-label='Send message'
              variant='filled'
              radius='md'
              size={50}
              color='blue.6'
              disabled={isSubmitDisabled}
              onClick={handleSubmit}
              loading={isPending}
            >
              <IconArrowNarrowRight color='#2E2F34' size={50} stroke={1} />
            </ActionIcon>
          </ModelUnavailableToolTip>
        </Center>
      </Flex>
    </Box>
  );
}
