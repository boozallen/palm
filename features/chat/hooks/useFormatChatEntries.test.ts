import { renderHook } from '@testing-library/react';
import useFormatChatEntries from './useFormatChatEntries';
import useGetMessages from '@/features/chat/api/get-messages';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import { MessageRole } from '@/features/chat/types/message';
import { EntryType } from '@/features/chat/types/entry';

jest.mock('@/features/chat/api/get-messages');
jest.mock('@/features/chat/api/get-origin-prompt');

describe('useFormatChatEntries', () => {
  const chatId = 'chat-1';
  const promptId = 'prompt-1';
  const pendingMessage = 'This is a pending message';
  const systemMessage = 'System message';
  const regeneratingResponse = false;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return placeholder and pending entries when messages and prompt are loading', () => {
    (useGetMessages as jest.Mock).mockReturnValue({
      isLoading: true,
      isFetched: false,
      data: null,
    });

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isLoading: true,
      isFetched: false,
      data: null,
    });

    const { result } = renderHook(() =>
      useFormatChatEntries(chatId, promptId, pendingMessage, systemMessage, regeneratingResponse)
    );

    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.System,
      content: systemMessage,
    });
    expect(result.current[1]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.User,
      content: pendingMessage,
    });
    expect(result.current[2]).toMatchObject({
      type: EntryType.Skeleton,
      role: MessageRole.Assistant,
    });
  });

  it('should return entries with messages and prompt data', () => {
    const messagesData = {
      messages: [
        {
          id: 'msg-1',
          role: MessageRole.User,
          content: 'Hello',
          citations: [],
          artifacts: [],
          followUps: [],
          messagedAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: MessageRole.Assistant,
          content: 'Hi there!',
          citations: [],
          artifacts: [],
          followUps: [],
          messagedAt: new Date().toISOString(),
        },
      ],
    };

    const promptData = {
      prompt: {
        instructions: 'Prompt instructions',
      },
    };

    (useGetMessages as jest.Mock).mockReturnValue({
      isLoading: false,
      isFetched: true,
      data: messagesData,
    });

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isLoading: false,
      isFetched: true,
      data: promptData,
    });

    const { result } = renderHook(() =>
      useFormatChatEntries(chatId, promptId, pendingMessage, systemMessage, regeneratingResponse)
    );

    expect(result.current).toHaveLength(4);
    expect(result.current[0]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.User,
      content: 'Hello',
    });
    expect(result.current[1]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.Assistant,
      content: 'Hi there!',
    });
    expect(result.current[2]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.User,
      content: pendingMessage,
    });
    expect(result.current[3]).toMatchObject({
      type: EntryType.Skeleton,
      role: MessageRole.Assistant,
    });
  });

  it('should handle regenerating response by adding a skeleton entry', () => {
    const messagesData = {
      messages: [
        {
          id: 'msg-1',
          role: MessageRole.User,
          content: 'Hello',
          citations: [],
          artifacts: [],
          followUps: [],
          messagedAt: new Date().toISOString(),
        },
      ],
    };

    (useGetMessages as jest.Mock).mockReturnValue({
      isLoading: false,
      isFetched: true,
      data: messagesData,
    });

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isLoading: false,
      isFetched: true,
      data: null,
    });

    const { result } = renderHook(() =>
      useFormatChatEntries(chatId, promptId, pendingMessage, systemMessage, true)
    );

    expect(result.current).toHaveLength(4);
    expect(result.current[1]).toMatchObject({
      type: EntryType.Skeleton,
      role: MessageRole.Assistant,
    });
    expect(result.current[2]).toMatchObject({
      type: EntryType.Message,
      role: MessageRole.User,
      content: pendingMessage,
    });
    expect(result.current[3]).toMatchObject({
      type: EntryType.Skeleton,
      role: MessageRole.Assistant,
    });
  });
});
