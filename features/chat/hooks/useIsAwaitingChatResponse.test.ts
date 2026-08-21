import { renderHook } from '@testing-library/react';

import useGetMessages from '@/features/chat/api/get-messages';
import { AsyncChatStatus } from '@/features/chat/types/message';
import useIsAwaitingChatResponse from './useIsAwaitingChatResponse';

jest.mock('@/features/chat/api/get-messages');

const mockUseGetMessages = useGetMessages as jest.Mock;

const chatId = '22acee37-f309-41e5-a7a9-5e1abc6c4587';

describe('useIsAwaitingChatResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true while a message is still processing', () => {
    mockUseGetMessages.mockReturnValue({
      data: { messages: [{ asyncChatStatus: AsyncChatStatus.PROCESSING }] },
    });

    const { result } = renderHook(() => useIsAwaitingChatResponse(chatId));

    expect(result.current).toBe(true);
  });

  it('returns false when every message has completed', () => {
    mockUseGetMessages.mockReturnValue({
      data: {
        messages: [
          { asyncChatStatus: AsyncChatStatus.COMPLETED },
          { asyncChatStatus: null },
        ],
      },
    });

    const { result } = renderHook(() => useIsAwaitingChatResponse(chatId));

    expect(result.current).toBe(false);
  });

  it('returns false when a message errored', () => {
    mockUseGetMessages.mockReturnValue({
      data: { messages: [{ asyncChatStatus: AsyncChatStatus.ERROR }] },
    });

    const { result } = renderHook(() => useIsAwaitingChatResponse(chatId));

    expect(result.current).toBe(false);
  });

  it('returns false when there is no message data yet', () => {
    mockUseGetMessages.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useIsAwaitingChatResponse(null));

    expect(result.current).toBe(false);
  });
});
