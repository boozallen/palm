import getSnapshotGraph from '@/features/chat/dal/getSnapshotGraph';
import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/server/db', () => ({
  graphSnapshot: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/expandIdentityClusters');

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockExpandIdentityClusters = expandIdentityClusters as jest.MockedFunction<
  typeof expandIdentityClusters
>;

const asAccessibleDocIds = (ids: string[]): AccessibleDocIds => new Set(ids) as unknown as AccessibleDocIds;

describe('getSnapshotGraph', () => {
  const mockGraphDb = { run: jest.fn() };
  const baseSnapshot = {
    id: 'snap-1',
    chatMessageId: 'msg-1',
    nodeIds: ['e1', 'e2'],
    documentIds: ['doc-1'],
    positions: null,
    createdAt: new Date('2026-01-01'),
    message: { content: 'What is FedRAMP?', chat: {} },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    mockExpandIdentityClusters.mockResolvedValue(new Map());
  });

  it('returns an empty graph without querying Neo4j when the snapshot has no nodes', async () => {
    (db.graphSnapshot.findUnique as jest.Mock).mockResolvedValue({ ...baseSnapshot, nodeIds: [] });

    const result = await getSnapshotGraph({
      snapshotId: 'snap-1',
      accessibleDocIds: asAccessibleDocIds(['doc-1']),
    });

    expect(result.nodes).toEqual([]);
    expect(mockGraphDb.run).not.toHaveBeenCalled();
  });

  it('synthesizes an IDENTITY edge between co-cluster nodes with no direct edge', async () => {
    (db.graphSnapshot.findUnique as jest.Mock).mockResolvedValue(baseSnapshot);
    mockGraphDb.run.mockImplementation(async (query: string) => {
      if (query.includes('nodeLabels')) {
        return {
          records: [
            {
              get: (k: string) =>
                ({
                  neoId: 1,
                  nodeLabels: ['Entity'],
                  props: { id: 'e1', name: 'FedRAMP Compliance' },
                } as Record<string, unknown>)[k],
            },
            {
              get: (k: string) =>
                ({
                  neoId: 2,
                  nodeLabels: ['Entity'],
                  props: { id: 'e2', name: 'FedRAMP compliance' },
                } as Record<string, unknown>)[k],
            },
          ],
        };
      }
      // edgesQuery — no direct edge between e1 and e2
      return { records: [] };
    });
    mockExpandIdentityClusters.mockResolvedValue(new Map([['e1', ['e1', 'e2']]]));

    const result = await getSnapshotGraph({
      snapshotId: 'snap-1',
      accessibleDocIds: asAccessibleDocIds(['doc-1']),
    });

    expect(mockExpandIdentityClusters).toHaveBeenCalledWith(['e1', 'e2'], ['doc-1']);
    expect(result.edges).toEqual([
      { from: 1, to: 2, label: 'IDENTITY', type: 'IDENTITY', properties: {}, isShortestPath: false },
    ]);
  });

  it('does not duplicate an edge that already exists directly', async () => {
    (db.graphSnapshot.findUnique as jest.Mock).mockResolvedValue(baseSnapshot);
    mockGraphDb.run.mockImplementation(async (query: string) => {
      if (query.includes('nodeLabels')) {
        return {
          records: [
            { get: (k: string) => ({ neoId: 1, nodeLabels: ['Entity'], props: { id: 'e1' } } as Record<string, unknown>)[k] },
            { get: (k: string) => ({ neoId: 2, nodeLabels: ['Entity'], props: { id: 'e2' } } as Record<string, unknown>)[k] },
          ],
        };
      }
      return {
        records: [
          {
            get: (k: string) =>
              ({ rType: 'RELATED', rProps: {}, rFromNeoId: 1, rToNeoId: 2 } as Record<string, unknown>)[k],
          },
        ],
      };
    });
    mockExpandIdentityClusters.mockResolvedValue(new Map([['e1', ['e1', 'e2']]]));

    const result = await getSnapshotGraph({
      snapshotId: 'snap-1',
      accessibleDocIds: asAccessibleDocIds(['doc-1']),
    });

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('RELATED');
  });

  it('skips cluster expansion entirely for a single-node snapshot', async () => {
    (db.graphSnapshot.findUnique as jest.Mock).mockResolvedValue({ ...baseSnapshot, nodeIds: ['e1'] });
    mockGraphDb.run.mockImplementation(async (query: string) => {
      if (query.includes('nodeLabels')) {
        return {
          records: [
            { get: (k: string) => ({ neoId: 1, nodeLabels: ['Entity'], props: { id: 'e1' } } as Record<string, unknown>)[k] },
          ],
        };
      }
      return { records: [] };
    });

    const result = await getSnapshotGraph({
      snapshotId: 'snap-1',
      accessibleDocIds: asAccessibleDocIds(['doc-1']),
    });

    expect(mockExpandIdentityClusters).not.toHaveBeenCalled();
    expect(result.edges).toEqual([]);
  });
});
