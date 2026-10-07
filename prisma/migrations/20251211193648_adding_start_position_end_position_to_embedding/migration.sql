-- AlterTable
ALTER TABLE "ChatMessageCitation" ADD COLUMN     "embeddingId" UUID;

-- AlterTable
ALTER TABLE "Embedding" ADD COLUMN     "endPosition" INTEGER,
ADD COLUMN     "startPosition" INTEGER;

-- Recreate HNSW indexes that were dropped by Prisma auto-generation when renaming tables
CREATE INDEX IF NOT EXISTS embedding_hnsw_idx
  ON "Embedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_concept_embedding_hnsw
  ON "graph_concept_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS entity_embeddings_hnsw_idx
  ON "graph_entity_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
