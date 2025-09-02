import { useState } from 'react';

import useDeleteMessage from '@/features/chat/api/delete-message';
import useRetryMessage from '@/features/chat/api/retry-message';
import useGetMessages from '@/features/chat/api/get-messages';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { MessageRole } from '@/features/chat/types/message';
import { addRegenerateInstructionsToMessage } from '@/features/chat/utils/chatHelperFunctions';

/**
 * Custom hook to regenerate the message with `messageId` in a chat.
 *
 * This hook provides a function to delete the message with `messageId` and any subsequent messages.
 * It then generates a new response based on the content of the selected message.
 * It handles the state of the regeneration process and ensures that the message has the correct role
 * before attempting to regenerate the response.
 * @param {string} messageId - The id of the message to retry
 *
 * @returns {Object} An object containing:
 * - `mutateAsync`: A function to trigger the regeneration process.
 * - `isLoading`: A boolean indicating if the regeneration process is currently loading.
 * - `error`: An Error object (or `null` if no error).
 */
export default function useRegenerateResponse(messageId: string): {
  mutateAsync: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { chatId, knowledgeBaseIds, setRegeneratingResponse, documentLibraryEnabled } = useChat();
  const { data: messages } = useGetMessages(chatId);
  const { mutateAsync: deleteMessage, isPending: deleteMessageIsPending } = useDeleteMessage();
  const { mutateAsync: retryMessage, isPending: retryMessageIsPending } = useRetryMessage();

  const [error, setError] = useState<Error | null>(null);

  const message = messages?.messages.find((msg) => msg.id === messageId);

  async function mutateAsync(): Promise<void> {
    setError(null); // Reset error state before attempting again

    if (!chatId || !message || message.role !== MessageRole.Assistant) {
      setError(new Error('We are unable to regenerate the response at this time'));
      return;
    }

    const prompt = addRegenerateInstructionsToMessage(message.content);

    try {
      setRegeneratingResponse(true);
      await deleteMessage({ chatId, messageId });
      await retryMessage({ chatId, customInstructions: prompt, knowledgeBaseIds, documentLibraryEnabled });
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
