-- AlterTable
ALTER TABLE "ChatMessageCitation" ADD COLUMN     "citedMessageId" UUID;

-- AddForeignKey
ALTER TABLE "ChatMessageCitation" ADD CONSTRAINT "ChatMessageCitation_citedMessageId_fkey" FOREIGN KEY ("citedMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
