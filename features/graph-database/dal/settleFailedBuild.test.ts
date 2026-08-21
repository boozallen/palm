import { settleFailedBuild } from '@/features/graph-database/dal/settleFailedBuild';
import db from '@/server/db';
import { getExtractedDocumentIds } from '@/features/graph-database/dal/getExtractedDocumentIds';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    graphMetadata: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/features/graph-database/dal/getExtractedDocumentIds', () => ({
  getExtractedDocumentIds: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockGetExtractedDocumentIds = getExtractedDocumentIds as jest.Mock;

describe('settleFailedBuild', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});
  });

  it('unfinished doc leaves membership; finished docs stay badged (Completed, errorMessage PRESERVED as the failure record)', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ documentIds: ['a', 'b', 'c'] });
    mockGetExtractedDocumentIds.mockResolvedValue(['a', 'b']); // 'c' unfinished

    await settleFailedBuild({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: ['c'],
      errorMessage: 'boom',
    });

    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: ['a', 'b'],
        errorMessage: 'boom',
      },
    });
  });

  it('doc finished before the crash stays in membership (kept for resume)', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ documentIds: ['a', 'b', 'c'] });
    mockGetExtractedDocumentIds.mockResolvedValue(['a', 'b', 'c']); // all finished

    await settleFailedBuild({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: ['c'],
      errorMessage: 'boom',
    });

    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: ['a', 'b', 'c'],
        errorMessage: 'boom',
      },
    });
  });

  it('first build, nothing extracted → Failed with errorMessage passed through', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ documentIds: ['x'] });
    mockGetExtractedDocumentIds.mockResolvedValue([]);

    await settleFailedBuild({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: ['x'],
      errorMessage: 'LLM timeout',
    });

    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Failed,
        errorMessage: 'LLM timeout',
      },
    });
  });

  it('resolution-only run (extract []): membership unchanged, Completed', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({ documentIds: ['a', 'b'] });
    mockGetExtractedDocumentIds.mockResolvedValue([]);

    await settleFailedBuild({
      graphId: 'graph-1',
      userId: 'user-1',
      extractDocumentIds: [],
      errorMessage: 'resolution boom',
    });

    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: ['a', 'b'],
        errorMessage: 'resolution boom',
      },
    });
  });
});
