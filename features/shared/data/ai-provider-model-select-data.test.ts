import { renderHook } from '@testing-library/react';

import { useGetAiProviderModelSelectData } from './ai-provider-model-select-data';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

jest.mock('@/features/shared/api/get-available-models');

const mockUseGetAvailableModels = useGetAvailableModels as jest.Mock;

describe('useGetAiProviderModelSelectData', () => {
  const availableModels = [
    { id: 'model-1', aiProviderId: 'provider-1', name: 'Model One', providerLabel: 'Provider One' },
    { id: 'model-2', aiProviderId: 'provider-2', name: 'Model Two', providerLabel: 'Provider Two' },
  ];

  beforeEach(() => {
    mockUseGetAvailableModels.mockReturnValue({ data: { availableModels }, isError: false, error: null });
  });

  it('returns every available model as an option when no aiProviderIds filter is given', () => {
    const { result } = renderHook(() => useGetAiProviderModelSelectData());

    expect(result.current.modelOptions).toEqual([
      { value: 'model-1', label: 'Model One', group: 'Provider One' },
      { value: 'model-2', label: 'Model Two', group: 'Provider Two' },
    ]);
  });

  it('narrows options to only the given aiProviderIds', () => {
    const { result } = renderHook(() => useGetAiProviderModelSelectData({ aiProviderIds: ['provider-1'] }));

    expect(result.current.modelOptions).toEqual([
      { value: 'model-1', label: 'Model One', group: 'Provider One' },
    ]);
  });
});
