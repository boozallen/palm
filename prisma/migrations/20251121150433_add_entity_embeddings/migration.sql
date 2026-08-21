-- CreateTable
CREATE TABLE "entity_embeddings" (
    "id" UUID NOT NULL,
    "entityName" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "description" TEXT NOT NULL,
    "aliases" TEXT[],
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_embeddings_entityName_idx" ON "entity_embeddings"("entityName");

-- CreateIndex
CREATE INDEX "entity_embeddings_documentId_idx" ON "entity_embeddings"("documentId");

-- AddForeignKey
ALTER TABLE "entity_embeddings" ADD CONSTRAINT "entity_embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
