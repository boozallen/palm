-- HNSW Index Declarations
-- This migration registers HNSW indexes with Prisma to prevent drift detection from dropping them.
--
-- Background: Prisma does not natively support HNSW indexes. Without @@index declarations in
-- schema.prisma, Prisma treats these indexes as "drift" and generates DROP INDEX statements.
-- This workaround is documented at: https://github.com/prisma/prisma/issues/27770

-- Drop old inconsistently-named indexes if they exist (from prior migrations)
DROP INDEX IF EXISTS "entity_embeddings_hnsw_idx";
DROP INDEX IF EXISTS "idx_concept_embedding_hnsw";

-- Create HNSW indexes with consistent naming
-- Using IF NOT EXISTS to handle databases that already have these indexes

CREATE INDEX IF NOT EXISTS "embedding_hnsw_idx"
  ON "Embedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "graph_entity_embeddings_hnsw_idx"
  ON "graph_entity_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "graph_concept_embeddings_hnsw_idx"
  ON "graph_concept_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
