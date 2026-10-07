-- ============================================
-- Add userId to graph_entity_embeddings
-- ============================================

-- Step 1: Add nullable column
ALTER TABLE "graph_entity_embeddings" ADD COLUMN "userId" UUID;

-- Step 2: Backfill from document relationship
UPDATE "graph_entity_embeddings" e
SET "userId" = d."userId"
FROM "Document" d
WHERE e."documentId" = d.id;

-- Step 3: Make NOT NULL after backfill
ALTER TABLE "graph_entity_embeddings" ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add index for query performance
CREATE INDEX "graph_entity_embeddings_userId_idx" ON "graph_entity_embeddings"("userId");

-- Step 5: Add foreign key constraint
ALTER TABLE "graph_entity_embeddings"
ADD CONSTRAINT "graph_entity_embeddings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Add userId to graph_concept_embeddings
-- ============================================

-- Step 1: Add nullable column
ALTER TABLE "graph_concept_embeddings" ADD COLUMN "userId" UUID;

-- Step 2: Backfill from document relationship
UPDATE "graph_concept_embeddings" c
SET "userId" = d."userId"
FROM "Document" d
WHERE c."documentId" = d.id;

-- Step 3: Make NOT NULL after backfill
ALTER TABLE "graph_concept_embeddings" ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add index for query performance
CREATE INDEX "graph_concept_embeddings_userId_idx" ON "graph_concept_embeddings"("userId");

-- Step 5: Add foreign key constraint
ALTER TABLE "graph_concept_embeddings"
ADD CONSTRAINT "graph_concept_embeddings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
