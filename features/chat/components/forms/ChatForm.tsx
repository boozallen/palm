import { useEffect, useRef } from 'react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';
import { IconX } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { generateUrl } from '@/features/chat/utils/chatHelperFunctions';
import MessageInput from '@/features/chat/components/forms/MessageInput';
import useCreateChat from '@/features/chat/api/create-chat';
import useAddMessage from '@/features/chat/api/add-message';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';

export type ChatFormValues = {
  message: string;
};

export default function ChatForm() {
  const createChat = useCreateChat();
  const {
    chatId,
    modelId,
    promptId,
    setChatId,
    pendingMessage,
    setPendingMessage,
    isLastMessageRetry,
    knowledgeBaseIds,
    documentLibraryEnabled,
    systemMessage,
  } = useChat();

  const addMessage = useAddMessage();

  const promptQry = useGetOriginPrompt(promptId);
  const updateChatConversationSummary = useUpdateChatConversationSummary();

  const initialValues: ChatFormValues = {
    message: '',
  };

  const form = useForm<ChatFormValues>({
    initialValues,
  });

  // prefill text input with origin prompt 'example'
  useEffect(() => {
    if (!promptQry.isPending && promptQry.isFetched && promptQry.data) {
      // only prefill text input if it is the beginning of a chat
      if (chatId === null) {
        form.setValues({ message: promptQry.data.prompt.example });
      }
    }
  }, [promptQry.isPending, promptQry.isFetched, promptQry.data]);

  const formRef = useRef<HTMLFormElement | null>(null);

  const router = useRouter();

  // reset form if starting a new conversation before initializing current conversation
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url === '/chat') {
        form.reset();
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events]);

  const onSubmit = async (values: ChatFormValues) => {
    const message = values.message.trim();
    form.reset();

    try {
      // Don't submit if the modelId is null
      if (modelId === null) {
        return;
      }
      // createPendingMessage
      setPendingMessage(message);

      let chatIdToUse = chatId ?? '';
      // if chatId === null create the chat
      if (chatId === null) {
        // createChat
        const chat = await createChat.mutateAsync({
          modelId,
          promptId,
          systemMessage: systemMessage,
        });
        chatIdToUse = chat.chat.id;
      }

      // createMessage
      const addedMessages = await addMessage
        .mutateAsync({
          chatId: chatIdToUse,
          message: message,
          knowledgeBaseIds,
          documentLibraryEnabled,
        }).then((result) => {
          // additional logic for a new chat
          if (chatId === null) {
            // generate chat summary in background
            updateChatConversationSummary.mutate({ ...result });

            setChatId(chatIdToUse);
          }

          const url = generateUrl(
            chatIdToUse,
            knowledgeBaseIds,
            documentLibraryEnabled,
            promptQry?.data?.prompt.title
          );
          
          router.replace(url, undefined, {
            shallow: true,
          });
                
          return result;
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
      // removePendingMessage
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
    }
  };

  const handleSubmit = async () => {
    await onSubmit(form.values);
  };

  const isPending = createChat.isPending || addMessage.isPending;
  // if isLastMessageRetry is true, an error has occurred getting a response from the AI source
  const isDisabled =
    isPending ||
    modelId === null ||
    pendingMessage !== null ||
    isLastMessageRetry;

  return (
    <form onSubmit={form.onSubmit(onSubmit)} ref={formRef}>
      <MessageInput
        form={form}
        handleSubmit={handleSubmit}
        isPending={isPending}
        isDisabled={isDisabled}
      />
    </form>
  );
}
