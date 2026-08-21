import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import { getEdgesBetween } from '@/features/graph-database/dal/getEdgesBetween';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database/dal/getEdgesBetween');

const mockGetEdgesBetween = getEdgesBetween as jest.MockedFunction<typeof getEdgesBetween>;

describe('chat.graphDatabase.getEdgesBetween', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createCaller = (userId: string, accessibleIds: string[] = ['doc-1']) => {
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

  it('should return edges between new and existing nodes', async () => {
    const caller = createCaller('user-123');

    mockGetEdgesBetween.mockResolvedValue({
      edges: [
        { from: 1, to: 2, label: 'RELATED', type: 'RELATED', properties: {} },
      ],
      metadata: { edgeCount: 1 },
    });

    const result = await caller.graphDatabase.getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [1],
      existingNodeNeoIds: [2],
    });

    expect(result.edges).toHaveLength(1);
    expect(result.metadata.edgeCount).toBe(1);
    expect(mockGetEdgesBetween).toHaveBeenCalledWith({
      documentIds: ['doc-1'],
      newNodeNeoIds: [1],
      existingNodeNeoIds: [2],
    });
  });

  it('should throw sanitized error on DAL failure', async () => {
    const caller = createCaller('user-123');

    mockGetEdgesBetween.mockRejectedValue(new Error('Neo4j connection failed'));

    await expect(
      caller.graphDatabase.getEdgesBetween({
        documentIds: ['doc-1'],
        newNodeNeoIds: [1],
        existingNodeNeoIds: [2],
      })
    ).rejects.toThrow('Failed to fetch edges between nodes');
  });

  it('should reject when document is not accessible', async () => {
    const caller = createCaller('user-123', ['doc-other']);

    await expect(
      caller.graphDatabase.getEdgesBetween({
        documentIds: ['doc-1'],
        newNodeNeoIds: [1],
        existingNodeNeoIds: [2],
      })
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetEdgesBetween).not.toHaveBeenCalled();
  });
});
