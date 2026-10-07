-- AlterTable
ALTER TABLE "graph_entity_embeddings" ADD COLUMN     "normalizedName" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "graph_concept_embeddings" ADD COLUMN     "normalizedName" TEXT;
