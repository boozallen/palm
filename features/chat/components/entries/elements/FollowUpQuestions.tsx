import { Box, Group, Stack, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMessage2Question, IconPlus, IconX } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useAddMessage from '@/features/chat/api/add-message';
import { ChatMessageFollowUp } from '@/features/chat/types/message';

type FollowUpQuestionsProps = Readonly<{
  followUpQuestions?: ChatMessageFollowUp[];
}>;

export default function FollowUpQuestions({ followUpQuestions }: FollowUpQuestionsProps) {
  const {
    chatId,
    modelId,
    pendingMessage,
    setPendingMessage,
    knowledgeBaseIds,
    documentLibraryEnabled,
  } = useChat();

  const {
    mutateAsync: addMessage,
    isPending: addMessageIsPending,
  } = useAddMessage();

  const handleQuestionClick = async (question: string) => {
    // Don't submit if there's already a pending message or no model
    if (pendingMessage !== null || modelId === null) {
      return;
    }

    try {
      // Set pending message to show loading state
      setPendingMessage(question);

      // There should be a chatId already established
      // if user is following up on an existing thread
      if (!chatId) {
        return;
      }

      // Add the message
      const addedMessages = await addMessage({
        chatId,
        message: question,
        knowledgeBaseIds,
        documentLibraryEnabled,
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

  if (!followUpQuestions?.length) {
    return null;
  }

  return (
    <Box px='xl' pb='md'>
      <Group spacing='sm' mb='md'>
        <ThemeIcon variant='noHover'>
          <IconMessage2Question />
        </ThemeIcon>
        <Title order={2}>Follow Up Questions:</Title>
      </Group>
      <Stack spacing='0'>
      {followUpQuestions.map((question) => (
          <UnstyledButton
            key={question.id}
            variant='follow_up_question'
            disabled={isDisabled}
            onClick={() => handleQuestionClick(question.content)}
          >
            <Group position='apart' noWrap>
              {question.content}
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
