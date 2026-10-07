import { useEffect } from 'react';
import { act, render, renderHook } from '@testing-library/react';

import { useEmbeddingUserGroupAttribution } from './useEmbeddingUserGroupAttribution';
import {
  UserGroupAttributionProvider,
  useUserGroupAttributionContext,
} from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';

type GateContext = ReturnType<typeof useUserGroupAttributionContext>;
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';
import { UiPreference } from '@/types/ui-preferences';

jest.mock('@/features/profile/api/get-user-groups');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/document-upload/get-embedding-eligible-ai-providers');

const mockUseGetUserGroups = useGetUserGroups as jest.Mock;
const mockUseGetAvailableModels = useGetAvailableModels as jest.Mock;
const mockUseGetEmbeddingEligibleAiProviders = useGetEmbeddingEligibleAiProviders as jest.Mock;

// gate() only returns { gate } - pendingDecision/onSelect/onDismiss/defaultUserGroupId live on
// the context, so pull both in together to exercise gate() through its real public surface.
const renderGate = () => renderHook(() => ({
  ...useUserGroupAttributionContext(),
  ...useEmbeddingUserGroupAttribution(),
}), { wrapper: UserGroupAttributionProvider });

describe('useEmbeddingUserGroupAttribution', () => {
  const twoGroups = [
    { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
    { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoGroups } });
    mockUseGetAvailableModels.mockReturnValue({ data: { availableModels: [] } });
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: ['provider-1', 'provider-2'] } });
  });

  it('resolves immediately with the single group when only one grants embedding access', async () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [twoGroups[0]] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('ignores a stored default for a different group when only one group grants embedding access', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'group-2' }),
    );
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: ['provider-1'] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('resolves immediately with no group when no group grants embedding access', async () => {
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: [] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith(undefined);
  });

  it('surfaces a pending decision when more than one group grants embedding access', async () => {
    const { result } = renderGate();
    const onSubmit = jest.fn();

    // The submission stays pending until the user resolves it, so awaiting here would hang the test.
    act(() => {
      result.current.gate(onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });
  });

  it('only surfaces groups that actually grant embedding access, excluding groups with no eligible provider', async () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          ...twoGroups,
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-3'] },
        ],
      },
    });
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: ['provider-1', 'provider-2'] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    act(() => {
      result.current.gate(onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });
  });

  it('resolves the pending submit with the selected group once onSelect is called', async () => {
    const { result } = renderGate();
    const onSubmit = jest.fn();
    let attributed: boolean | undefined;

    act(() => {
      result.current.gate(onSubmit).then((value) => {
        attributed = value;
      });
    });

    await act(async () => {
      await result.current.onSelect('group-2');
    });

    expect(onSubmit).toHaveBeenCalledWith('group-2');
    expect(result.current.pendingDecision).toBeNull();
    expect(attributed).toBe(true);
  });

  it('persists the selection as the sticky default in localStorage', async () => {
    const { result } = renderGate();

    act(() => {
      result.current.gate(jest.fn());
    });

    await act(async () => {
      await result.current.onSelect('group-2');
    });

    const stored = JSON.parse(localStorage.getItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE) as string);
    expect(stored).toEqual({ userGroupId: 'group-2' });
  });

  it('skips the pending decision and reuses the stored default group', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'group-2' }),
    );
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-2');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('re-prompts if the stored group no longer matches one of the eligible groups', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'stale-group' }),
    );
    const { result } = renderGate();
    const onSubmit = jest.fn();

    act(() => {
      result.current.gate(onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).not.toBeNull();
  });

  it('clears pending state without submitting when onDismiss is called', async () => {
    const { result } = renderGate();
    const onSubmit = jest.fn();
    let attributed: boolean | undefined;

    act(() => {
      result.current.gate(onSubmit).then((value) => {
        attributed = value;
      });
    });

    await act(async () => {
      result.current.onDismiss();
    });

    expect(result.current.pendingDecision).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(attributed).toBe(false);
  });

  // Fires gate() once on mount and abandons it on unmount via useEmbeddingUserGroupAttribution's
  // own cleanup effect - simulates a real caller (e.g. AddDocumentForm) navigating away.
  function GateTrigger({ onSubmit }: Readonly<{ onSubmit: (userGroupId: string | undefined) => void }>) {
    const { gate } = useEmbeddingUserGroupAttribution();
    useEffect(() => {
      gate(onSubmit);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  function ContextCapture({ onContext }: Readonly<{ onContext: (context: GateContext) => void }>) {
    const context = useUserGroupAttributionContext();
    onContext(context);
    return null;
  }

  it('abandons a pending gate() call when the calling component unmounts, so it can never resolve a stale onSubmit', async () => {
    const onSubmit = jest.fn();
    let latestContext: GateContext;
    const captureContext = (context: GateContext) => {
      latestContext = context;
    };

    const { rerender } = render(
      <UserGroupAttributionProvider>
        <ContextCapture onContext={captureContext} />
        <GateTrigger onSubmit={onSubmit} />
      </UserGroupAttributionProvider>,
    );
    expect(latestContext!.pendingDecision).not.toBeNull();

    act(() => {
      rerender(
        <UserGroupAttributionProvider>
          <ContextCapture onContext={captureContext} />
        </UserGroupAttributionProvider>,
      );
    });
    expect(latestContext!.pendingDecision).toBeNull();

    await act(async () => {
      await latestContext!.onSelect('group-2');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
