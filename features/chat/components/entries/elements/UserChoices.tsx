import { Box, Group, Stack, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheckbox, IconPlus, IconX } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useAddMessage from '@/features/chat/api/add-message';
import { ChatMessageUserChoice } from '@/features/chat/types/message';
import useGraphSnapshotPayload from '@/features/chat/hooks/useGraphSnapshotPayload';

type UserChoicesProps = Readonly<{
  userChoices?: ChatMessageUserChoice[];
}>;

export default function UserChoices({ userChoices }: UserChoicesProps) {
  const {
    chatId,
    modelId,
    pendingMessage,
    setPendingMessage,
    knowledgeBaseIds,
    documentIds,
    useGraph,
  } = useChat();

  const {
    mutateAsync: addMessage,
    isPending: addMessageIsPending,
  } = useAddMessage();
  const graphSnapshot = useGraphSnapshotPayload();

  const handleChoiceClick = async (choice: ChatMessageUserChoice) => {
    // Don't submit if there's already a pending message or no model
    if (pendingMessage !== null || modelId === null) {
      return;
    }

    try {
      // Set pending message to show loading state
      const message = `${choice.label}: ${choice.value}`;
      setPendingMessage(message);

      // There should be a chatId already established
      if (!chatId) {
        return;
      }

      // Add the message
      const addedMessages = await addMessage({
        chatId,
        message,
        knowledgeBaseIds,
        documentIds,
        useGraph,
        ...(graphSnapshot ? { graphSnapshot } : {}),
      });

      if (addedMessages.failedKbs?.length) {
        notifications.show({
          title: 'Some Knowledge Bases Could Not Be Accessed',
          message: 'The following knowledge bases could not be accessed: ' + addedMessages.failedKbs.join(', '),
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        });
      }

      // Remove pending message
      setPendingMessage(null);
    } catch (error) {
      notifications.show({
        title: 'Failed to Add Message to Chat',
        message: 'An unexpected error occurred. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
      setPendingMessage(null);
    }
  };

  const isDisabled =
    addMessageIsPending ||
    modelId === null ||
    pendingMessage !== null;

  if (!userChoices?.length) {
    return null;
  }

  return (
    <Box px='xl' pb='md'>
      <Group spacing='sm' mb='md'>
        <ThemeIcon variant='noHover'>
          <IconCheckbox />
        </ThemeIcon>
        <Title order={2}>Selected Options:</Title>
      </Group>
      <Stack spacing='0'>
        {userChoices.map((choice) => (
          <UnstyledButton
            key={choice.id}
            variant='follow_up_question'
            disabled={isDisabled}
            onClick={() => handleChoiceClick(choice)}
          >
            <Group position='apart' noWrap>
              <Group spacing='sm' noWrap>
                <Box
                  sx={(theme) => ({
                    fontSize: theme.fontSizes.sm,
                    color: theme.colors.gray[6],
                    fontWeight: 600,
                  })}
                >
                  {choice.label}:
                </Box>
                <Box
                  sx={(theme) => ({
                    fontSize: theme.fontSizes.sm,
                    color: theme.colors.gray[5],
                  })}
                >
                  {choice.value}
                </Box>
              </Group>
              <ThemeIcon size='sm' variant='no_hover'>
                <IconPlus />
              </ThemeIcon>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Box>
  );
}
