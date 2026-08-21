/**
 * Integration test for graph entity/concept search tenancy isolation (Feature 2,
 * Task 19 — closes the pre-existing gap where the agent's `search` tool had no
 * tenancy coverage).
 *
 * Seeds an entity + concept in an ACCESSIBLE document and an INACCESSIBLE document,
 * runs hybrid search scoped to the accessible doc only, and asserts the inaccessible
 * entity/concept never appears — the real exclusion the mocked unit tests cannot
 * prove (they only assert the scope argument is passed).
 *
 * Requires a live Neo4j (the exact-match + BM25 legs run against the fulltext
 * indexes). Run inside the docker env (un-skip the describe first):
 *   docker exec frontend yarn test features/graph-database/__tests__/integration/hybrid-search-tenancy.integration.test.ts
 *
 * Skipped by default — matches the repo's integration-test convention. The pgvector
 * leg is allowed to fail gracefully (seeded nodes have no embeddings); the Neo4j
 * exact/BM25 legs carry the proof.
 */
import { getGraphDatabaseSource } from '@/features/graph-database';
import { hybridEntitySearch, hybridConceptSearch } from '@/features/graph-database/services/search';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

const ACC_DOC = 'it-acc-doc';
const INACC_DOC = 'it-inacc-doc';
const ENTITY_ACC = 'it-ent-acc';
const ENTITY_INACC = 'it-ent-inacc';
const CONCEPT_ACC = 'it-con-acc';
const CONCEPT_INACC = 'it-con-inacc';

const ALL_IDS = [ENTITY_ACC, ENTITY_INACC, CONCEPT_ACC, CONCEPT_INACC];

describe.skip('hybrid search tenancy isolation (integration, live Neo4j)', () => {
  beforeAll(async () => {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.run('MATCH (n) WHERE n.id IN $ids DETACH DELETE n', { ids: ALL_IDS });
    await graphDb.run(
      `CREATE (:Entity {id: $eAcc, name: 'AccEntityXyz', type: 'ORGANIZATION', documentId: $acc})
       CREATE (:Entity {id: $eInacc, name: 'InaccEntityXyz', type: 'ORGANIZATION', documentId: $inacc})
       CREATE (:Concept {id: $cAcc, name: 'AccConceptXyz', category: 'tech', documentId: $acc})
       CREATE (:Concept {id: $cInacc, name: 'InaccConceptXyz', category: 'tech', documentId: $inacc})`,
      { eAcc: ENTITY_ACC, eInacc: ENTITY_INACC, cAcc: CONCEPT_ACC, cInacc: CONCEPT_INACC, acc: ACC_DOC, inacc: INACC_DOC },
    );
  });

  afterAll(async () => {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.run('MATCH (n) WHERE n.id IN $ids DETACH DELETE n', { ids: ALL_IDS });
  });

  const accessibleDocIds = new Set([ACC_DOC]) as unknown as AccessibleDocIds;

  it('excludes an entity from an inaccessible document', async () => {
    const results = await hybridEntitySearch({
      extractedTerms: ['AccEntityXyz', 'InaccEntityXyz'],
      documentIds: [ACC_DOC],
      accessibleDocIds,
      embeddedQuery: [0.1, 0.2, 0.3],
      maxResults: 25,
    });
    const names = results.map((r) => r.entityName);
    expect(names).toContain('AccEntityXyz'); // accessible entity present (no over-filter)
    expect(names).not.toContain('InaccEntityXyz'); // inaccessible entity excluded (the invariant)
  }, 30000);

  it('excludes a concept from an inaccessible document', async () => {
    const results = await hybridConceptSearch({
      extractedTerms: ['AccConceptXyz', 'InaccConceptXyz'],
      documentIds: [ACC_DOC],
      accessibleDocIds,
      embeddedQuery: [0.1, 0.2, 0.3],
      maxResults: 25,
    });
    const names = results.map((r) => r.conceptName);
    expect(names).toContain('AccConceptXyz');
    expect(names).not.toContain('InaccConceptXyz');
  }, 30000);
});
