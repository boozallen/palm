import { useCallback, useEffect, useRef } from 'react';

import { useUserGroupAttributionContext } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';

export interface UseUserGroupAttributionResult {
  // Resolves the user group to attribute an action to: silently, if the sticky default
  // is eligible for modelId, otherwise sets pendingDecision to force a choice. Resolves
  // `true` once attributed, `false` if the decision was dismissed without choosing.
  gate: (modelId: string | undefined, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => Promise<boolean>;
}

export function useUserGroupAttribution(): UseUserGroupAttributionResult {
  const context = useUserGroupAttributionContext();
  const contextRef = useRef(context);
  contextRef.current = context;

  // Tracks this hook instance's own not-yet-resolved gate() calls so they can be abandoned
  // if this component unmounts before the user answers - otherwise a later resolution would
  // invoke a stale closure (e.g. starting a job) for a page the user has already left.
  const pendingSubmitsRef = useRef(new Set<(userGroupId: string | undefined) => void | Promise<void>>());

  useEffect(() => () => {
    pendingSubmitsRef.current.forEach((onSubmit) => contextRef.current.abandon(onSubmit));
    pendingSubmitsRef.current.clear();
  }, []);

  const gate = useCallback((
    modelId: string | undefined,
    onSubmit: (userGroupId: string | undefined) => void | Promise<void>,
  ) => {
    const submitOnce: (userGroupId: string | undefined) => void | Promise<void> = (userGroupId) => onSubmit(userGroupId);
    pendingSubmitsRef.current.add(submitOnce);
    return context.gate({ kind: 'model', modelId }, submitOnce).finally(() => {
      pendingSubmitsRef.current.delete(submitOnce);
    });
  }, [context]);

  return { gate };
}
