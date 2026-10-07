import { useEffect } from 'react';
import { act, render, renderHook } from '@testing-library/react';

import { useUserGroupAttribution } from './useUserGroupAttribution';
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
  ...useUserGroupAttribution(),
}), { wrapper: UserGroupAttributionProvider });

describe('useUserGroupAttribution', () => {
  const twoGroups = [
    { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
    { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoGroups } });
    mockUseGetAvailableModels.mockReturnValue({ data: { availableModels: [] } });
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: [] } });
  });

  it('resolves immediately with the single group when the user belongs to only one', async () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [twoGroups[0]] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(undefined, onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('resolves immediately with no group when the user belongs to zero groups', async () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [] } });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(undefined, onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith(undefined);
  });

  it('surfaces a pending decision when the user belongs to multiple groups and no modelId narrows it down', async () => {
    const { result } = renderGate();
    const onSubmit = jest.fn();

    // The submission stays pending until the user resolves it, so awaiting here would hang the test.
    act(() => {
      result.current.gate(undefined, onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-2', label: 'User Group Two' },
      ],
    });
  });

  it('auto-attributes to the one group with access to the selected model, without a pending decision', async () => {
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate('model-1', onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('ignores a stored default for a different group when the selected model has only one eligible group', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'group-2' }),
    );
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate('model-1', onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-1');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('only surfaces the groups that have access to the selected model when several qualify', async () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          ...twoGroups,
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-1'] },
        ],
      },
    });
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    act(() => {
      result.current.gate('model-1', onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).toEqual({
      groups: [
        { id: 'group-1', label: 'User Group One' },
        { id: 'group-3', label: 'User Group Three' },
      ],
    });
  });

  it('falls back to every group when the modelId is not a recognized model', async () => {
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    const { result } = renderGate();
    const onSubmit = jest.fn();

    act(() => {
      result.current.gate('agent-provider::123', onSubmit);
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
      result.current.gate(undefined, onSubmit).then((value) => {
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
      result.current.gate(undefined, jest.fn());
    });

    await act(async () => {
      await result.current.onSelect('group-2');
    });

    const stored = JSON.parse(localStorage.getItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE) as string);
    expect(stored).toEqual({ userGroupId: 'group-2' });
    expect(result.current.defaultUserGroupId).toBe('group-2');
  });

  it('skips the pending decision and reuses the stored default group', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'group-2' }),
    );
    const { result } = renderGate();
    const onSubmit = jest.fn();

    await act(async () => {
      await result.current.gate(undefined, onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith('group-2');
    expect(result.current.pendingDecision).toBeNull();
  });

  it('re-prompts if the stored group no longer matches one of the user\'s groups', async () => {
    localStorage.setItem(
      UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE,
      JSON.stringify({ userGroupId: 'stale-group' }),
    );
    const { result } = renderGate();
    const onSubmit = jest.fn();

    act(() => {
      result.current.gate(undefined, onSubmit);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.pendingDecision).not.toBeNull();
  });

  it('clears pending state without submitting when onDismiss is called', async () => {
    const { result } = renderGate();
    const onSubmit = jest.fn();
    let attributed: boolean | undefined;

    act(() => {
      result.current.gate(undefined, onSubmit).then((value) => {
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

  // Fires gate() once on mount and abandons it on unmount via useUserGroupAttribution's own
  // cleanup effect - simulates a real caller (e.g. an Agent submit handler) navigating away.
  function GateTrigger({ onSubmit }: Readonly<{ onSubmit: (userGroupId: string | undefined) => void }>) {
    const { gate } = useUserGroupAttribution();
    useEffect(() => {
      gate(undefined, onSubmit);
      // Fire once per mount only - re-firing on every gate() identity change isn't the point here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  function ContextCapture({ onContext }: Readonly<{ onContext: (context: GateContext) => void }>) {
    const context = useUserGroupAttributionContext();
    onContext(context);
    return null;
  }

  it('abandons a pending gate() call when the calling component unmounts (e.g. browser navigation), so it can never resolve a stale onSubmit', async () => {
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

    // Nothing left mounted to answer through, but resolving directly against the
    // now-abandoned request proves it was pulled out of the queue, not left dangling.
    await act(async () => {
      await latestContext!.onSelect('group-2');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not abandon a still-mounted caller\'s pending gate() call when a different caller unmounts', async () => {
    const firstOnSubmit = jest.fn();
    const secondOnSubmit = jest.fn();
    let latestContext: GateContext;
    const captureContext = (context: GateContext) => {
      latestContext = context;
    };

    const { rerender } = render(
      <UserGroupAttributionProvider>
        <ContextCapture onContext={captureContext} />
        <GateTrigger key='first' onSubmit={firstOnSubmit} />
        <GateTrigger key='second' onSubmit={secondOnSubmit} />
      </UserGroupAttributionProvider>,
    );
    expect(latestContext!.pendingDecision).not.toBeNull();

    act(() => {
      rerender(
        <UserGroupAttributionProvider>
          <ContextCapture onContext={captureContext} />
          <GateTrigger key='second' onSubmit={secondOnSubmit} />
        </UserGroupAttributionProvider>,
      );
    });

    // The unmounted caller's own request was abandoned; the still-mounted one surfaces now.
    await act(async () => {
      await latestContext!.onSelect('group-2');
    });
    expect(secondOnSubmit).toHaveBeenCalledWith('group-2');
    expect(firstOnSubmit).not.toHaveBeenCalled();
  });

  it('exposes setDefaultUserGroupId for proactively changing the default outside of gate()', () => {
    const { result } = renderGate();

    act(() => {
      result.current.setDefaultUserGroupId('group-2');
    });

    expect(result.current.defaultUserGroupId).toBe('group-2');
    const stored = JSON.parse(localStorage.getItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE) as string);
    expect(stored).toEqual({ userGroupId: 'group-2' });
  });

});
