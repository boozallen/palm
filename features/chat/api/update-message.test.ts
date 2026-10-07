import { renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';

import useUpdateMessage from '@/features/chat/api/update-message';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { MessageRole } from '@/features/chat/types/message';
import { trpc } from '@/libs';

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: jest.fn(),
}));
jest.mock('@trpc/react-query', () => ({
  ...jest.requireActual('@trpc/react-query'),
  getQueryKey: jest.fn(() => ['snapshot-query-key']),
}));
jest.mock('@/features/chat/providers/ChatProvider');

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(),
    chat: {
      updateMessage: {
        useMutation: jest.fn(),
      },
      getSnapshotGraph: {},
    },
  },
}));

describe('useUpdateMessage', () => {
  const setData = jest.fn();
  const getData = jest.fn();
  const removeQueries = jest.fn();
  const setSelectedGraphSnapshotId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (trpc.useUtils as jest.Mock).mockReturnValue({
      chat: {
        getMessages: { getData, setData },
      },
    });
    (useQueryClient as jest.Mock).mockReturnValue({ removeQueries });
    (useChat as jest.Mock).mockReturnValue({
      selectedGraphSnapshotId: null,
      setSelectedGraphSnapshotId,
    });
    (trpc.chat.updateMessage.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
  });

  it('clears the edited user message graph snapshot from the messages cache', () => {
    getData.mockReturnValue({
      messages: [
        {
          id: 'user-message-id',
          role: MessageRole.User,
          graphSnapshot: { id: 'snapshot-id' },
        },
      ],
    });
    renderHook(() => useUpdateMessage());

    const { onSuccess } = (trpc.chat.updateMessage.useMutation as jest.Mock).mock.calls[0][0];
    onSuccess({
      chatId: 'chat-id',
      chatMessageId: 'user-message-id',
      content: 'Updated content',
    });

    const updateCache = setData.mock.calls[0][1];
    const updatedData = updateCache({
      messages: [
        {
          id: 'user-message-id',
          role: MessageRole.User,
          content: 'Original content',
          graphSnapshot: { id: 'snapshot-id', nodeIds: ['node-id'] },
        },
      ],
    });

    expect(setData).toHaveBeenCalledWith(
      { chatId: 'chat-id' },
      expect.any(Function),
    );
    expect(getData).toHaveBeenCalledWith({ chatId: 'chat-id' });
    expect(updatedData.messages[0]).toEqual(expect.objectContaining({
      content: 'Updated content',
      graphSnapshot: null,
    }));
  });

  it('closes and removes the selected snapshot query after its user message is edited', () => {
    getData.mockReturnValue({
      messages: [
        {
          id: 'user-message-id',
          role: MessageRole.User,
          graphSnapshot: { id: 'snapshot-id' },
        },
      ],
    });
    (useChat as jest.Mock).mockReturnValue({
      selectedGraphSnapshotId: 'snapshot-id',
      setSelectedGraphSnapshotId,
    });
    renderHook(() => useUpdateMessage());

    const { onSuccess } = (trpc.chat.updateMessage.useMutation as jest.Mock).mock.calls[0][0];
    onSuccess({
      chatId: 'chat-id',
      chatMessageId: 'user-message-id',
      content: 'Updated content',
    });

    expect(setSelectedGraphSnapshotId).toHaveBeenCalledWith(null);
    expect(getQueryKey).toHaveBeenCalledWith(
      trpc.chat.getSnapshotGraph,
      { snapshotId: 'snapshot-id' },
      'query',
    );
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ['snapshot-query-key'],
      exact: true,
    });
  });

  it('preserves a graph snapshot when the edited message is not a user message', () => {
    getData.mockReturnValue({
      messages: [
        {
          id: 'assistant-message-id',
          role: MessageRole.Assistant,
          graphSnapshot: { id: 'snapshot-id' },
        },
      ],
    });
    renderHook(() => useUpdateMessage());

    const { onSuccess } = (trpc.chat.updateMessage.useMutation as jest.Mock).mock.calls[0][0];
    onSuccess({
      chatId: 'chat-id',
      chatMessageId: 'assistant-message-id',
      content: 'Updated content',
    });

    const graphSnapshot = { id: 'snapshot-id', nodeIds: ['node-id'] };
    const updateCache = setData.mock.calls[0][1];
    const updatedData = updateCache({
      messages: [
        {
          id: 'assistant-message-id',
          role: MessageRole.Assistant,
          content: 'Original content',
          graphSnapshot,
        },
      ],
    });

    expect(updatedData.messages[0].graphSnapshot).toBe(graphSnapshot);
    expect(setSelectedGraphSnapshotId).not.toHaveBeenCalled();
    expect(removeQueries).not.toHaveBeenCalled();
  });
});
