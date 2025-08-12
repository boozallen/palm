-- AlterTable
ALTER TABLE "ChatMessageCitation" ADD COLUMN     "documentId" UUID,
ALTER COLUMN "knowledgeBaseId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChatMessageCitation" ADD CONSTRAINT "ChatMessageCitation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
