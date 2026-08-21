import {
  createCluster,
  bulkCreateClusters,
  attachToCluster,
  mergeClusters,
  getHubIdsForMembers,
} from '@/features/graph-database/dal/identityClusterHubs';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<
  typeof getGraphDatabaseSource
>;

function record(fields: Record<string, unknown>) {
  return { get: (key: string) => fields[key] };
}

describe('identityClusterHubs', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createCluster', () => {
    it('creates a hub and returns its id', async () => {
      const run = jest.fn().mockResolvedValue({ records: [record({ hubId: 'hub-1' })] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      const hubId = await createCluster(['e1', 'e2'], 'user-1');

      expect(hubId).toBe('hub-1');
      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (h:IdentityCluster'),
        { memberIds: ['e1', 'e2'], userId: 'user-1' }
      );
    });

    it('throws for an empty member list without calling the database', async () => {
      const run = jest.fn();
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await expect(createCluster([], 'user-1')).rejects.toThrow(
        'createCluster requires at least one member id'
      );
      expect(run).not.toHaveBeenCalled();
    });

    it('throws a sanitized error when the write fails', async () => {
      const run = jest.fn().mockRejectedValue(new Error('connection reset'));
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await expect(createCluster(['e1'], 'user-1')).rejects.toThrow(
        'Failed to create identity cluster'
      );
    });
  });

  describe('bulkCreateClusters', () => {
    it('returns 0 for an empty cluster list without calling the database', async () => {
      const run = jest.fn();
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await expect(bulkCreateClusters([], 'user-1')).resolves.toBe(0);
      expect(run).not.toHaveBeenCalled();
    });

    it('creates all clusters in one statement when under the chunk size', async () => {
      const run = jest.fn().mockResolvedValue({ records: [record({ hubsCreated: 2 })] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      const created = await bulkCreateClusters(
        [{ memberIds: ['a', 'b'] }, { memberIds: ['c', 'd', 'e'] }],
        'user-1'
      );

      expect(created).toBe(2);
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith(expect.any(String), {
        clusters: [{ memberIds: ['a', 'b'] }, { memberIds: ['c', 'd', 'e'] }],
        userId: 'user-1',
      });
    });

    it('chunks large cluster lists and sums the created counts', async () => {
      const run = jest
        .fn()
        .mockResolvedValueOnce({ records: [record({ hubsCreated: 500 })] })
        .mockResolvedValueOnce({ records: [record({ hubsCreated: 500 })] })
        .mockResolvedValueOnce({ records: [record({ hubsCreated: 1 })] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      const clusters = Array.from({ length: 1001 }, (_, i) => ({ memberIds: [`a${i}`, `b${i}`] }));
      const created = await bulkCreateClusters(clusters, 'user-1');

      expect(created).toBe(1001);
      expect(run).toHaveBeenCalledTimes(3);
      expect(run.mock.calls[0][1].clusters).toHaveLength(500);
      expect(run.mock.calls[1][1].clusters).toHaveLength(500);
      expect(run.mock.calls[2][1].clusters).toHaveLength(1);
    });

    it('throws a sanitized error when the write fails', async () => {
      const run = jest.fn().mockRejectedValue(new Error('bolt exploded'));
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await expect(bulkCreateClusters([{ memberIds: ['a', 'b'] }], 'user-1')).rejects.toThrow(
        'Failed to bulk-create identity clusters'
      );
    });
  });

  describe('attachToCluster', () => {
    it('merges the node onto the hub', async () => {
      const run = jest.fn().mockResolvedValue({ records: [] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await attachToCluster('e3', 'hub-1');

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n)-[:IN_CLUSTER]->(h)'),
        { nodeId: 'e3', hubId: 'hub-1' }
      );
    });

    it('is idempotent — calling twice issues the same MERGE both times with no error', async () => {
      const run = jest.fn().mockResolvedValue({ records: [] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await attachToCluster('e3', 'hub-1');
      await attachToCluster('e3', 'hub-1');

      expect(run).toHaveBeenCalledTimes(2);
      expect(run.mock.calls[0]).toEqual(run.mock.calls[1]);
    });
  });

  describe('mergeClusters', () => {
    it('re-points members then deletes the absorbed hub', async () => {
      const run = jest.fn().mockResolvedValue({ records: [] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await mergeClusters('hub-survivor', 'hub-absorbed');

      expect(run).toHaveBeenCalledTimes(2);
      expect(run.mock.calls[0][0]).toContain('IN TRANSACTIONS OF 1000 ROWS');
      expect(run.mock.calls[0][1]).toEqual({
        survivingHubId: 'hub-survivor',
        absorbedHubId: 'hub-absorbed',
      });
      expect(run.mock.calls[1][0]).toContain('DETACH DELETE h');
      expect(run.mock.calls[1][1]).toEqual({ absorbedHubId: 'hub-absorbed' });
    });

    it('is a no-op when surviving and absorbed are the same hub', async () => {
      const run = jest.fn();
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await mergeClusters('hub-1', 'hub-1');

      expect(run).not.toHaveBeenCalled();
    });

    it('only deletes the absorbed hub if no member still points at it', async () => {
      const run = jest.fn().mockResolvedValue({ records: [] });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await mergeClusters('hub-survivor', 'hub-absorbed');

      expect(run.mock.calls[1][0]).toContain('WHERE NOT (h)<-[:IN_CLUSTER]-()');
    });
  });

  describe('getHubIdsForMembers', () => {
    it('returns an empty map without a DB call for an empty member list', async () => {
      const run = jest.fn();
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      const result = await getHubIdsForMembers([]);

      expect(result).toEqual(new Map());
      expect(run).not.toHaveBeenCalled();
    });

    it('maps each member with a hub to its hub id, omitting members with none', async () => {
      const run = jest.fn().mockResolvedValue({
        records: [record({ memberId: 'e1', hubId: 'hub-1' }), record({ memberId: 'e2', hubId: 'hub-1' })],
      });
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      // e3 has no hub, so it never appears in the result rows.
      const result = await getHubIdsForMembers(['e1', 'e2', 'e3']);

      expect(result.get('e1')).toBe('hub-1');
      expect(result.get('e2')).toBe('hub-1');
      expect(result.has('e3')).toBe(false);
    });

    it('throws a sanitized error when the query fails', async () => {
      const run = jest.fn().mockRejectedValue(new Error('connection reset'));
      mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

      await expect(getHubIdsForMembers(['e1'])).rejects.toThrow(
        'Failed to look up identity cluster hubs for members'
      );
    });
  });
});
