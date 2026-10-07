import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import useCreateSwearChecklistItem from './create-swear-checklist-item';
import { trpc } from '@/libs';

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(),
    settings: {
      createSwearChecklistItem: {
        useMutation: jest.fn(),
      },
    },
  },
}));

describe('useCreateSwearChecklistItem', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockMutateAsync = jest.fn();
  const mockSetData = jest.fn();

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.useUtils as jest.Mock).mockReturnValue({
      settings: {
        getSwearChecklistItems: {
          setData: mockSetData,
        },
      },
    });

    (trpc.settings.createSwearChecklistItem.useMutation as jest.Mock).mockImplementation(
      (options) => ({
        mutateAsync: async (data: unknown) => {
          const result = await mockMutateAsync(data);
          if (options?.onSuccess) {
            options.onSuccess(result);
          }
          return result;
        },
        isPending: false,
      })
    );
  });

  it('should return mutation function', () => {
    const { result } = renderHook(() => useCreateSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutateAsync).toBeDefined();
  });

  it('should update cache on success', async () => {
    const newItem = {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      aiAgentId: mockAgentId,
      category: 'Preliminary Information',
      item: 'New item',
      sortOrder: 1,
    };

    mockMutateAsync.mockResolvedValue(newItem);

    const { result } = renderHook(() => useCreateSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        aiAgentId: mockAgentId,
        category: 'Preliminary Information',
        item: 'New item',
        sortOrder: 1,
      });
    });

    expect(mockSetData).toHaveBeenCalledWith(
      { id: mockAgentId },
      expect.any(Function)
    );
  });

  it('should add new item to existing data', async () => {
    const existingItems = [
      {
        id: 'existing-id',
        aiAgentId: mockAgentId,
        category: 'Existing',
        item: 'Existing item',
        sortOrder: 1,
      },
    ];

    const newItem = {
      id: 'new-id',
      aiAgentId: mockAgentId,
      category: 'New',
      item: 'New item',
      sortOrder: 2,
    };

    mockMutateAsync.mockResolvedValue(newItem);

    let updaterFn: ((oldData: { checklistItems: unknown[] } | undefined) => unknown) | null = null;
    mockSetData.mockImplementation((_key: unknown, fn: (oldData: { checklistItems: unknown[] } | undefined) => unknown) => {
      updaterFn = fn;
    });

    const { result } = renderHook(() => useCreateSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(newItem);
    });

    expect(updaterFn).not.toBeNull();
    const updatedData = updaterFn!({ checklistItems: existingItems });
    expect(updatedData).toEqual({
      checklistItems: [...existingItems, newItem],
    });
  });
});
