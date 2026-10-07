import { act, renderHook } from '@testing-library/react';

import { usePinWorkflowGroup } from './usePinWorkflowGroup';
import useGetUserGroups from '@/features/profile/api/get-user-groups';

jest.mock('@/features/profile/api/get-user-groups');

const mockUseGetUserGroups = useGetUserGroups as jest.Mock;

describe('usePinWorkflowGroup', () => {
  const twoEligibleGroups = [
    { id: 'group-1', label: 'Group One', role: 'User', aiProviderIds: ['provider-1'], workflowsEnabled: true },
    { id: 'group-2', label: 'Group Two', role: 'User', aiProviderIds: ['provider-2'], workflowsEnabled: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoEligibleGroups }, isPending: false });
  });

  it('auto-pins the single eligible group without opening the modal', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          twoEligibleGroups[0],
          { id: 'group-3', label: 'Group Three', role: 'User', aiProviderIds: [], workflowsEnabled: false },
        ],
      },
      isPending: false,
    });
    const { result } = renderHook(() => usePinWorkflowGroup());

    expect(result.current.isResolved).toBe(true);
    expect(result.current.pinnedGroup).toEqual({ id: 'group-1', aiProviderIds: ['provider-1'] });
    expect(result.current.isModalOpen).toBe(false);
  });

  it('opens the modal when more than one group is workflows-eligible', () => {
    const { result } = renderHook(() => usePinWorkflowGroup());

    expect(result.current.isResolved).toBe(false);
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.eligibleGroups).toEqual([
      { id: 'group-1', label: 'Group One' },
      { id: 'group-2', label: 'Group Two' },
    ]);
  });

  it('excludes groups without workflowsEnabled from the eligible list', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          ...twoEligibleGroups,
          { id: 'group-3', label: 'Group Three', role: 'User', aiProviderIds: [], workflowsEnabled: false },
        ],
      },
      isPending: false,
    });
    const { result } = renderHook(() => usePinWorkflowGroup());

    expect(result.current.eligibleGroups).toEqual([
      { id: 'group-1', label: 'Group One' },
      { id: 'group-2', label: 'Group Two' },
    ]);
  });

  it('resolves with the selected group once onSelectGroup is called', () => {
    const { result } = renderHook(() => usePinWorkflowGroup());

    act(() => {
      result.current.onSelectGroup('group-2');
    });

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.pinnedGroup).toEqual({ id: 'group-2', aiProviderIds: ['provider-2'] });
  });

  it('flags hasNoEligibleGroups when the user has zero workflows-enabled groups', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [] }, isPending: false });
    const { result } = renderHook(() => usePinWorkflowGroup());

    expect(result.current.hasNoEligibleGroups).toBe(true);
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isModalOpen).toBe(false);
  });
});
