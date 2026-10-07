-- Entity resolution vector search (for F2.2)
-- This enables O(log n) entity similarity search using HNSW index
-- Uses cosine distance for similarity computation

CREATE INDEX "entity_embeddings_hnsw_idx"
  ON "entity_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index creation notes:
-- - m=16: Maximum connections per layer (default, good balance)
-- - ef_construction=64: Construction quality (default, good for most use cases)
-- - vector_cosine_ops: Cosine distance (1 - cosine similarity)
-- - Build time: ~1-5 seconds per 1000 embeddings
-- - Memory: ~50-100MB per 1000 embeddings (depends on m)
