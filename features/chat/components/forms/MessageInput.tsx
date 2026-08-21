import React, { useEffect, useRef } from 'react';
import { Center, Flex, Textarea, Box } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { ChatFormValues } from '@/features/chat/components/forms/ChatForm';
import { InputTooltip } from '@/features/shared/components/forms/InputTooltip';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useChat } from '@/features/chat/providers/ChatProvider';
import SelectedTextComponent from '@/features/chat/components/entries/elements/SelectedText';
import { trpc } from '@/libs';
import { DeepResearchStatus } from '@/features/chat/types/message';

type MessageInputProps = Readonly<{
  form: UseFormReturnType<ChatFormValues>;
  isDisabled: boolean;
  handleSubmit: () => void;
}>;

export default function MessageInput({
  form,
  isDisabled,
  handleSubmit,
}: MessageInputProps) {
  const { data: models, isPending: modelsIsPending } = useGetAvailableModels();
  const { modelId, chatId, selectedText, setSelectedText, isLastMessageRetry, setHasUserInteracted, setMessageInputHasText } = useChat();
  const AGENT_PROVIDER_PREFIX = 'agent-provider::';
  const isAgentProviderSelected = typeof modelId === 'string' && modelId.startsWith(AGENT_PROVIDER_PREFIX);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messagesData } = trpc.chat.getMessages.useQuery(
    { chatId: chatId || '' },
    { enabled: !!chatId }
  );

  const runningDeepResearchMessage = messagesData?.messages?.find(
    msg => {
      if (!msg.deepResearch) {
        return false;
      }

      const status = msg.deepResearchStatus;
      return status === DeepResearchStatus.PENDING ||
             status === null ||
             status === undefined;
    }
  );

  const isInputDisabled = modelsIsPending || (!models?.availableModels.length && !isAgentProviderSelected) || isLastMessageRetry;

  useEffect(() => {
    if (!isInputDisabled) {
      textareaRef.current?.focus();
    }
  }, [isInputDisabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.getInputProps('message').onChange(e);
    const hasText = e.target.value.length > 0;
    setMessageInputHasText(hasText);
    if (hasText) {
      setHasUserInteracted(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isDisabled && !runningDeepResearchMessage && form.values.message !== '') {
      e.preventDefault();
      handleSubmit();
    }
  };

  let isModelSelected = !!modelId;
  let tooltipMessage = '';

  if (isLastMessageRetry) {
    tooltipMessage = 'An unexpected error occurred. Please retry the last message to continue.';
  } else if (chatId === null) {
    if (models?.availableModels.length === 0 && !isAgentProviderSelected) {
      tooltipMessage =
        'There are currently no large language models available to chat with.';
      isModelSelected = false;
    } else if (!modelId) {
      tooltipMessage = 'Please select a model to start a new chat.';
      isModelSelected = false;
    }
  } else if (!isAgentProviderSelected && (!modelId || !models?.availableModels.find((m) => m.id === modelId))) {
    tooltipMessage =
      'The model used for this chat is no longer available. Please begin a new chat.';
    isModelSelected = false;
  }

  const isTooltipDisabled =
    (!isDisabled && isModelSelected) || tooltipMessage === '';

  return (
    <Box
      w='100%'
      bg='dark.5'
      px='md'
      py='sm'
      style={{
        position: 'relative',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
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
          <InputTooltip
            message={tooltipMessage}
            disabled={isTooltipDisabled}
          >
            <Textarea
              ref={textareaRef}
              variant='unstyled'
              data-testid='chat-input-textarea'
              aria-label={chatId ? 'Continue conversation...' : 'How can I help you?'}
              placeholder={chatId ? 'Continue conversation...' : 'How can I help you?'}
              mb='0'
              py='xs'
              w='100%'
              radius='md'
              value={form.values.message}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              autosize
              minRows={1}
              maxRows={8}
              styles={(theme) => ({
                input: {
                  color: theme.colors.gray[6],
                  '&::placeholder': {
                    color: theme.colors.gray[6],
                  },
                  '&:disabled': {
                    padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
                  },
                },
              })}
              disabled={isInputDisabled}
            />
          </InputTooltip>
        </Center>
      </Flex>
    </Box>
  );
}
