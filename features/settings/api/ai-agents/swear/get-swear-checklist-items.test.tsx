import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import useGetSwearChecklistItems from './get-swear-checklist-items';
import { trpc } from '@/libs';

jest.mock('@/libs', () => ({
  trpc: {
    settings: {
      getSwearChecklistItems: {
        useQuery: jest.fn(),
      },
    },
  },
}));

describe('useGetSwearChecklistItems', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

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
  });

  it('should call useQuery with correct params', () => {
    (trpc.settings.getSwearChecklistItems.useQuery as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderHook(() => useGetSwearChecklistItems(mockAgentId), {
      wrapper: createWrapper(),
    });

    expect(trpc.settings.getSwearChecklistItems.useQuery).toHaveBeenCalledWith({
      id: mockAgentId,
    });
  });

  it('should return query result', () => {
    const mockData = {
      checklistItems: [
        {
          id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
          aiAgentId: mockAgentId,
          category: 'Preliminary Information',
          item: 'Test item',
          sortOrder: 1,
        },
      ],
    };

    (trpc.settings.getSwearChecklistItems.useQuery as jest.Mock).mockReturnValue({
      data: mockData,
      isLoading: false,
    });

    const { result } = renderHook(() => useGetSwearChecklistItems(mockAgentId), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle loading state', () => {
    (trpc.settings.getSwearChecklistItems.useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useGetSwearChecklistItems(mockAgentId), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });
});
