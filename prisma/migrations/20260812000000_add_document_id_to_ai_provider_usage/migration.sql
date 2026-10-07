-- AlterTable
ALTER TABLE "AiProviderUsage"
  ADD COLUMN "documentId" UUID;

-- CreateIndex
CREATE INDEX "AiProviderUsage_documentId_idx" ON "AiProviderUsage"("documentId");

-- AddForeignKey
ALTER TABLE "AiProviderUsage"
  ADD CONSTRAINT "AiProviderUsage_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
