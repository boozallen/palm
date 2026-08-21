-- Add graph citation fields to ChatMessageCitation
-- These link chat citations to graph entities and concepts
ALTER TABLE "ChatMessageCitation" ADD COLUMN IF NOT EXISTS "graphEntityId" UUID;
ALTER TABLE "ChatMessageCitation" ADD COLUMN IF NOT EXISTS "graphConceptId" UUID;

-- Add foreign key constraints (will fail silently if already exist)
DO $$ BEGIN
  ALTER TABLE "ChatMessageCitation"
    ADD CONSTRAINT "ChatMessageCitation_graphEntityId_fkey"
    FOREIGN KEY ("graphEntityId") REFERENCES "graph_entity_embeddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessageCitation"
    ADD CONSTRAINT "ChatMessageCitation_graphConceptId_fkey"
    FOREIGN KEY ("graphConceptId") REFERENCES "graph_concept_embeddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Recreate HNSW indexes that were lost due to db push
-- These are critical for vector similarity search performance

-- 1. Main Embedding table (for regular RAG chunk search)
CREATE INDEX IF NOT EXISTS "embedding_hnsw_idx"
  ON "Embedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. Graph entity embeddings (for entity resolution)
-- Uses original index name from 20251123190800 migration (survives table rename)
CREATE INDEX IF NOT EXISTS "entity_embeddings_hnsw_idx"
  ON "graph_entity_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. Graph concept embeddings (for concept similarity)
-- Uses original index name from 20251123190700 migration (survives table rename)
CREATE INDEX IF NOT EXISTS "idx_concept_embedding_hnsw"
  ON "graph_concept_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
