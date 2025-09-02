import { act, renderHook } from '@testing-library/react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { Message, MessageRole } from '@/features/chat/types/message';
import useGetMessages from '@/features/chat/api/get-messages';
import useDeleteMessage from '@/features/chat/api/delete-message';
import useUpdateMessage from '@/features/chat/api/update-message';
import useRetryMessage from '@/features/chat/api/retry-message';
import useEditMessage from './useEditMessage';

jest.mock('@/features/chat/api/delete-message');
jest.mock('@/features/chat/api/update-message');
jest.mock('@/features/chat/api/retry-message');
jest.mock('@/features/chat/api/get-messages');
jest.mock('@/features/chat/providers/ChatProvider');

/* START MOCK CHAT PROVIDER */
type ChatProviderStub = {
  chatId: string | null;
  knowledgeBaseIds: string[];
  documentLibraryEnabled: boolean;
  setEntryBeingEdited: (value: any) => void;
}

const createChatProviderStub = (stub: ChatProviderStub) => {
  (useChat as jest.Mock).mockReturnValue(stub);
};

/* START MOCK MESSAGES */
let messages: Message[] = [];

const getMessagesStub = () => {
  const stub = {
    data: { messages },
  };

  (useGetMessages as jest.Mock).mockReturnValue(stub);
};

const createMessage = (content: string, role: MessageRole, chatId: string, messageId: string) => {
  messages.push({
    id: messageId,
    content,
    role,
    chatId,
    createdAt: new Date(),
    citations: [],
    artifacts: [],
    followUps: [],
  });

  getMessagesStub();
};

const resetMessages = () => {
  messages = [];
  getMessagesStub();
};

/* START MOCK MUTATIONS */
type MutationResponse = {
  mutateAsync: () => void;
  isPending: boolean;
}

const createDeleteMessageStub = ({ mutateAsync, isPending }: MutationResponse) => {
  const stub = {
    mutateAsync,
    isPending,
  };

  (useDeleteMessage as jest.Mock).mockReturnValue(stub);
};

const createUpdateMessageStub = ({ mutateAsync, isPending }: MutationResponse) => {
  const stub = {
    mutateAsync,
    isPending,
  };

  (useUpdateMessage as jest.Mock).mockReturnValue(stub);
};

const createRetryMessageStub = ({ mutateAsync, isPending }: MutationResponse) => {
  const stub = {
    mutateAsync,
    isPending,
  };

  (useRetryMessage as jest.Mock).mockReturnValue(stub);
};

describe('useEditMessage', () => {
  const stubChatId = 'ee9837ec-869a-408b-9cca-608d3431b3f1';
  const stubMessageId = '16d8790f-bfb7-4015-9214-c634d6569b6f';
  const stubNextMessageId = 'next-message-id';
  const newContent = 'Updated message content';
  const knowledgeBaseIds = ['kb1', 'kb2'];

  const deleteMessageMock = jest.fn();
  const updateMessageMock = jest.fn();
  const retryMessageMock = jest.fn();
  const setEntryBeingEditedMock = jest.fn();
  const errorMock = new Error('This is an error');
  const documentLibraryEnabled = true;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Stub away chat provider
    createChatProviderStub({
      chatId: stubChatId,
      knowledgeBaseIds,
      documentLibraryEnabled,
      setEntryBeingEdited: setEntryBeingEditedMock,
    });

    // Stub away getMessages route
    resetMessages();
    createMessage('Original user message', MessageRole.User, stubChatId, stubMessageId);
    createMessage('Assistant response', MessageRole.Assistant, stubChatId, stubNextMessageId);

    // Stub away mutation routes
    createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: false });
    createUpdateMessageStub({ mutateAsync: updateMessageMock, isPending: false });
    createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: false });
  });

  describe('Mutation Call', () => {
    it('calls the deleteMessage mutation with chat id and next message id when there is a next message', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(deleteMessageMock).toHaveBeenCalledWith({
        chatId: stubChatId,
        messageId: stubNextMessageId,
      });
    });

    it('does not call deleteMessage when there is no next message', async () => {
      resetMessages();
      createMessage('Original user message', MessageRole.User, stubChatId, stubMessageId);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(deleteMessageMock).not.toHaveBeenCalled();
    });

    it('calls the updateMessage mutation with message id and new content', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(updateMessageMock).toHaveBeenCalledWith({
        messageId: stubMessageId,
        content: newContent,
      });
    });

    it('calls setEntryBeingEdited with null after updating message', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(setEntryBeingEditedMock).toHaveBeenCalledWith(null);
    });

    it('calls the retryMessage mutation with chat id, knowledgeBaseIds, and documentLibraryEnabled', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(retryMessageMock).toHaveBeenCalledWith({
        chatId: stubChatId,
        knowledgeBaseIds,
        documentLibraryEnabled,
      });
    });
  });

  describe('Loading State', () => {
    it('sets isPending to true when delete message is pending', () => {
      createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: true });

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      expect(result.current.isPending).toBe(true);
    });

    it('sets isPending to true when update message is pending', () => {
      createUpdateMessageStub({ mutateAsync: updateMessageMock, isPending: true });

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      expect(result.current.isPending).toBe(true);
    });

    it('sets isPending to true when retry message is pending', () => {
      createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: true });

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      expect(result.current.isPending).toBe(true);
    });

    it('sets isPending to false when all mutations are complete', () => {
      createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: false });
      createUpdateMessageStub({ mutateAsync: updateMessageMock, isPending: false });
      createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: false });

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      expect(result.current.isPending).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('does not throw if correct data is available', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).toBeNull();
    });

    it('sets error if there is no chatId', async () => {
      createChatProviderStub({
        chatId: null,
        knowledgeBaseIds,
        documentLibraryEnabled,
        setEntryBeingEdited: setEntryBeingEditedMock,
      });

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('We are unable to edit this message at this time');
    });

    it('sets error if message is not found', async () => {
      const { result } = renderHook(() => useEditMessage('non-existent-id'));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('We are unable to edit this message at this time');
    });

    it('sets error if message is not a user message', async () => {
      resetMessages();
      createMessage('Assistant message', MessageRole.Assistant, stubChatId, stubMessageId);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('We are unable to edit this message at this time');
    });

    it('sets error if new content is empty', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync('');
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Message content cannot be empty');
    });

    it('sets error if new content is only whitespace', async () => {
      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync('   ');
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Message content cannot be empty');
    });

    it('sets error if message index is not found', async () => {
      resetMessages();
      // Create messages but not with the expected ID
      createMessage('Different message', MessageRole.User, stubChatId, 'different-id');

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('We are unable to edit this message at this time');
    });

    it('sets error if deleteMessage fails', async () => {
      deleteMessageMock.mockRejectedValue(errorMock);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('There was a problem editing the message');
    });

    it('sets error if updateMessage fails', async () => {
      updateMessageMock.mockRejectedValue(errorMock);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('There was a problem editing the message');
    });

    it('sets error if retryMessage fails', async () => {
      retryMessageMock.mockRejectedValue(errorMock);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('There was a problem editing the message');
    });

    it('resets error state when mutateAsync is called again', async () => {
      // First call that will fail
      updateMessageMock.mockRejectedValueOnce(errorMock);

      const { result } = renderHook(() => useEditMessage(stubMessageId));

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).not.toBeNull();

      // Reset mock to succeed on second call
      updateMessageMock.mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.mutateAsync(newContent);
      });

      expect(result.current.error).toBeNull();
    });
  });
});
