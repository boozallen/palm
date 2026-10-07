import { renderHook } from '@testing-library/react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGraphSnapshotPayload from './useGraphSnapshotPayload';

jest.mock('@/features/chat/providers/ChatProvider');

const mockUseChat = useChat as jest.Mock;

const activeGraphState = {
  useGraph: true,
  showKnowledgeGraph: true,
  graphDisplayedEntityIds: ['node-1', 'node-2', 'node-1'],
  documentIds: ['doc-1', 'doc-2'],
  graphHistoryPanelOpen: false,
  selectedGraphSnapshotId: null,
};

describe('useGraphSnapshotPayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChat.mockReturnValue(activeGraphState);
  });

  it('returns deduplicated visible node IDs and current document IDs', () => {
    const { result } = renderHook(() => useGraphSnapshotPayload());

    expect(result.current).toEqual({
      nodeIds: ['node-1', 'node-2'],
      documentIds: ['doc-1', 'doc-2'],
    });
    expect(result.current?.documentIds).not.toBe(activeGraphState.documentIds);
  });

  it.each([
    ['graph mode is off', { useGraph: false }],
    ['the graph pane is closed', { showKnowledgeGraph: false }],
    ['history is open', { graphHistoryPanelOpen: true }],
    ['a saved snapshot is open', { selectedGraphSnapshotId: 'snapshot-1' }],
    ['the canvas is empty', { graphDisplayedEntityIds: [] }],
  ])('returns undefined when %s', (_condition, overrides) => {
    mockUseChat.mockReturnValue({ ...activeGraphState, ...overrides });

    const { result } = renderHook(() => useGraphSnapshotPayload());

    expect(result.current).toBeUndefined();
  });
});
