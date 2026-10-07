import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearUserGroupAttributionPreference,
  readUserGroupAttributionPreference,
  writeUserGroupAttributionPreference,
} from '@/features/shared/utils/userGroupAttributionPreference';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';

export type UserGroupAttributionOption = {
  id: string;
  label: string;
};

export type OverlappingAiProvider = {
  id: string;
  name: string;
  // The groups (already narrowed to ones with any AI access) that grant this specific provider.
  groups: UserGroupAttributionOption[];
};

export type UserGroupAttributionPendingDecision = {
  groups: UserGroupAttributionOption[];
};

type PendingGateRequest = {
  groups: UserGroupAttributionOption[];
  onSubmit: (userGroupId: string | undefined) => void | Promise<void>;
  settle: (userGroupId: string | undefined) => Promise<void>;
  cancel: () => void;
};

// Only used to resolve a forced pendingDecision at gate()-call time — the idle sidebar
// state is account-wide and intentionally not scoped to any source.
export type EligibilitySource =
  | { kind: 'model'; modelId: string | undefined }
  | { kind: 'embedding' };

type UserGroupAttributionContextValue = {
  gate: (source: EligibilitySource, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => Promise<boolean>;
  // Lets a gate() caller retract its own not-yet-resolved request (e.g. on unmount) so it can
  // never later be resolved against a stale closure. No-ops if it already settled.
  abandon: (onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => void;
  getEligibleUserGroups: (source: EligibilitySource) => UserGroupAttributionOption[];
  pendingDecision: UserGroupAttributionPendingDecision | null;
  onSelect: (userGroupId: string) => Promise<void>;
  onDismiss: () => void;
  defaultUserGroupId: string | undefined;
  setDefaultUserGroupId: (userGroupId: string) => void;
  clearDefaultUserGroupId: () => void;
  // Account-wide groups/default for the idle (no pending decision) sidebar state — every
  // group with any AI provider access, regardless of which page/model is mounted.
  idleGroups: UserGroupAttributionOption[];
  idleDefaultUserGroupId: string | undefined;
  // The specific AI providers causing that overlap, so the sidebar can name them instead of
  // speaking generically about "models".
  overlappingAiProviders: OverlappingAiProvider[];
  // True whenever the user belongs to 2+ groups that each grant some AI provider access;
  // read by both the control and MenuBar (for its surrounding divider).
  isUserGroupAttributionControlVisible: boolean;
  // Set only when the user belongs to exactly 1 user group account-wide (unlike idleGroups,
  // not filtered by AI provider overlap) — drives the read-only single-group sidebar indicator.
  singleUserGroup: UserGroupAttributionOption | undefined;
  // Set when the user belongs to 2+ groups account-wide but none overlap in AI provider access —
  // drives the read-only "member of N groups" sidebar indicator.
  nonOverlappingUserGroups: UserGroupAttributionOption[] | undefined;
};

const UserGroupAttributionContext = createContext<UserGroupAttributionContextValue | null>(null);

export function UserGroupAttributionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: userGroupsData } = useGetUserGroups();
  const userGroups = useMemo(() => userGroupsData?.userGroups ?? [], [userGroupsData]);
  // A user in 0-1 groups can never need per-model/embedding narrowing — gate() and
  // idleGroups both collapse to that single group either way — so skip the fetches.
  const canNarrowByGroup = userGroups.length > 1;
  const { data: availableModelsData, isLoading: isAvailableModelsLoading, isError: isAvailableModelsError } = useGetAvailableModels({ enabled: canNarrowByGroup });
  const { data: embeddingProvidersData, isLoading: isEmbeddingProvidersLoading, isError: isEmbeddingProvidersError } = useGetEmbeddingEligibleAiProviders({ enabled: canNarrowByGroup });

  const [pendingDecision, setPendingDecision] = useState<UserGroupAttributionPendingDecision | null>(null);
  // Only the front request is ever shown (mirrored into pendingDecision); everything behind
  // it just waits its turn. A ref (not state) because gate() itself must read/write it
  // synchronously without waiting for a re-render.
  const queueRef = useRef<PendingGateRequest[]>([]);
  const [defaultUserGroupId, setDefaultUserGroupIdState] = useState<string | undefined>(undefined);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      setDefaultUserGroupIdState(readUserGroupAttributionPreference()?.userGroupId);
    }
  }, []);

  const setDefaultUserGroupId = useCallback((userGroupId: string) => {
    writeUserGroupAttributionPreference({ userGroupId });
    setDefaultUserGroupIdState(userGroupId);
  }, []);

  const clearDefaultUserGroupId = useCallback(() => {
    clearUserGroupAttributionPreference();
    setDefaultUserGroupIdState(undefined);
  }, []);

  const getEligibleUserGroups = useCallback((source: EligibilitySource): UserGroupAttributionOption[] => {
    if (source.kind === 'embedding') {
      // An errored query can't tell us which groups actually have embedding access — treat
      // it as "none confirmed eligible" rather than falling back to every group, which could
      // misattribute billing to a group with no real access.
      if (isEmbeddingProvidersError) {
        return [];
      }
      const eligibleAiProviderIds = embeddingProvidersData?.aiProviderIds;
      const eligibleGroups = eligibleAiProviderIds
        ? userGroups.filter((group) => group.aiProviderIds.some((id) => eligibleAiProviderIds.includes(id)))
        : userGroups;
      return eligibleGroups.map((group) => ({ id: group.id, label: group.label }));
    }

    if (source.modelId && isAvailableModelsError) {
      return [];
    }

    const aiProviderId = source.modelId
      ? availableModelsData?.availableModels.find((model) => model.id === source.modelId)?.aiProviderId
      : undefined;

    const eligibleGroups = aiProviderId
      ? userGroups.filter((group) => group.aiProviderIds.includes(aiProviderId))
      : userGroups;

    return eligibleGroups.map((group) => ({ id: group.id, label: group.label }));
  }, [userGroups, availableModelsData, embeddingProvidersData, isAvailableModelsError, isEmbeddingProvidersError]);

  // Account-wide group list for the idle sidebar state. Only groups that share an AI
  // provider with another of the user's groups qualify — a group with no overlap can
  // never be ambiguous for gate(), so it'd never usefully serve as a default.
  const getOverlappingEligibleGroups = useCallback((): UserGroupAttributionOption[] => {
    const groupsWithAccess = userGroups.filter((group) => group.aiProviderIds.length > 0);
    const overlappingGroups = groupsWithAccess.filter((group) => groupsWithAccess.some(
      (other) => other.id !== group.id && other.aiProviderIds.some((id) => group.aiProviderIds.includes(id)),
    ));
    return overlappingGroups.map((group) => ({ id: group.id, label: group.label }));
  }, [userGroups]);

  // Every AI provider granted by 2+ of the user's groups, named individually so the sidebar
  // can list them instead of just saying "models". Falls back to the raw id for
  // embeddings-only providers, which aren't named in getAvailableModels.
  const overlappingAiProviders = useMemo((): OverlappingAiProvider[] => {
    const groupsWithAccess = userGroups.filter((group) => group.aiProviderIds.length > 0);
    const providerGroupCounts = new Map<string, number>();
    groupsWithAccess.forEach((group) => {
      new Set(group.aiProviderIds).forEach((id) => {
        providerGroupCounts.set(id, (providerGroupCounts.get(id) ?? 0) + 1);
      });
    });

    return Array.from(providerGroupCounts.entries())
      .filter(([, groupCount]) => groupCount > 1)
      .map(([id]) => ({
        id,
        name: availableModelsData?.availableModels.find((model) => model.aiProviderId === id)?.providerLabel ?? id,
        groups: groupsWithAccess
          .filter((group) => group.aiProviderIds.includes(id))
          .map((group) => ({ id: group.id, label: group.label })),
      }));
  }, [userGroups, availableModelsData]);

  // Mirrors queueRef's new front (if any) into the state the modal actually renders from.
  const syncPendingDecisionToQueueFront = useCallback(() => {
    const front = queueRef.current[0];
    setPendingDecision(front ? { groups: front.groups } : null);
  }, []);

  // getEligibleUserGroups can't tell "no narrowing data" from "query still loading" — both
  // look like an absent id/list and fall back to every group. Queued as plain callbacks
  // (not a Promise) so the already-ready case in gate() stays synchronous.
  const readyWaitersRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    if (isAvailableModelsLoading || isEmbeddingProvidersLoading) {
      return;
    }
    readyWaitersRef.current.forEach((proceed) => proceed());
    readyWaitersRef.current = [];
  }, [isAvailableModelsLoading, isEmbeddingProvidersLoading]);

  // Lets abandon() cancel a gate() call still waiting on eligibility data, before it has
  // anything in queueRef to find.
  type AbortRecord = { cancelled: boolean };
  const abortRecordsRef = useRef(new Map<(userGroupId: string | undefined) => void | Promise<void>, AbortRecord>());

  // A deferred proceed() runs once the query resolves, in a later render than the one that
  // called gate() — it must read the freshest eligibility data at that point, not whatever
  // was captured in gate()'s closure back when the wait started.
  const latestRef = useRef({ getEligibleUserGroups, defaultUserGroupId });
  latestRef.current = { getEligibleUserGroups, defaultUserGroupId };

  const gate = useCallback((
    source: EligibilitySource,
    onSubmit: (userGroupId: string | undefined) => void | Promise<void>,
  ): Promise<boolean> => new Promise<boolean>((resolve, reject) => {
    const abortRecord: AbortRecord = { cancelled: false };
    abortRecordsRef.current.set(onSubmit, abortRecord);
    const clearAbortRecord = () => {
      if (abortRecordsRef.current.get(onSubmit) === abortRecord) {
        abortRecordsRef.current.delete(onSubmit);
      }
    };

    const settle = async (userGroupId: string | undefined) => {
      clearAbortRecord();
      try {
        await onSubmit(userGroupId);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    };

    const proceed = () => {
      if (abortRecord.cancelled) {
        clearAbortRecord();
        resolve(false);
        return;
      }

      const { getEligibleUserGroups: getEligibleUserGroupsNow, defaultUserGroupId: defaultUserGroupIdNow } = latestRef.current;
      const groups = getEligibleUserGroupsNow(source);

      if (groups.length <= 1) {
        settle(groups[0]?.id);
        return;
      }

      if (defaultUserGroupIdNow && groups.some((group) => group.id === defaultUserGroupIdNow)) {
        settle(defaultUserGroupIdNow);
        return;
      }

      // A second concurrent call (e.g. an unrelated gated action fired while another is
      // already awaiting a decision) queues behind the first instead of being dropped —
      // it becomes the next pendingDecision once the current one resolves or is dismissed.
      queueRef.current = [...queueRef.current, { groups, onSubmit, settle, cancel: () => { clearAbortRecord(); resolve(false); } }];
      if (queueRef.current.length === 1) {
        syncPendingDecisionToQueueFront();
      }
    };

    const isSourceDataLoading = source.kind === 'embedding' ? isEmbeddingProvidersLoading : isAvailableModelsLoading;
    if (canNarrowByGroup && isSourceDataLoading) {
      readyWaitersRef.current = [...readyWaitersRef.current, proceed];
    } else {
      proceed();
    }
  }), [canNarrowByGroup, isAvailableModelsLoading, isEmbeddingProvidersLoading, syncPendingDecisionToQueueFront]);

  // Lets a gate() caller retract its own request (waiting, queued, or pending) on unmount,
  // so it can never later resolve against a stale closure.
  const abandon = useCallback((onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => {
    const abortRecord = abortRecordsRef.current.get(onSubmit);
    if (abortRecord) {
      abortRecord.cancelled = true;
    }

    const request = queueRef.current.find((entry) => entry.onSubmit === onSubmit);
    if (!request) {
      return;
    }
    const wasFront = queueRef.current[0] === request;
    queueRef.current = queueRef.current.filter((entry) => entry !== request);
    if (wasFront) {
      syncPendingDecisionToQueueFront();
    }
    request.cancel();
  }, [syncPendingDecisionToQueueFront]);

  const onSelect = useCallback(async (userGroupId: string): Promise<void> => {
    setDefaultUserGroupId(userGroupId);
    const [current, ...rest] = queueRef.current;
    queueRef.current = rest;
    syncPendingDecisionToQueueFront();
    if (current) {
      await current.settle(userGroupId);
    }
  }, [setDefaultUserGroupId, syncPendingDecisionToQueueFront]);

  const onDismiss = useCallback(() => {
    const [current, ...rest] = queueRef.current;
    queueRef.current = rest;
    syncPendingDecisionToQueueFront();
    if (current) {
      current.cancel();
    }
  }, [syncPendingDecisionToQueueFront]);

  const idleGroups = useMemo(() => getOverlappingEligibleGroups(), [getOverlappingEligibleGroups]);

  const idleDefaultUserGroupId = useMemo(() => {
    if (!defaultUserGroupId) {
      return undefined;
    }
    return idleGroups.some((group) => group.id === defaultUserGroupId)
      ? defaultUserGroupId
      : undefined;
  }, [defaultUserGroupId, idleGroups]);

  const singleUserGroup = useMemo(
    () => (userGroups.length === 1 ? { id: userGroups[0].id, label: userGroups[0].label } : undefined),
    [userGroups],
  );

  // 2+ total groups, but none share AI provider access with another — every membership is
  // unambiguous, so this is also a read-only state (mutually exclusive with idleGroups/pendingDecision,
  // which both require 2+ groups that *do* share access).
  const nonOverlappingUserGroups = useMemo(
    () => (userGroups.length > 1 && idleGroups.length === 0
      ? userGroups.map((group) => ({ id: group.id, label: group.label }))
      : undefined),
    [userGroups, idleGroups],
  );

  // Every state below (single group, non-overlapping groups, overlapping/pending decision) is
  // read-only or interactive but always rendered — so this collapses to "belongs to any group".
  const isUserGroupAttributionControlVisible = userGroups.length > 0;

  const value = useMemo<UserGroupAttributionContextValue>(() => ({
    gate,
    abandon,
    getEligibleUserGroups,
    pendingDecision,
    onSelect,
    onDismiss,
    defaultUserGroupId,
    setDefaultUserGroupId,
    clearDefaultUserGroupId,
    idleGroups,
    idleDefaultUserGroupId,
    overlappingAiProviders,
    isUserGroupAttributionControlVisible,
    singleUserGroup,
    nonOverlappingUserGroups,
  }), [
    gate,
    abandon,
    getEligibleUserGroups,
    pendingDecision,
    onSelect,
    onDismiss,
    defaultUserGroupId,
    setDefaultUserGroupId,
    clearDefaultUserGroupId,
    idleGroups,
    idleDefaultUserGroupId,
    overlappingAiProviders,
    isUserGroupAttributionControlVisible,
    singleUserGroup,
    nonOverlappingUserGroups,
  ]);

  return (
    <UserGroupAttributionContext.Provider value={value}>
      {children}
    </UserGroupAttributionContext.Provider>
  );
}

export function useUserGroupAttributionContext(): UserGroupAttributionContextValue {
  const context = useContext(UserGroupAttributionContext);
  if (!context) {
    throw new Error('useUserGroupAttributionContext must be used within a UserGroupAttributionProvider');
  }
  return context;
}
