import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import { getNodeNeighborCount } from '@/features/graph-database/dal/getNodeNeighborCount';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database/dal/getNodeNeighborCount');

const mockGetNodeNeighborCount = getNodeNeighborCount as jest.MockedFunction<typeof getNodeNeighborCount>;

describe('chat.graphDatabase.getNodeNeighborCount', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return neighbor count for a node', async () => {
    const caller = createCaller('user-123');

    mockGetNodeNeighborCount.mockResolvedValue({
      totalNeighbors: 8,
    });

    const result = await caller.graphDatabase.getNodeNeighborCount({
      documentIds: ['doc-1', 'doc-2'],
      nodeNeoId: 100,
    });

    expect(result.totalNeighbors).toBe(8);
    expect(mockGetNodeNeighborCount).toHaveBeenCalledWith({
      documentIds: ['doc-1', 'doc-2'],
      nodeNeoId: 100,
    });
  });

  it('should return 0 when node has no neighbors', async () => {
    const caller = createCaller('user-123');

    mockGetNodeNeighborCount.mockResolvedValue({
      totalNeighbors: 0,
    });

    const result = await caller.graphDatabase.getNodeNeighborCount({
      documentIds: ['doc-1'],
      nodeNeoId: 300,
    });

    expect(result.totalNeighbors).toBe(0);
  });

  it('should propagate errors from DAL', async () => {
    const caller = createCaller('user-123');

    mockGetNodeNeighborCount.mockRejectedValue(new Error('Database connection failed'));

    await expect(
      caller.graphDatabase.getNodeNeighborCount({
        documentIds: ['doc-1'],
        nodeNeoId: 400,
      })
    ).rejects.toThrow('Database connection failed');
  });

  it('should reject when document is not accessible', async () => {
    const caller = createCaller('user-123', ['doc-other']);

    await expect(
      caller.graphDatabase.getNodeNeighborCount({
        documentIds: ['doc-1'],
        nodeNeoId: 100,
      })
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetNodeNeighborCount).not.toHaveBeenCalled();
  });
});
