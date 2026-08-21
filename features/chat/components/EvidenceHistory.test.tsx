import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EvidenceHistory from './EvidenceHistory';
import useGetMessages from '@/features/chat/api/get-messages';
import { renderWrapper } from '@/test/test-utils';

const mockRestoreEvidence = jest.fn();
const mockSetScrollToMessageId = jest.fn();
let mockActiveEvidenceMessageId: string | null = null;

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: () => ({
    chatId: 'chat-1',
    activeEvidenceMessageId: mockActiveEvidenceMessageId,
    restoreEvidence: mockRestoreEvidence,
    setScrollToMessageId: mockSetScrollToMessageId,
  }),
}));

jest.mock('@/features/chat/api/get-messages');

const evidence = (nodes: number, edges: number) => ({
  kind: 'evidence',
  query: 'Answer evidence',
  generatedCypher: '',
  rowCount: nodes,
  rows: [],
  nodeMapping: [],
  graphData: {
    nodes: Array.from({ length: nodes }, (_, i) => ({
      id: i, label: `n${i}`, labels: [], properties: {}, group: 'Entity', isAnchor: false,
    })),
    edges: Array.from({ length: edges }, () => ({
      from: 0, to: 1, label: 'R', type: 'R', properties: {}, isShortestPath: false,
    })),
  },
});

const messages = [
  { id: 'u1', role: 'user', content: 'first question', messagedAt: new Date('2026-06-11T01:00:00Z'), graphSearchResult: null },
  { id: 'a1', role: 'assistant', content: 'answer 1', messagedAt: new Date('2026-06-11T01:00:05Z'), graphSearchResult: [evidence(3, 2)] },
  { id: 'u2', role: 'user', content: 'second question', messagedAt: new Date('2026-06-11T01:01:00Z'), graphSearchResult: null },
  { id: 'a2', role: 'assistant', content: 'second answer', messagedAt: new Date('2026-06-11T01:01:05Z'), graphSearchResult: [evidence(5, 4)] },
];

describe('EvidenceHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveEvidenceMessageId = null;
    (useGetMessages as jest.Mock).mockReturnValue({ data: { messages } });
  });

  it('lists one entry per evidence answer (preceding question + node/edge counts)', () => {
    renderWrapper(<EvidenceHistory />);

    expect(screen.getByText('first question')).toBeInTheDocument();
    expect(screen.getByText('second question')).toBeInTheDocument();
    expect(screen.getByText('3 nodes')).toBeInTheDocument();
    expect(screen.getByText('2 edges')).toBeInTheDocument();
    expect(screen.getByText('5 nodes')).toBeInTheDocument();
    expect(screen.getByText('4 edges')).toBeInTheDocument();
  });

  it('restores the clicked answer as active and scrolls the chat to its question', async () => {
    const user = userEvent.setup();
    renderWrapper(<EvidenceHistory />);

    await user.click(screen.getByText('first question'));
    expect(mockRestoreEvidence).toHaveBeenCalledWith('a1');
    expect(mockSetScrollToMessageId).toHaveBeenCalledWith('u1');
  });

  it('marks the latest answer Active by default (no override)', () => {
    renderWrapper(<EvidenceHistory />);

    expect(screen.getAllByText('Active')).toHaveLength(1);
    const latestRow = screen.getByText('second question').closest('button') as HTMLElement;
    expect(within(latestRow).getByText('Active')).toBeInTheDocument();
  });

  it('marks the restored (override) answer Active', () => {
    mockActiveEvidenceMessageId = 'a1';
    renderWrapper(<EvidenceHistory />);

    expect(screen.getAllByText('Active')).toHaveLength(1);
    const restoredRow = screen.getByText('first question').closest('button') as HTMLElement;
    expect(within(restoredRow).getByText('Active')).toBeInTheDocument();
  });

  it('shows an empty state when there are no evidence answers', () => {
    (useGetMessages as jest.Mock).mockReturnValue({ data: { messages: [] } });
    renderWrapper(<EvidenceHistory />);

    expect(screen.getByText(/No graph answers yet/)).toBeInTheDocument();
  });
});
