import { useState } from 'react';

import useDeleteMessage from '@/features/chat/api/delete-message';
import useUpdateMessage from '@/features/chat/api/update-message';
import useRetryMessage from '@/features/chat/api/retry-message';
import useGetMessages from '@/features/chat/api/get-messages';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { MessageRole } from '@/features/chat/types/message';

/**
 * Custom hook to edit a user message in a chat.
 *
 * This hook provides a function to edit a user message by:
 * 1. Deleting all messages that came after the message being edited (including the assistant response)
 * 2. Updating the user message content with the new text
 * 3. Triggering a retry to generate a new assistant response based on the updated message
 *
 * @param {string} messageId - The id of the message to edit
 *
 * @returns {Object} An object containing:
 * - `mutateAsync`: A function to trigger the edit process.
 * - `isPending`: A boolean indicating if the edit process is currently loading.
 * - `error`: An Error object (or `null` if no error).
 */
export default function useEditMessage(messageId: string): {
  mutateAsync: (newContent: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
} {
  const { chatId, knowledgeBaseIds, documentLibraryEnabled, setEntryBeingEdited } = useChat();
  const { data: messages } = useGetMessages(chatId);
  const { mutateAsync: deleteMessage, isPending: deleteMessageIsPending } = useDeleteMessage();
  const { mutateAsync: updateMessage, isPending: updateMessageIsPending } = useUpdateMessage();
  const { mutateAsync: retryMessage, isPending: retryMessageIsPending } = useRetryMessage();

  const [error, setError] = useState<Error | null>(null);

  const message = messages?.messages.find((msg) => msg.id === messageId);

  async function mutateAsync(newContent: string): Promise<void> {
    setError(null); // Reset error state before attempting again

    if (!chatId || !message || message.role !== MessageRole.User) {
      setError(new Error('We are unable to edit this message at this time'));
      return;
    }

    if (!newContent.trim()) {
      setError(new Error('Message content cannot be empty'));
      return;
    }

    try {
      // Step 1: Find the next message after the one being edited
      const messageIndex = messages?.messages.findIndex((msg) => msg.id === messageId) ?? -1;
      if (messageIndex === -1) {
        setError(new Error('Message not found'));
        return;
      }

      // Step 2: If there are messages after this one, delete them
      const nextMessage = messages?.messages[messageIndex + 1];
      if (nextMessage) {
        await deleteMessage({ chatId, messageId: nextMessage.id });
      }

      // Step 3: Update the message content
      await updateMessage({ messageId: message.id, content: newContent });
      setEntryBeingEdited(null);

      // Step 4: Trigger retry to generate new assistant response
      await retryMessage({
        chatId,
        knowledgeBaseIds,
        documentLibraryEnabled,
      });
    } catch (error) {
      setError(new Error('There was a problem editing the message'));
    }
  }

  return {
    mutateAsync,
    isPending: deleteMessageIsPending || updateMessageIsPending || retryMessageIsPending,
    error,
  };
}
