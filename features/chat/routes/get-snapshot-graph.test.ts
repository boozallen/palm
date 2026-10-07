import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';
import getSnapshotGraph from '@/features/chat/dal/getSnapshotGraph';
import getGraphSnapshotMetadata from '@/features/chat/dal/getGraphSnapshotMetadata';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/chat/dal/getSnapshotGraph');
jest.mock('@/features/chat/dal/getGraphSnapshotMetadata');

const mockGetSnapshotGraph = getSnapshotGraph as jest.MockedFunction<typeof getSnapshotGraph>;
const mockGetGraphSnapshotMetadata =
  getGraphSnapshotMetadata as jest.MockedFunction<typeof getGraphSnapshotMetadata>;

describe('chat.getSnapshotGraph', () => {
  const mockUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockSnapshotId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockChatMessageId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const mockDocAccessible = 'doc-accessible';
  const mockDocInaccessible = 'doc-inaccessible';

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createCaller = (params: {
    userId?: string;
    accessibleIds?: string[];
  } = {}) => {
    const { userId = mockUserId, accessibleIds = [mockDocAccessible] } = params;
    const ctx = {
      userId,
      logger: mockLogger,
      getAccessibleDocIds: jest.fn().mockResolvedValue(
        new Set(accessibleIds) as unknown as AccessibleDocIds,
      ),
    } as unknown as ContextType;

    return chatRouter.createCaller(ctx);
  };

  const mockSnapshotResult = {
    nodes: [],
    edges: [],
    metadata: {
      nodeCount: 0,
      edgeCount: 0,
      documentIds: [mockDocAccessible],
      nodeIds: [],
    },
    snapshot: {
      id: mockSnapshotId,
      chatMessageId: mockChatMessageId,
      nodeIds: [],
      documentIds: [mockDocAccessible],
      positions: null,
      createdAt: new Date(),
      questionContent: 'What is in this document?',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGraphSnapshotMetadata.mockResolvedValue({
      snapshotId: mockSnapshotId,
      documentIds: [mockDocAccessible],
      chatUserId: mockUserId,
    });
    mockGetSnapshotGraph.mockResolvedValue(mockSnapshotResult);
  });

  it('returns snapshot graph when caller owns the snapshot and docs are accessible', async () => {
    const caller = createCaller();

    const result = await caller.getSnapshotGraph({ snapshotId: mockSnapshotId });

    expect(mockGetGraphSnapshotMetadata).toHaveBeenCalledWith(mockSnapshotId);
    expect(mockGetSnapshotGraph).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: mockSnapshotId }),
    );
    expect(result.snapshot.id).toBe(mockSnapshotId);
  });

  it('throws NotFound when snapshot does not exist', async () => {
    mockGetGraphSnapshotMetadata.mockResolvedValue(null);
    const caller = createCaller();

    await expect(
      caller.getSnapshotGraph({ snapshotId: mockSnapshotId }),
    ).rejects.toThrow('Snapshot not found');

    expect(mockGetSnapshotGraph).not.toHaveBeenCalled();
  });

  it('throws NotFound when snapshot belongs to a different user', async () => {
    mockGetGraphSnapshotMetadata.mockResolvedValue({
      snapshotId: mockSnapshotId,
      documentIds: [mockDocAccessible],
      chatUserId: 'someone-else',
    });
    const caller = createCaller();

    await expect(
      caller.getSnapshotGraph({ snapshotId: mockSnapshotId }),
    ).rejects.toThrow('Snapshot not found');

    expect(mockGetSnapshotGraph).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the snapshot references a doc the caller cannot access', async () => {
    mockGetGraphSnapshotMetadata.mockResolvedValue({
      snapshotId: mockSnapshotId,
      documentIds: [mockDocInaccessible],
      chatUserId: mockUserId,
    });
    const caller = createCaller({ accessibleIds: [mockDocAccessible] });

    await expect(
      caller.getSnapshotGraph({ snapshotId: mockSnapshotId }),
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetSnapshotGraph).not.toHaveBeenCalled();
  });

  it('loads snapshot metadata before validating document access', async () => {
    // Ordering matters: the route cannot know which docIds to validate without first
    // reading the snapshot. If access validation ran first, this would throw before
    // we ever consulted getGraphSnapshotMetadata for the doc list.
    const ctxAccessibleDocIds = jest.fn().mockResolvedValue(
      new Set([mockDocAccessible]) as unknown as AccessibleDocIds,
    );
    const ctx = {
      userId: mockUserId,
      logger: mockLogger,
      getAccessibleDocIds: ctxAccessibleDocIds,
    } as unknown as ContextType;

    const caller = chatRouter.createCaller(ctx);
    await caller.getSnapshotGraph({ snapshotId: mockSnapshotId });

    const metadataCallOrder = mockGetGraphSnapshotMetadata.mock.invocationCallOrder[0];
    const accessCheckCallOrder = ctxAccessibleDocIds.mock.invocationCallOrder[0];
    expect(metadataCallOrder).toBeLessThan(accessCheckCallOrder);
  });
});
