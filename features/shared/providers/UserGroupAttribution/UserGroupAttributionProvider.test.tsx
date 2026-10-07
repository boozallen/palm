import { act, renderHook } from '@testing-library/react';

import { UserGroupAttributionProvider, useUserGroupAttributionContext } from './UserGroupAttributionProvider';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';

jest.mock('@/features/profile/api/get-user-groups');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/document-upload/get-embedding-eligible-ai-providers');

const mockUseGetUserGroups = useGetUserGroups as jest.Mock;
const mockUseGetAvailableModels = useGetAvailableModels as jest.Mock;
const mockUseGetEmbeddingEligibleAiProviders = useGetEmbeddingEligibleAiProviders as jest.Mock;

describe('UserGroupAttributionProvider', () => {
  const twoGroups = [
    { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
    { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoGroups } });
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: ['provider-2'] } });
  });

  it('throws when used outside a UserGroupAttributionProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useUserGroupAttributionContext();
      } catch (error) {
        return error;
      }
    });

    expect(result.current).toBeInstanceOf(Error);
  });

  it('resolves gate() silently using the sticky default once one is set', async () => {
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    act(() => {
      result.current.setDefaultUserGroupId('group-2');
    });
    expect(result.current.defaultUserGroupId).toBe('group-2');

    const onSubmit = jest.fn();
    await act(async () => {
      await result.current.gate({ kind: 'model', modelId: undefined }, onSubmit);
    });
    expect(onSubmit).toHaveBeenCalledWith('group-2');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('treats a stored default that no longer grants any AI provider access as no default, for the sidebar-facing state', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          ...twoGroups,
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: [] },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    act(() => {
      result.current.setDefaultUserGroupId('group-3'); // grants no AI provider access at all
    });

    expect(result.current.idleGroups).toEqual([
      { id: 'group-1', label: 'User Group One' },
      { id: 'group-2', label: 'User Group Two' },
    ]);
    expect(result.current.idleDefaultUserGroupId).toBeUndefined();
  });

  it('is visible account-wide when 2+ groups grant any AI provider access', () => {
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.idleGroups).toEqual([
      { id: 'group-1', label: 'User Group One' },
      { id: 'group-2', label: 'User Group Two' },
    ]);
    expect(result.current.isUserGroupAttributionControlVisible).toBe(true);
  });

  it('reports the non-overlapping read-only state when fewer than 2 groups grant any AI provider access', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: [] },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.isUserGroupAttributionControlVisible).toBe(true);
    expect(result.current.singleUserGroup).toBeUndefined();
    expect(result.current.nonOverlappingUserGroups).toEqual([
      { id: 'group-1', label: 'User Group One' },
      { id: 'group-2', label: 'User Group Two' },
    ]);
  });

  // Each group having *some* AI provider isn't enough — a model reachable through only one
  // of the user's groups is never actually ambiguous, so there's nothing to attribute; this
  // is the non-overlapping read-only state instead of the decision-driving idle state.
  it('reports the non-overlapping read-only state when 2+ groups each grant access but share no AI provider', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.idleGroups).toEqual([]);
    expect(result.current.isUserGroupAttributionControlVisible).toBe(true);
    expect(result.current.nonOverlappingUserGroups).toEqual([
      { id: 'group-1', label: 'User Group One' },
      { id: 'group-2', label: 'User Group Two' },
    ]);
  });

  it('is not visible when the account has 0 user groups', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [] } });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.isUserGroupAttributionControlVisible).toBe(false);
    expect(result.current.singleUserGroup).toBeUndefined();
    expect(result.current.nonOverlappingUserGroups).toBeUndefined();
  });

  it('reports singleUserGroup and no other read-only state when the account has exactly 1 user group', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: { userGroups: [{ id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: [] }] },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.isUserGroupAttributionControlVisible).toBe(true);
    expect(result.current.singleUserGroup).toEqual({ id: 'group-1', label: 'User Group One' });
    expect(result.current.nonOverlappingUserGroups).toBeUndefined();
  });

  it('is visible once a third group overlaps with one of two otherwise-disjoint groups', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-1'] },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    // group-2 shares nothing with anyone, so it's excluded even though it has AI access.
    expect(result.current.idleGroups).toEqual([
      { id: 'group-1', label: 'User Group One' },
      { id: 'group-3', label: 'User Group Three' },
    ]);
    expect(result.current.isUserGroupAttributionControlVisible).toBe(true);
  });

  it('names each overlapping AI provider using its label from getAvailableModels', () => {
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1', providerLabel: 'Bedrock' }] },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.overlappingAiProviders).toEqual([{
      id: 'provider-1',
      name: 'Bedrock',
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    }]);
  });

  it('falls back to the raw provider id when getAvailableModels has no matching label', () => {
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    // The default beforeEach mock returns a model for provider-1 with no providerLabel field.
    expect(result.current.overlappingAiProviders).toEqual([{
      id: 'provider-1',
      name: 'provider-1',
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    }]);
  });

  it('lists every provider shared by 2+ groups, scaling to multiple overlaps at once', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1', 'provider-2'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    mockUseGetAvailableModels.mockReturnValue({
      data: {
        availableModels: [
          { id: 'model-1', aiProviderId: 'provider-1', providerLabel: 'Bedrock' },
          { id: 'model-2', aiProviderId: 'provider-2', providerLabel: 'Bedrock#2' },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.overlappingAiProviders).toEqual([
      {
        id: 'provider-1',
        name: 'Bedrock',
        groups: [
          { id: 'group-1', label: 'User Group One' },
          { id: 'group-2', label: 'User Group Two' },
        ],
      },
      {
        id: 'provider-2',
        name: 'Bedrock#2',
        groups: [
          { id: 'group-1', label: 'User Group One' },
          { id: 'group-3', label: 'User Group Three' },
        ],
      },
    ]);
  });

  it('queues a second concurrent gate() call instead of dropping it', async () => {
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });
    const firstOnSubmit = jest.fn();
    const secondOnSubmit = jest.fn();
    let secondAttributed: boolean | undefined;

    act(() => {
      result.current.gate({ kind: 'model', modelId: undefined }, firstOnSubmit);
    });
    act(() => {
      result.current.gate({ kind: 'model', modelId: undefined }, secondOnSubmit).then((value) => {
        secondAttributed = value;
      });
    });

    // Still showing the first decision - the second caller's action hasn't been dropped.
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });
    expect(secondOnSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.onSelect('group-1');
    });
    expect(firstOnSubmit).toHaveBeenCalledWith('group-1');

    // Second decision now surfaces on its own.
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });
    expect(secondOnSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.onSelect('group-2');
    });
    expect(secondOnSubmit).toHaveBeenCalledWith('group-2');
    expect(secondAttributed).toBe(true);
    expect(result.current.pendingDecision).toBeNull();
  });

  it('abandon() cancels a queued request without invoking its onSubmit, and advances to the next one', async () => {
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });
    const firstOnSubmit = jest.fn();
    const secondOnSubmit = jest.fn();
    let firstAttributed: boolean | undefined;

    act(() => {
      result.current.gate({ kind: 'model', modelId: undefined }, firstOnSubmit).then((value) => {
        firstAttributed = value;
      });
    });
    act(() => {
      result.current.gate({ kind: 'model', modelId: undefined }, secondOnSubmit);
    });

    await act(async () => {
      result.current.abandon(firstOnSubmit);
    });

    expect(firstOnSubmit).not.toHaveBeenCalled();
    expect(firstAttributed).toBe(false);
    // The second (still-live) request now surfaces in its place.
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });

    await act(async () => {
      await result.current.onSelect('group-2');
    });
    expect(secondOnSubmit).toHaveBeenCalledWith('group-2');
  });

  it('abandon() is a no-op for a request that already auto-resolved', async () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [twoGroups[0]] } });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate({ kind: 'model', modelId: undefined }, onSubmit);
    });
    expect(onSubmit).toHaveBeenCalledWith('group-1');

    expect(() => {
      act(() => {
        result.current.abandon(onSubmit);
      });
    }).not.toThrow();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('waits for the available-models query before computing model eligibility, instead of treating every group as eligible while it loads', async () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    mockUseGetAvailableModels.mockReturnValue({ data: undefined, isLoading: true });

    const { result, rerender } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });
    const onSubmit = jest.fn();
    let attributed: boolean | undefined;

    act(() => {
      result.current.gate({ kind: 'model', modelId: 'model-1' }, onSubmit).then((value) => {
        attributed = value;
      });
    });

    // Still loading - must not offer group-2 as if it had access too.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).toBeNull();

    await act(async () => {
      mockUseGetAvailableModels.mockReturnValue({
        data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
        isLoading: false,
      });
      rerender();
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(attributed).toBe(true);
  });

  it('abandon() cancels a gate() call that is still waiting on eligibility data, so it never later resolves', async () => {
    mockUseGetAvailableModels.mockReturnValue({ data: undefined, isLoading: true });

    const { result, rerender } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });
    const onSubmit = jest.fn();
    let attributed: boolean | undefined;

    act(() => {
      result.current.gate({ kind: 'model', modelId: 'model-1' }, onSubmit).then((value) => {
        attributed = value;
      });
    });
    act(() => {
      result.current.abandon(onSubmit);
    });

    await act(async () => {
      mockUseGetAvailableModels.mockReturnValue({
        data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
        isLoading: false,
      });
      rerender();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(attributed).toBe(false);
  });

  it('excludes a provider only one group has, even when other providers overlap', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1', 'provider-99'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
        ],
      },
    });
    const { result } = renderHook(() => useUserGroupAttributionContext(), { wrapper: UserGroupAttributionProvider });

    expect(result.current.overlappingAiProviders).toEqual([{
      id: 'provider-1',
      name: 'provider-1',
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    }]);
  });
});
