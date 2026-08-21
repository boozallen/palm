import { rollbackCancelledBuild } from '@/features/graph-database/dal/rollbackCancelledBuild';
import db from '@/server/db';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';
import { deleteResolutionPairsForDocument } from '@/features/graph-database/dal/documentResolutionPairs';
import { reconcileIdentityClusterHubs } from '@/features/graph-database/services/reconcileIdentityClusterHubs';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
    graphMetadata: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/features/graph-database/dal/deleteGraphNodes', () => jest.fn());

jest.mock('@/features/graph-database/dal/documentResolutionPairs', () => ({
  deleteResolutionPairsForDocument: jest.fn(),
}));

jest.mock('@/features/graph-database/services/reconcileIdentityClusterHubs', () => ({
  reconcileIdentityClusterHubs: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockDeleteGraphNodes = deleteGraphNodes as jest.Mock;
const mockDeletePairs = deleteResolutionPairsForDocument as jest.Mock;
const mockReconcile = reconcileIdentityClusterHubs as jest.Mock;

describe('rollbackCancelledBuild', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteGraphNodes.mockResolvedValue(undefined);
    mockDeletePairs.mockResolvedValue(0);
    (mockDb.$executeRaw as unknown as jest.Mock).mockResolvedValue(undefined);
    mockReconcile.mockResolvedValue({});
    (mockDb.graphMetadata.update as jest.Mock).mockResolvedValue({});
  });

  it('incremental: deletes only extractDocumentIds and settles Completed with the rest', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({
      documentIds: ['a', 'b', 'c', 'x'],
    });

    await rollbackCancelledBuild({ graphId: 'graph-1', userId: 'user-1', extractDocumentIds: ['x'] });

    expect(mockDeleteGraphNodes).toHaveBeenCalledTimes(1);
    expect(mockDeleteGraphNodes).toHaveBeenCalledWith('x');
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockDeletePairs).toHaveBeenCalledTimes(1);
    expect(mockDeletePairs).toHaveBeenCalledWith('x');
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: ['a', 'b', 'c'],
        errorMessage: null,
      },
    });
  });

  it('cancel during resolution: both fully-extracted docs are still fully deleted (full undo)', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({
      documentIds: ['x', 'y'],
    });

    await rollbackCancelledBuild({ graphId: 'graph-1', userId: 'user-1', extractDocumentIds: ['x', 'y'] });

    expect(mockDeleteGraphNodes).toHaveBeenCalledTimes(2);
    expect(mockDeleteGraphNodes).toHaveBeenCalledWith('x');
    expect(mockDeleteGraphNodes).toHaveBeenCalledWith('y');
    // Pair rows written before the cancel landed (legitimately or as a
    // between-blocks no-op) are stale once the docs are gone.
    expect(mockDeletePairs).toHaveBeenCalledWith('x');
    expect(mockDeletePairs).toHaveBeenCalledWith('y');
    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Cancelled,
        documentIds: [],
        errorMessage: 'Build cancelled by user',
      },
    });
  });

  it('resolution-only run (extract []): no deletes, no hub reconcile, membership unchanged, Completed', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({
      documentIds: ['a', 'b'],
    });

    await rollbackCancelledBuild({ graphId: 'graph-1', userId: 'user-1', extractDocumentIds: [] });

    expect(mockDeleteGraphNodes).not.toHaveBeenCalled();
    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
    expect(mockDeletePairs).not.toHaveBeenCalled();
    expect(mockReconcile).not.toHaveBeenCalled();
    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: ['a', 'b'],
        errorMessage: null,
      },
    });
  });

  it('first-ever build: current == extract → Cancelled, documentIds []', async () => {
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({
      documentIds: ['x'],
    });

    await rollbackCancelledBuild({ graphId: 'graph-1', userId: 'user-1', extractDocumentIds: ['x'] });

    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Cancelled,
        documentIds: [],
        errorMessage: 'Build cancelled by user',
      },
    });
  });

  it('deleteGraphNodes throwing for one doc logs and continues to the rest, settle still runs', async () => {
    mockDeleteGraphNodes.mockImplementation((docId: string) => {
      if (docId === 'x') {
        return Promise.reject(new Error('Neo4j error'));
      }
      return Promise.resolve(undefined);
    });
    (mockDb.graphMetadata.findUnique as jest.Mock).mockResolvedValue({
      documentIds: ['x', 'y'],
    });

    await rollbackCancelledBuild({ graphId: 'graph-1', userId: 'user-1', extractDocumentIds: ['x', 'y'] });

    expect(mockDeleteGraphNodes).toHaveBeenCalledWith('x');
    expect(mockDeleteGraphNodes).toHaveBeenCalledWith('y');
    expect(mockDb.graphMetadata.update).toHaveBeenCalledWith({
      where: { graphId: 'graph-1' },
      data: {
        status: GraphBuildStatus.Cancelled,
        documentIds: [],
        errorMessage: 'Build cancelled by user',
      },
    });
  });
});
