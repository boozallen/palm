import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import { findShortestPathBetweenNodes } from '@/features/graph-database/dal/findShortestPathBetweenNodes';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database/dal/findShortestPathBetweenNodes');

const mockFindShortestPathBetweenNodes = findShortestPathBetweenNodes as jest.MockedFunction<
  typeof findShortestPathBetweenNodes
>;

describe('chat.graphDatabase.findShortestPath', () => {
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

  const mockPathsResult = {
    paths: [
      {
        startNeoId: 1,
        endNeoId: 2,
        nodes: [
          { id: 1, label: 'A', labels: ['Entity'], properties: {}, group: 'Entity' },
          { id: 2, label: 'B', labels: ['Entity'], properties: {}, group: 'Entity' },
        ],
        edges: [{ from: 1, to: 2, label: 'RELATED', type: 'RELATED', properties: {} }],
      },
    ],
    noPathPairs: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paths for accessible documents', async () => {
    mockFindShortestPathBetweenNodes.mockResolvedValue(mockPathsResult);

    const caller = createCaller('user-123');
    const result = await caller.graphDatabase.findShortestPath({
      documentIds: ['doc-1'],
      nodeNeoIds: [1, 2],
    });

    expect(result.paths).toHaveLength(1);
    expect(result.noPathPairs).toHaveLength(0);
    expect(mockFindShortestPathBetweenNodes).toHaveBeenCalledWith({
      documentIds: ['doc-1'],
      nodeNeoIds: [1, 2],
    });
  });

  it('reports no-path pairs when nodes are unreachable', async () => {
    mockFindShortestPathBetweenNodes.mockResolvedValue({
      paths: [],
      noPathPairs: [{ startNeoId: 1, endNeoId: 2 }],
    });

    const caller = createCaller('user-123');
    const result = await caller.graphDatabase.findShortestPath({
      documentIds: ['doc-1'],
      nodeNeoIds: [1, 2],
    });

    expect(result.paths).toHaveLength(0);
    expect(result.noPathPairs).toEqual([{ startNeoId: 1, endNeoId: 2 }]);
  });

  it('rejects when documentId is not accessible', async () => {
    const caller = createCaller('user-123', ['doc-other']);

    await expect(
      caller.graphDatabase.findShortestPath({
        documentIds: ['doc-1'],
        nodeNeoIds: [1, 2],
      }),
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockFindShortestPathBetweenNodes).not.toHaveBeenCalled();
  });

  it('wraps DAL errors with a generic failure message', async () => {
    mockFindShortestPathBetweenNodes.mockRejectedValue(new Error('neo4j unreachable'));

    const caller = createCaller('user-123');

    await expect(
      caller.graphDatabase.findShortestPath({
        documentIds: ['doc-1'],
        nodeNeoIds: [1, 2],
      }),
    ).rejects.toThrow('Failed to find shortest paths');
  });
});
