-- Fix concept embeddings HNSW index operator class
-- Original index used vector_l2_ops (L2/Euclidean distance) but queries use <=> (cosine distance)
-- This prevented the HNSW index from ever being used for concept similarity searches

-- Drop the incorrectly configured index
DROP INDEX IF EXISTS "idx_concept_embedding_hnsw";

-- Recreate with correct operator class (vector_cosine_ops for <=> operator)
CREATE INDEX "idx_concept_embedding_hnsw"
  ON "graph_concept_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
