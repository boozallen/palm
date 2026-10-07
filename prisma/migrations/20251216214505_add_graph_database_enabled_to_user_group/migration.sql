-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "graphDatabaseEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "ChatMessageCitation" ADD CONSTRAINT "ChatMessageCitation_embeddingId_fkey" FOREIGN KEY ("embeddingId") REFERENCES "Embedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
