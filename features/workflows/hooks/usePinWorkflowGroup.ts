import { useEffect, useState } from 'react';

import useGetUserGroups from '@/features/profile/api/get-user-groups';
import { PinnedWorkflowGroup } from '@/features/workflows/providers/WorkflowBuilderProvider';

export type PinWorkflowGroupOption = {
  id: string;
  label: string;
};

export interface UsePinWorkflowGroupResult {
  // isResolved is false until the group to pin is known, so the canvas can
  // stay unmounted until then rather than relying on the modal overlay alone
  // to block every node-add path.
  isResolved: boolean;
  pinnedGroup: PinnedWorkflowGroup | null;
  isModalOpen: boolean;
  hasNoEligibleGroups: boolean;
  eligibleGroups: PinWorkflowGroupOption[];
  onSelectGroup: (userGroupId: string) => void;
}

export function usePinWorkflowGroup(): UsePinWorkflowGroupResult {
  const { data: userGroupsData, isPending: isUserGroupsPending } = useGetUserGroups();
  const [pinnedGroup, setPinnedGroup] = useState<PinnedWorkflowGroup | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const eligibleGroups = (userGroupsData?.userGroups ?? []).filter((group) => group.workflowsEnabled);

  useEffect(() => {
    if (isResolved || isUserGroupsPending) {
      return;
    }

    if (eligibleGroups.length === 1) {
      setPinnedGroup({ id: eligibleGroups[0].id, aiProviderIds: eligibleGroups[0].aiProviderIds });
      setIsResolved(true);
      return;
    }

    if (eligibleGroups.length > 1) {
      setIsModalOpen(true);
    }
    // 0 eligible groups: leave unresolved and let the caller render a blocking error state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolved, isUserGroupsPending, eligibleGroups]);

  const onSelectGroup = (userGroupId: string) => {
    const group = eligibleGroups.find((eligibleGroup) => eligibleGroup.id === userGroupId);
    if (!group) {
      return;
    }
    setPinnedGroup({ id: group.id, aiProviderIds: group.aiProviderIds });
    setIsModalOpen(false);
    setIsResolved(true);
  };

  return {
    isResolved,
    pinnedGroup,
    isModalOpen,
    hasNoEligibleGroups: !isUserGroupsPending && eligibleGroups.length === 0,
    eligibleGroups: eligibleGroups.map((group) => ({ id: group.id, label: group.label })),
    onSelectGroup,
  };
}
