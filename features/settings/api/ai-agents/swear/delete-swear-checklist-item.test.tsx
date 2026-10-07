import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import useDeleteSwearChecklistItem from './delete-swear-checklist-item';
import { trpc } from '@/libs';

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(),
    settings: {
      deleteSwearChecklistItem: {
        useMutation: jest.fn(),
      },
    },
  },
}));

describe('useDeleteSwearChecklistItem', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
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

    (trpc.settings.deleteSwearChecklistItem.useMutation as jest.Mock).mockImplementation(
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
    const { result } = renderHook(() => useDeleteSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutateAsync).toBeDefined();
  });

  it('should update cache on success', async () => {
    const deletedItem = {
      id: mockItemId,
      aiAgentId: mockAgentId,
    };

    mockMutateAsync.mockResolvedValue(deletedItem);

    const { result } = renderHook(() => useDeleteSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: mockItemId });
    });

    expect(mockSetData).toHaveBeenCalledWith(
      { id: mockAgentId },
      expect.any(Function)
    );
  });

  it('should remove item from existing data', async () => {
    const existingItems = [
      {
        id: mockItemId,
        aiAgentId: mockAgentId,
        category: 'Category 1',
        item: 'Item to delete',
        sortOrder: 1,
      },
      {
        id: 'other-id',
        aiAgentId: mockAgentId,
        category: 'Category 2',
        item: 'Other item',
        sortOrder: 2,
      },
    ];

    const deletedItem = {
      id: mockItemId,
      aiAgentId: mockAgentId,
    };

    mockMutateAsync.mockResolvedValue(deletedItem);

    let updaterFn: ((oldData: { checklistItems: { id: string }[] } | undefined) => unknown) | null = null;
    mockSetData.mockImplementation((_key: unknown, fn: (oldData: { checklistItems: { id: string }[] } | undefined) => unknown) => {
      updaterFn = fn;
    });

    const { result } = renderHook(() => useDeleteSwearChecklistItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: mockItemId });
    });

    expect(updaterFn).not.toBeNull();
    const updatedData = updaterFn!({ checklistItems: existingItems });
    expect(updatedData).toEqual({
      checklistItems: [existingItems[1]],
    });
  });
});
