import { act, renderHook } from '@testing-library/react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { Message, MessageRole } from '@/features/chat/types/message';
import useGetMessages from '@/features/chat/api/get-messages';
import useDeleteMessage from '@/features/chat/api/delete-message';
import useRetryMessage from '@/features/chat/api/retry-message';
import useRegenerateResponse from './useRegenerateResponse';

jest.mock('@/features/chat/api/delete-message');
jest.mock('@/features/chat/api/retry-message');
jest.mock('@/features/chat/api/get-messages');
jest.mock('@/features/chat/providers/ChatProvider');

/* START MOCK CHAT PROVIDER */
type ChatProviderStub = {
  chatId: string | null;
  setRegeneratingResponse: (value: boolean) => void;
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

const createMessage = (content: string, role: MessageRole, chatId: string) => {
  messages.push({
    id: `${chatId}-${messages.length}`,
    content,
    role,
    chatId,
    createdAt: new Date(),
    citations: [],
    artifacts: [],
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

const createRetryMessageStub = ({ mutateAsync, isPending }: MutationResponse) => {
  const stub = {
    mutateAsync,
    isPending,
  };

  (useRetryMessage as jest.Mock).mockReturnValue(stub);
};

describe('useRegenerateResponse', () => {
  const stubChatId = 'ee9837ec-869a-408b-9cca-608d3431b3f1';
  const retryMessageMock = jest.fn();
  const deleteMessageMock = jest.fn();
  const setRegeneratingResponseMock = jest.fn();
  const errorMock = new Error('This is an error');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Stub away chat provider
    createChatProviderStub({
      chatId: stubChatId,
      setRegeneratingResponse: setRegeneratingResponseMock,
    });

    // Stub away getMessages route
    resetMessages();
    createMessage('Howdy!', MessageRole.User, stubChatId);
    createMessage('Hello', MessageRole.Assistant, stubChatId);

    // Stub away mutation routes
    createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: false });
    createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: false });
  });

  describe('Mutation Call', () => {
    it('calls the deleteMessage mutation with chat id and last message id', async () => {
      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(deleteMessageMock).toHaveBeenCalledWith({
        chatId: stubChatId, messageId: messages[1].id,
      });
    });

    it('calls the retryMessage mutation with chat id and prompt', async () => {
      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(retryMessageMock).toHaveBeenCalledWith({
        chatId: stubChatId,
        customInstructions: expect.stringContaining(messages[1].content),
      });
    });

    it('sets regeneratingResponse to true and then false', async () => {
      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(setRegeneratingResponseMock).toHaveBeenNthCalledWith(1, true);
      expect(setRegeneratingResponseMock).toHaveBeenNthCalledWith(2, false);
    });
  });

  describe('Loading State', () => {
    it('sets isLoading to true when delete message is pending', async () => {
      createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: true });

      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('sets isLoading to true when retry message is pending', async () => {
      createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: true });

      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('sets isLoading to false when mutation is complete', async () => {
      createDeleteMessageStub({ mutateAsync: deleteMessageMock, isPending: false });
      createRetryMessageStub({ mutateAsync: retryMessageMock, isPending: false });

      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('does not throw if correct data is available', async () => {
      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.error).toBeNull();
    });

    it('sets error if there is no chatId', () => {
      createChatProviderStub({ chatId: null, setRegeneratingResponse: setRegeneratingResponseMock });
      const { result } = renderHook(useRegenerateResponse);

      act(() => {
        result.current.mutateAsync();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('sets error if there are no messages', () => {
      resetMessages();

      const { result } = renderHook(useRegenerateResponse);

      act(() => {
        result.current.mutateAsync();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('sets error if last message is not assistant message', () => {
      createMessage('Hello', MessageRole.User, stubChatId);

      const { result } = renderHook(useRegenerateResponse);

      act(() => {
        result.current.mutateAsync();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('sets error if deleteMessage fails', async () => {
      deleteMessageMock.mockRejectedValue(errorMock);

      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('sets error if retryMessage fails', async () => {
      retryMessageMock.mockRejectedValue(errorMock);

      const { result } = renderHook(useRegenerateResponse);

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.error).not.toBeNull();
    });
  });
});
