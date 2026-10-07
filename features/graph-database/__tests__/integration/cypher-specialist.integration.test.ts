/**
 * Integration test for the cypher specialist's per-cell tenancy filter (Feature 2).
 *
 * Proves the row filter scopes to the SELECTED documents, not merely accessible
 * ones: docB is accessible-but-UNSELECTED, so a leaky neighbor living in docB is
 * excluded even though the user could access it — and a neighbor in the selected
 * docA survives (the two-assertion rule: drop the leak AND keep the control).
 *
 * Requires a live Neo4j. Run inside the docker env (un-skip the describe first):
 *   docker exec frontend yarn test features/graph-database/__tests__/integration/cypher-specialist.integration.test.ts
 *
 * Skipped by default — matches the repo's integration-test convention
 * (candidate-pipeline.test.ts). The LLM + access boundaries are mocked to a fixed
 * leaky Cypher; real Neo4j executes it and the real dropRowsOutsideDocumentScope runs.
 */
import { AIFactory } from '@/features/ai-provider/factory';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { cypherSpecialistSearch } from '@/features/graph-database/services/cypherSpecialist';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/ai-provider/factory');

jest.mock('@/features/graph-database/dal/getGraphSchema', () => ({
  getScopedGraphSchema: jest.fn().mockResolvedValue('Node Types:\n- Entity: {id, name, type, documentId}\n'),
}));

jest.mock('@/features/shared/dal/getSystemConfig', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ knowledgeGraphAiProviderModelId: 'model-1' }),
}));

jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(new Set(['it-docA', 'it-docB'])),
}));

const DOC_A = 'it-docA';
const DOC_B = 'it-docB';
const ID_A = 'it-entity-a';
const ID_B = 'it-entity-b'; // FromDocB — accessible but unselected
const ID_C = 'it-entity-c'; // NodeC — in the selected doc

// LEAKY: the neighbor `b` is NOT constrained to $documentIds — the row filter must catch it.
const LEAKY_CYPHER = JSON.stringify({
  cypher:
    'MATCH (a:Entity)-[r:RELATED]-(b:Entity) WHERE a.documentId IN $documentIds AND type(r) <> \'IDENTITY\' ' +
    'RETURN a.id AS _nodeId_a, a.name AS a, type(r) AS rel, b.id AS _nodeId_b, b.name AS b',
  queryType: 'enumeration',
  suggestedFormat: 'table',
});

describe.skip('cypherSpecialistSearch tenancy (integration, live Neo4j)', () => {
  beforeAll(async () => {
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
        source: { chatCompletion: jest.fn().mockResolvedValue({ text: LEAKY_CYPHER }) },
        model: { externalId: 'model-1' },
      }),
    }));

    const graphDb = await getGraphDatabaseSource();
    await graphDb.run('MATCH (n:Entity) WHERE n.id IN $ids DETACH DELETE n', { ids: [ID_A, ID_B, ID_C] });
    await graphDb.run(
      `CREATE (a:Entity {id: $idA, name: 'NodeA', type: 'ORGANIZATION', documentId: $docA})
       CREATE (b:Entity {id: $idB, name: 'FromDocB', type: 'ORGANIZATION', documentId: $docB})
       CREATE (c:Entity {id: $idC, name: 'NodeC', type: 'ORGANIZATION', documentId: $docA})
       CREATE (a)-[:RELATED]->(b)
       CREATE (a)-[:RELATED]->(c)`,
      { idA: ID_A, idB: ID_B, idC: ID_C, docA: DOC_A, docB: DOC_B },
    );
  });

  afterAll(async () => {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.run('MATCH (n:Entity) WHERE n.id IN $ids DETACH DELETE n', { ids: [ID_A, ID_B, ID_C] });
  });

  it('keeps a neighbor in the SELECTED doc and excludes one in an accessible-but-unselected doc', async () => {
    const result = await cypherSpecialistSearch({
      query: 'list entities related to NodeA',
      userId: 'it-user',
      documentIds: [DOC_A], // selected: ONLY docA
      accessibleDocIds: new Set([DOC_A, DOC_B]) as unknown as AccessibleDocIds, // both accessible
    });

    const neighbors = result.results.map((r) => r['b']);
    expect(neighbors).toContain('NodeC'); // neighbor in the SELECTED doc kept (no over-drop)
    expect(neighbors).not.toContain('FromDocB'); // neighbor in an UNSELECTED (but accessible) doc excluded
  }, 30000);
});
