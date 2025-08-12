/*
  Warnings:

  - Added the required column `documentId` to the `Embedding` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Embedding" ADD COLUMN     "documentId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "Embedding_documentId_contentNum_idx" ON "Embedding"("documentId", "contentNum");

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
