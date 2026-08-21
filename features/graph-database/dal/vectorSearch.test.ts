import {
  searchSimilarEntities,
  verifyVectorIndex,
  explainVectorSearch,
} from '@/features/graph-database/dal/vectorSearch';

describe('vectorSearch', () => {
  describe('verifyVectorIndex', () => {
    // NOTE: Skipped - Jest loads browser version of Prisma, can't connect to database
    // Use manual-integration-test.ts to test with real database
    it.skip('should return true if index exists', async () => {
      const hasIndex = await verifyVectorIndex();
      expect(hasIndex).toBe(true);
    });
  });

  describe('searchSimilarEntities', () => {
    // NOTE: Skipped - Jest loads browser version of Prisma, can't connect to database
    // Use manual-integration-test.ts to test with real database
    it.skip('should find similar entities', async () => {
      // Use actual entity ID from database (DHA entity)
      const testEntityId = '9a1ccd0c-3094-4c7e-b66c-4778ad3c86ec';
      const testUserId = 'test-user-id';

      const results = await searchSimilarEntities(testEntityId, {
        threshold: 0.5,
        limit: 10,
        userId: testUserId,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);

      // All results should have similarity > 0.5
      results.forEach(r => {
        expect(r.similarity).toBeGreaterThan(0.5);
        expect(r.id).not.toBe(testEntityId);
      });
    });

    it.skip('should respect documentScope filter', async () => {
      // Use actual entity and document IDs from database
      const testEntityId = '9a1ccd0c-3094-4c7e-b66c-4778ad3c86ec'; // DHA
      const testDocumentId = '529dbf9d-8e16-4cc3-ac82-d3d7a1e5bbf2';
      const testUserId = 'test-user-id';

      const results = await searchSimilarEntities(testEntityId, {
        threshold: 0.5,
        limit: 10,
        documentScope: testDocumentId,
        userId: testUserId,
      });

      // All results should be from the same document
      results.forEach(r => {
        expect(r.documentId).toBe(testDocumentId);
      });
    });

    it.skip('should NOT return entities from different users (isolation test)', async () => {
      // Setup: Create entities for two different users
      // User A has entity "DHA" with embedding
      // User B has entity "DHA" with similar embedding

      const userAEntityId = 'entity-user-a';
      const userAId = 'user-a-id';
      const userBId = 'user-b-id';

      // Search as User A - should only get User A's entities
      const resultsAsUserA = await searchSimilarEntities(userAEntityId, {
        threshold: 0.5,
        limit: 100,
        userId: userAId,
      });

      // Verify NO results have userBId (cross-user leak)
      resultsAsUserA.forEach(() => {
        // Note: We'd need to add userId to return type to verify this
        // For now, verify we got results and none are from wrong user's docs
      });

      // Search as User B with same entity - should get nothing (entity belongs to A)
      const resultsAsUserB = await searchSimilarEntities(userAEntityId, {
        threshold: 0.5,
        limit: 100,
        userId: userBId,
      });

      // Should return empty - User B can't see User A's entities
      expect(resultsAsUserB.length).toBe(0);
    });
  });

  describe('explainVectorSearch', () => {
    it.skip('should show index usage in query plan', async () => {
      // Use actual entity ID from database (DHA entity)
      const testEntityId = '9a1ccd0c-3094-4c7e-b66c-4778ad3c86ec';
      const plan = await explainVectorSearch(testEntityId);

      // Should use HNSW index
      expect(plan).toMatch(/Index Scan using graph_entity_embeddings_hnsw_idx/i);

      // Should NOT use sequential scan
      expect(plan).not.toMatch(/Seq Scan on graph_entity_embeddings/i);
    });
  });
});
