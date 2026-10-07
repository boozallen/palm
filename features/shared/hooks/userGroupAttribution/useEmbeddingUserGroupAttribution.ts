import { useCallback, useEffect, useRef } from 'react';

import { useUserGroupAttributionContext } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';

export interface UseEmbeddingUserGroupAttributionResult {
  gate: (onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => Promise<boolean>;
}

// Document upload has no user-chosen model to gate on — access is scoped to the
// designated embeddings-only model instead of useUserGroupAttribution's per-model lookup.
export function useEmbeddingUserGroupAttribution(): UseEmbeddingUserGroupAttributionResult {
  const context = useUserGroupAttributionContext();
  const contextRef = useRef(context);
  contextRef.current = context;

  // Tracks this hook instance's own not-yet-resolved gate() calls so they can be abandoned
  // if this component unmounts before the user answers - otherwise a later resolution would
  // invoke a stale closure for a page the user has already left.
  const pendingSubmitsRef = useRef(new Set<(userGroupId: string | undefined) => void | Promise<void>>());

  useEffect(() => () => {
    pendingSubmitsRef.current.forEach((onSubmit) => contextRef.current.abandon(onSubmit));
    pendingSubmitsRef.current.clear();
  }, []);

  const gate = useCallback((
    onSubmit: (userGroupId: string | undefined) => void | Promise<void>,
  ) => {
    const submitOnce: (userGroupId: string | undefined) => void | Promise<void> = (userGroupId) => onSubmit(userGroupId);
    pendingSubmitsRef.current.add(submitOnce);
    return context.gate({ kind: 'embedding' }, submitOnce).finally(() => {
      pendingSubmitsRef.current.delete(submitOnce);
    });
  }, [context]);

  return { gate };
}
