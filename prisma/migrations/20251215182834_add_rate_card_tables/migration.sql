-- DropIndex
DROP INDEX "embedding_hnsw_idx";

-- DropIndex
DROP INDEX "idx_concept_embedding_hnsw";

-- DropIndex
DROP INDEX "entity_embeddings_hnsw_idx";

-- AlterTable
ALTER TABLE "graph_concept_embeddings" RENAME CONSTRAINT "concept_embeddings_pkey" TO "graph_concept_embeddings_pkey";

-- AlterTable
ALTER TABLE "graph_entity_embeddings" RENAME CONSTRAINT "entity_embeddings_pkey" TO "graph_entity_embeddings_pkey";

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_categories" (
    "id" UUID NOT NULL,
    "rateCardId" UUID NOT NULL,
    "laborCategoryName" TEXT NOT NULL,
    "laborCategoryCode" TEXT,
    "experienceLevel" TEXT NOT NULL,
    "billRate" DOUBLE PRECISION,
    "educationLevel" TEXT,
    "yearsExperience" TEXT,
    "additionalNotes" TEXT,
    "mappedSocCode" TEXT,
    "mappedSocTitle" TEXT,
    "blsSalaryData" JSONB,
    "dolSalaryData" JSONB,
    "lastSalaryUpdate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_card_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_cards_agentId_idx" ON "rate_cards"("agentId");

-- CreateIndex
CREATE INDEX "rate_cards_userId_idx" ON "rate_cards"("userId");

-- CreateIndex
CREATE INDEX "rate_cards_uploadStatus_idx" ON "rate_cards"("uploadStatus");

-- CreateIndex
CREATE INDEX "rate_card_categories_rateCardId_idx" ON "rate_card_categories"("rateCardId");

-- CreateIndex
CREATE INDEX "rate_card_categories_mappedSocCode_idx" ON "rate_card_categories"("mappedSocCode");

-- RenameForeignKey
ALTER TABLE "graph_concept_embeddings" RENAME CONSTRAINT "concept_embeddings_documentId_fkey" TO "graph_concept_embeddings_documentId_fkey";

-- RenameForeignKey
ALTER TABLE "graph_entity_embeddings" RENAME CONSTRAINT "entity_embeddings_documentId_fkey" TO "graph_entity_embeddings_documentId_fkey";

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_categories" ADD CONSTRAINT "rate_card_categories_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "concept_embeddings_category_idx" RENAME TO "graph_concept_embeddings_category_idx";

-- RenameIndex
ALTER INDEX "concept_embeddings_conceptName_idx" RENAME TO "graph_concept_embeddings_conceptName_idx";

-- RenameIndex
ALTER INDEX "concept_embeddings_documentId_idx" RENAME TO "graph_concept_embeddings_documentId_idx";

-- RenameIndex
ALTER INDEX "entity_embeddings_documentId_idx" RENAME TO "graph_entity_embeddings_documentId_idx";

-- RenameIndex
ALTER INDEX "entity_embeddings_entityName_idx" RENAME TO "graph_entity_embeddings_entityName_idx";
