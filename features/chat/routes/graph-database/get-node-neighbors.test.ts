import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import { getNodeNeighbors } from '@/features/graph-database/dal/getNodeNeighbors';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database/dal/getNodeNeighbors');

const mockGetNodeNeighbors = getNodeNeighbors as jest.MockedFunction<typeof getNodeNeighbors>;

describe('chat.graphDatabase.getNodeNeighbors', () => {
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

  const mockNeighborsResult = {
    sourceNode: {
      id: 1,
      label: 'Source',
      labels: ['Entity'],
      properties: {},
      group: 'Entity',
    },
    neighbors: [
      { id: 2, label: 'N1', labels: ['Entity'], properties: {}, group: 'Entity' },
      { id: 3, label: 'N2', labels: ['Concept'], properties: {}, group: 'Concept' },
    ],
    edges: [
      { from: 1, to: 2, label: 'RELATED', type: 'RELATED', properties: {} },
    ],
    metadata: { sourceNodeId: 1, neighborCount: 2, edgeCount: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns neighbors for accessible documents', async () => {
    mockGetNodeNeighbors.mockResolvedValue(mockNeighborsResult);

    const caller = createCaller('user-123');
    const result = await caller.graphDatabase.getNodeNeighbors({
      documentIds: ['doc-1'],
      nodeNeoId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.neighbors).toHaveLength(2);
    expect(mockGetNodeNeighbors).toHaveBeenCalledWith({
      documentIds: ['doc-1'],
      nodeNeoId: 1,
    });
  });

  it('rejects when documentId is not accessible', async () => {
    const caller = createCaller('user-123', ['doc-other']);

    await expect(
      caller.graphDatabase.getNodeNeighbors({
        documentIds: ['doc-1'],
        nodeNeoId: 1,
      }),
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetNodeNeighbors).not.toHaveBeenCalled();
  });

  it('wraps DAL errors with a generic failure message', async () => {
    mockGetNodeNeighbors.mockRejectedValue(new Error('neo4j unreachable'));

    const caller = createCaller('user-123');

    await expect(
      caller.graphDatabase.getNodeNeighbors({
        documentIds: ['doc-1'],
        nodeNeoId: 1,
      }),
    ).rejects.toThrow('Failed to get node neighbors');
  });
});
