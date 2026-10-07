-- CreateTable
CREATE TABLE "concept_embeddings" (
    "id" UUID NOT NULL,
    "conceptName" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concept_embeddings_conceptName_idx" ON "concept_embeddings"("conceptName");

-- CreateIndex
CREATE INDEX "concept_embeddings_category_idx" ON "concept_embeddings"("category");

-- CreateIndex
CREATE INDEX "concept_embeddings_documentId_idx" ON "concept_embeddings"("documentId");

-- CreateIndex (HNSW for concept embeddings)
CREATE INDEX "idx_concept_embedding_hnsw" ON "concept_embeddings" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "concept_embeddings" ADD CONSTRAINT "concept_embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
