import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import { getChatNetwork } from '@/features/graph-database/dal/getChatNetwork';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database/dal/getChatNetwork');

const mockGetChatNetwork = getChatNetwork as jest.MockedFunction<typeof getChatNetwork>;

describe('chat.graphDatabase.getNetwork', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createCaller = (userId: string, accessibleIds: string[] = ['doc-1', 'doc-2']) => {
    const ctx = {
      userId,
      logger: mockLogger,
      getAccessibleDocIds: jest.fn().mockResolvedValue(
        new Set(accessibleIds) as unknown as AccessibleDocIds,
      ),
    } as unknown as ContextType;

    return chatRouter.createCaller(ctx);
  };

  const mockNetworkResult = {
    nodes: [
      { id: 1, label: 'A', labels: ['Entity'], properties: {}, group: 'Entity' },
    ],
    edges: [],
    metadata: {
      nodeCount: 1,
      edgeCount: 0,
      limit: 100,
      documentIds: ['doc-1'],
      filters: { labels: [], relationships: [] },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns network data for accessible documents', async () => {
    mockGetChatNetwork.mockResolvedValue(mockNetworkResult);

    const caller = createCaller('user-123');
    const result = await caller.graphDatabase.getNetwork({
      documentIds: ['doc-1'],
      limit: 100,
      labels: [],
      relationships: [],
    });

    expect(result.success).toBe(true);
    expect(result.network.nodes).toHaveLength(1);
    expect(mockGetChatNetwork).toHaveBeenCalledWith({
      documentIds: ['doc-1'],
      limit: 100,
      labels: [],
      relationships: [],
    });
  });

  it('rejects when any documentId is not accessible', async () => {
    const caller = createCaller('user-123', ['doc-other']);

    await expect(
      caller.graphDatabase.getNetwork({
        documentIds: ['doc-1'],
        limit: 100,
        labels: [],
        relationships: [],
      }),
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetChatNetwork).not.toHaveBeenCalled();
  });

  it('wraps DAL errors with a generic failure message', async () => {
    mockGetChatNetwork.mockRejectedValue(new Error('neo4j unreachable'));

    const caller = createCaller('user-123');

    await expect(
      caller.graphDatabase.getNetwork({
        documentIds: ['doc-1'],
        limit: 100,
        labels: [],
        relationships: [],
      }),
    ).rejects.toThrow('Failed to query chat network');
  });
});
