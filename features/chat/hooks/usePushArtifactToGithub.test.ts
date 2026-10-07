import { renderHook } from '@testing-library/react';
import { usePushArtifactToGithub } from './usePushArtifactToGithub';
import { trpc } from '@/libs';

jest.mock('@/libs', () => ({
  trpc: {
    chat: {
      pushArtifactToGithub: {
        useMutation: jest.fn(),
      },
    },
    useUtils: jest.fn(() => ({
      chat: {
        getMessages: {
          invalidate: jest.fn(),
        },
      },
    })),
  },
}));

describe('usePushArtifactToGithub', () => {
  const mockMutation = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (trpc.chat.pushArtifactToGithub.useMutation as jest.Mock).mockReturnValue(mockMutation);
  });

  it('returns mutation from trpc hook', () => {
    const { result } = renderHook(() => usePushArtifactToGithub('test-chat-id'));

    expect(trpc.chat.pushArtifactToGithub.useMutation).toHaveBeenCalled();
    expect(result.current).toBe(mockMutation);
  });

  it('exposes mutation methods', () => {
    const { result } = renderHook(() => usePushArtifactToGithub('test-chat-id'));

    expect(result.current.mutate).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('exposes mutation state', () => {
    const { result } = renderHook(() => usePushArtifactToGithub('test-chat-id'));

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeUndefined();
  });
});
