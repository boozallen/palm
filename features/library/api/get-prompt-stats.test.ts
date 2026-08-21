import React, { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useGetPromptStats } from './get-prompt-stats';

// Mock the trpc module
jest.mock('@/libs', () => ({
  trpc: {
    library: {
      getPromptStats: {
        useQuery: jest.fn(),
      },
    },
  },
}));

import { trpc } from '@/libs';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return function TestWrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('useGetPromptStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call trpc query with correct config', () => {
    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    
    (trpc.library.getPromptStats.useQuery as jest.Mock) = mockUseQuery;

    const config = { promptIds: ['prompt-1', 'prompt-2'] };
    
    renderHook(() => useGetPromptStats(config), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(config, {
      enabled: true, // promptIds.length > 0
    });
  });

  it('should disable query when promptIds is empty', () => {
    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    
    (trpc.library.getPromptStats.useQuery as jest.Mock) = mockUseQuery;

    const config = { promptIds: [] };
    
    renderHook(() => useGetPromptStats(config), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith(config, {
      enabled: false, // promptIds.length === 0
    });
  });

  it('should return query result', () => {
    const mockData = {
      'prompt-1': { bookmarkCount: 5, usageCount: 10 },
    };
    
    const mockUseQuery = jest.fn().mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });
    
    (trpc.library.getPromptStats.useQuery as jest.Mock) = mockUseQuery;

    const config = { promptIds: ['prompt-1'] };
    
    const { result } = renderHook(() => useGetPromptStats(config), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
