import { useState } from 'react';

import useDeleteMessage from '@/features/chat/api/delete-message';
import useRetryMessage from '@/features/chat/api/retry-message';
import useGetMessages from '@/features/chat/api/get-messages';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { MessageRole } from '@/features/chat/types/message';
import { addRegenerateInstructionsToMessage } from '@/features/chat/utils/chatHelperFunctions';

/**
 * Custom hook to regenerate the last assistant message in a chat.
 *
 * This hook provides a function to delete the last assistant message and retry generating a new response
 * based on the content of the deleted message. It handles the state of the regeneration process and ensures
 * that the last message has the correct role before attempting to regenerate the response.
 *
 * @returns {Object} An object containing:
 * - `mutateAsync`: A function to trigger the regeneration process.
 * - `isLoading`: A boolean indicating if the regeneration process is currently loading.
 * - `error`: An Error object (or `null` if no error).
 */
export default function useRegenerateResponse(): {
  mutateAsync: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { chatId, knowledgeBaseIds, setRegeneratingResponse } = useChat();
  const { data: messages } = useGetMessages(chatId);
  const { mutateAsync: deleteMessage, isPending: deleteMessageIsPending } = useDeleteMessage();
  const { mutateAsync: retryMessage, isPending: retryMessageIsPending } = useRetryMessage();

  const [error, setError] = useState<Error | null>(null);

  const lastAssistantMessage = messages?.messages.length
    ? messages.messages[messages.messages.length - 1]
    : null;

  async function mutateAsync(): Promise<void> {
    setError(null); // Reset error state before attempting again

    if (!chatId || !lastAssistantMessage || lastAssistantMessage.role !== MessageRole.Assistant) {
      setError(new Error('We are unable to regenerate the response at this time'));
      return;
    }

    const prompt = addRegenerateInstructionsToMessage(lastAssistantMessage.content);

    try {
      setRegeneratingResponse(true);
      await deleteMessage({ chatId, messageId: lastAssistantMessage.id });
      await retryMessage({ chatId, customInstructions: prompt, knowledgeBaseIds });
    } catch (error) {
      setError(new Error('There was a problem regenerating the response'));
    } finally {
      setRegeneratingResponse(false);
    }

  };

  return {
    mutateAsync,
    isLoading: deleteMessageIsPending || retryMessageIsPending,
    error,
  };
}
