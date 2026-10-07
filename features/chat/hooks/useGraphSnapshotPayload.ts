import { useMemo } from 'react';

import { useChat } from '@/features/chat/providers/ChatProvider';

export type GraphSnapshotPayload = Readonly<{
  nodeIds: string[];
  documentIds: string[];
}>;

export default function useGraphSnapshotPayload(): GraphSnapshotPayload | undefined {
  const {
    useGraph,
    showKnowledgeGraph,
    graphDisplayedEntityIds,
    documentIds,
    graphHistoryPanelOpen,
    selectedGraphSnapshotId,
  } = useChat();

  return useMemo(() => {
    if (
      !useGraph ||
      !showKnowledgeGraph ||
      graphHistoryPanelOpen ||
      selectedGraphSnapshotId ||
      graphDisplayedEntityIds.length === 0
    ) {
      return undefined;
    }

    return {
      nodeIds: [...new Set(graphDisplayedEntityIds)],
      documentIds: [...documentIds],
    };
  }, [
    useGraph,
    showKnowledgeGraph,
    graphHistoryPanelOpen,
    selectedGraphSnapshotId,
    graphDisplayedEntityIds,
    documentIds,
  ]);
}
