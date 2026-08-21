import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import queryGraph from '@/features/settings/dal/graph-database/query';
import settingsRouter from '@/features/settings/routes/index';

jest.mock('@/features/settings/dal/graph-database/query');

describe('queryGraphProcedure', () => {
  const ctx = {
    userRole: UserRole.Admin,
    logger: { debug: jest.fn(), warn: jest.fn() },
    auditor: {
      createAuditRecord: jest.fn(),
    },
  } as unknown as ContextType;

  const mockSearchResults = {
    results: [
      {
        n: { id: 1 },
        nId: 1,
        nLabels: ['Document'],
        nProperties: { name: 'Test Document' },
        r: { type: 'CONTAINS' },
        rType: 'CONTAINS',
        rProperties: {},
        m: { id: 2 },
        mId: 2,
        mLabels: ['Concept'],
        mProperties: { name: 'Test Concept' },
      },
    ],
    recordCount: 1,
    summary: {
      queryType: 'read',
      executionTime: 100,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (queryGraph as jest.Mock).mockResolvedValue(mockSearchResults);
  });

  describe('custom queryGraph', () => {
    it('should execute custom queryGraph if user is Admin', async () => {
      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.graphDatabase.query({
        query: 'MATCH (n) RETURN n LIMIT 10',
      });

      expect(result).toEqual({
        results: mockSearchResults.results,
        recordCount: mockSearchResults.recordCount,
        summary: mockSearchResults.summary,
        network: {
          nodes: [
            {
              id: 1,
              label: 'Test Document',
              labels: ['Document'],
              properties: { name: 'Test Document' },
              group: 'Document',
            },
            {
              id: 2,
              label: 'Test Concept',
              labels: ['Concept'],
              properties: { name: 'Test Concept' },
              group: 'Concept',
            },
          ],
          edges: [
            {
              from: 1,
              to: 2,
              label: 'CONTAINS',
              type: 'CONTAINS',
              properties: {},
            },
          ],
        },
      });
      expect(queryGraph).toHaveBeenCalledWith({
        query: 'MATCH (n) RETURN n LIMIT 10',
        allowWrite: false,
      });
    });

    it('should pass allowWrite flag to DAL when true', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.graphDatabase.query({
        query: 'CREATE (n:Test {name: "test"}) RETURN n',
        allowWrite: true,
      });

      expect(queryGraph).toHaveBeenCalledWith({
        query: 'CREATE (n:Test {name: "test"}) RETURN n',
        allowWrite: true,
      });
    });

    it('should default allowWrite to false', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.graphDatabase.query({
        query: 'MATCH (n) RETURN n LIMIT 10',
      });

      expect(queryGraph).toHaveBeenCalledWith({
        query: 'MATCH (n) RETURN n LIMIT 10',
        allowWrite: false,
      });
    });

    it('should throw error if user is not Admin', async () => {
      const nonAdminCtx = { ...ctx, userRole: UserRole.User };
      const caller = settingsRouter.createCaller(nonAdminCtx);

      await expect(
        caller.graphDatabase.query({
          query: 'MATCH (n) RETURN n LIMIT 10',
        })
      ).rejects.toThrow(Forbidden('You do not have permission to access this resource'));

      expect(queryGraph).not.toHaveBeenCalled();
    });
  });

  describe('network queryGraph', () => {
    it('should build network queryGraph and transform results for network visualization', async () => {
      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.graphDatabase.query({
        limit: 50,
        labels: ['Document'],
        relationships: ['CONTAINS'],
      });

      expect(result).toEqual({
        results: mockSearchResults.results,
        recordCount: mockSearchResults.recordCount,
        summary: mockSearchResults.summary,
        network: {
          nodes: [
            {
              id: 1,
              label: 'Test Document',
              labels: ['Document'],
              properties: { name: 'Test Document' },
              group: 'Document',
            },
            {
              id: 2,
              label: 'Test Concept',
              labels: ['Concept'],
              properties: { name: 'Test Concept' },
              group: 'Concept',
            },
          ],
          edges: [
            {
              from: 1,
              to: 2,
              label: 'CONTAINS',
              type: 'CONTAINS',
              properties: {},
            },
          ],
        },
      });

      expect(queryGraph).toHaveBeenCalledWith({
        query: expect.stringContaining('\'Document\' IN labels(n)'),
        allowWrite: false,
      });
      // Admin browser is not documentId-scoped — hub leakage must be excluded explicitly.
      expect(queryGraph).toHaveBeenCalledWith({
        query: expect.stringContaining('NOT n:IdentityCluster'),
        allowWrite: false,
      });
    });

    it('should handle empty labels and relationships', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.graphDatabase.query({
        limit: 100,
        labels: [],
        relationships: [],
      });

      expect(queryGraph).toHaveBeenCalledWith({
        query: expect.stringContaining('MATCH (n)'),
        allowWrite: false,
      });
    });

    it('should respect limit parameter with maximum of 1000', async () => {
      const caller = settingsRouter.createCaller(ctx);

      await caller.graphDatabase.query({
        limit: 2000, // Should be capped at 1000
      });

      expect(queryGraph).toHaveBeenCalledWith({
        query: expect.stringContaining('LIMIT 1000'),
        allowWrite: false,
      });
    });

    it('should handle nodes with Neo4j integer objects', async () => {
      const mockResultsWithNeoInt = {
        results: [
          {
            n: { id: { toNumber: () => 123 } },
            nId: { toNumber: () => 123 },
            nLabels: ['Document'],
            nProperties: { name: 'Test Document' },
          },
        ],
        recordCount: 1,
        summary: {
          queryType: 'read',
          executionTime: 100,
        },
      };

      (queryGraph as jest.Mock).mockResolvedValue(mockResultsWithNeoInt);

      const caller = settingsRouter.createCaller(ctx);

      const result = await caller.graphDatabase.query({
        limit: 50,
      });

      expect(result.network?.nodes[0].id).toBe(123);
    });
  });

  describe('error handling', () => {
    it('should handle searchGraph errors', async () => {
      (queryGraph as jest.Mock).mockRejectedValue(new Error('Database error'));

      const caller = settingsRouter.createCaller(ctx);

      await expect(
        caller.graphDatabase.query({
          query: 'MATCH (n) RETURN n',
        })
      ).rejects.toThrow('Database error');
    });
  });
});