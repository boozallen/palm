import { getGraphSchema, getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { getGraphDatabaseSource } from '@/features/graph-database';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/server/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<
  typeof getGraphDatabaseSource
>;

const accessibleDocIds = new Set(['doc-1']) as unknown as AccessibleDocIds;

function record(fields: Record<string, unknown>) {
  return { get: (key: string) => fields[key] };
}

function findCall(run: jest.Mock, needle: string): string {
  const call = run.mock.calls.find(([query]: [string]) => query.includes(needle));
  if (!call) {
    throw new Error(`No run() call matched "${needle}"`);
  }
  return call[0] as string;
}

describe('getScopedGraphSchema', () => {
  // getScopedGraphSchema does not cache (unlike getGraphSchema), so no
  // module-reset gymnastics are needed between tests.
  beforeEach(() => jest.clearAllMocks());

  it('excludes hubs from the relationship query even though the a.documentId filter alone would not catch them on the b side', async () => {
    const run = jest.fn().mockImplementation(async (query: string) => {
      if (query.includes('nodeTypeProperties')) {
        return {
          records: [
            record({ nodeType: 'Entity', properties: ['name'] }),
            record({ nodeType: 'IdentityCluster', properties: ['id', 'userId'] }),
            record({ nodeType: 'Chat', properties: ['id', 'userId'] }),
            record({ nodeType: 'Message', properties: ['id', 'role'] }),
            record({ nodeType: 'Artifact', properties: ['id', 'label'] }),
          ],
        };
      }
      if (query.includes('relTypeProperties')) {
        return { records: [] };
      }
      if (query.includes('MATCH (a)-[r]->(b)')) {
        return {
          records: [
            record({ startLabel: 'Entity', relType: 'RELATED', endLabel: 'Entity' }),
            record({ startLabel: 'Message', relType: 'REFERENCED', endLabel: 'Entity' }),
            record({ startLabel: 'Message', relType: 'IN_CHAT', endLabel: 'Chat' }),
            record({ startLabel: 'Message', relType: 'PRODUCED', endLabel: 'Artifact' }),
            // Allowed type, hidden endpoint: must be hidden by endpoint label,
            // not by the relationship-type denylist.
            record({ startLabel: 'Message', relType: 'MENTIONS', endLabel: 'Entity' }),
          ],
        };
      }
      // entity types / concept categories / relation types distinct-value queries
      return { records: [] };
    });
    mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

    const schema = await getScopedGraphSchema(accessibleDocIds, ['doc-1']);

    const relQuery = findCall(run, 'MATCH (a)-[r]->(b)');
    expect(relQuery).toContain('NOT a:IdentityCluster');
    expect(relQuery).toContain('NOT b:IdentityCluster');
    expect(relQuery).toContain('type(r) <> \'IN_CLUSTER\'');

    expect(schema).toContain('Entity: {name}');
    expect(schema).not.toContain('IdentityCluster');
    expect(schema).not.toContain('IN_CLUSTER');
    expect(schema).not.toContain('Chat');
    expect(schema).not.toContain('Message');
    expect(schema).not.toContain('Artifact');
    expect(schema).not.toContain('REFERENCED');
    expect(schema).not.toContain('IN_CHAT');
    expect(schema).not.toContain('PRODUCED');
    // Allowed type, hidden endpoint: the endpoint-label rule hides this one,
    // not the relationship-type denylist.
    expect(schema).not.toContain('MENTIONS');
  });

  it('falls back to the hardcoded schema on a query failure', async () => {
    const run = jest.fn().mockRejectedValue(new Error('connection reset'));
    mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

    const schema = await getScopedGraphSchema(accessibleDocIds, ['doc-1']);

    expect(schema).toContain('Node Types:');
  });
});

describe('getGraphSchema', () => {
  beforeEach(() => jest.clearAllMocks());

  it('excludes :IdentityCluster from node types and filters IN_CLUSTER out of the relationship query', async () => {
    const run = jest.fn().mockImplementation(async (query: string) => {
      if (query.includes('nodeTypeProperties')) {
        return {
          records: [
            record({ nodeType: 'Entity', properties: ['name'] }),
            record({ nodeType: 'IdentityCluster', properties: ['id', 'userId'] }),
            record({ nodeType: 'Chat', properties: ['id', 'userId'] }),
            record({ nodeType: 'Message', properties: ['id', 'role'] }),
            record({ nodeType: 'Artifact', properties: ['id', 'label'] }),
          ],
        };
      }
      if (query.includes('relTypeProperties')) {
        return { records: [] };
      }
      return {
        records: [
          record({ startLabel: 'Entity', relType: 'RELATED', endLabel: 'Entity' }),
          record({ startLabel: 'Message', relType: 'REFERENCED', endLabel: 'Entity' }),
          record({ startLabel: 'Message', relType: 'IN_CHAT', endLabel: 'Chat' }),
          record({ startLabel: 'Message', relType: 'PRODUCED', endLabel: 'Artifact' }),
        ],
      };
    });
    mockGetGraphDatabaseSource.mockResolvedValue({ run } as any);

    // getGraphSchema() caches its result for 5 minutes across calls, and this
    // is the only test exercising it in this file, so the module-level cache
    // starting empty is exactly what we want here — no reset needed.
    const schema = await getGraphSchema();

    const relQuery = findCall(run, 'MATCH (a)-[r]->(b)');
    expect(relQuery).toContain('NOT a:IdentityCluster');
    expect(relQuery).toContain('NOT b:IdentityCluster');
    expect(relQuery).toContain('type(r) <> \'IN_CLUSTER\'');

    expect(schema).toContain('Entity: {name}');
    expect(schema).not.toContain('IdentityCluster');
    expect(schema).not.toContain('IN_CLUSTER');
    expect(schema).not.toContain('Chat');
    expect(schema).not.toContain('Message');
    expect(schema).not.toContain('Artifact');
    expect(schema).not.toContain('REFERENCED');
    expect(schema).not.toContain('IN_CHAT');
    expect(schema).not.toContain('PRODUCED');
  });
});
