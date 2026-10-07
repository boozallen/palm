-- Add HNSW index for vector similarity search
-- This optimizes existing chunk RAG queries in features/chat/dal/getEmbeddingsForDocuments.ts
-- No code changes needed - PostgreSQL will automatically use index when beneficial
CREATE INDEX embedding_hnsw_idx
  ON "Embedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index creation notes:
-- - m=16: Maximum connections per layer (default, good for 1536-dim embeddings)
-- - ef_construction=64: Construction quality (default, good balance)
-- - vector_cosine_ops: Cosine distance (1 - cosine similarity)
-- - Build time: ~1-5 seconds per 1000 embeddings
-- - Auto-updates on INSERT/UPDATE/DELETE (no maintenance needed)
