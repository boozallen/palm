/*
  Warnings:

  - You are about to drop the `shared_document_recipients` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "shared_document_recipients" DROP CONSTRAINT "shared_document_recipients_copiedDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "shared_document_recipients" DROP CONSTRAINT "shared_document_recipients_recipientUserId_fkey";

-- DropForeignKey
ALTER TABLE "shared_document_recipients" DROP CONSTRAINT "shared_document_recipients_sharedDocumentId_fkey";

-- AlterTable
ALTER TABLE "shared_documents" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- DropTable
DROP TABLE "shared_document_recipients";

-- CreateTable
CREATE TABLE "shared_document_actions" (
    "id" UUID NOT NULL,
    "sharedDocumentId" UUID NOT NULL,
    "copiedDocumentId" UUID,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_document_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_document_actions_copiedDocumentId_key" ON "shared_document_actions"("copiedDocumentId");

-- CreateIndex
CREATE INDEX "shared_document_actions_userId_status_idx" ON "shared_document_actions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shared_document_actions_sharedDocumentId_userId_key" ON "shared_document_actions"("sharedDocumentId", "userId");

-- AddForeignKey
ALTER TABLE "shared_document_actions" ADD CONSTRAINT "shared_document_actions_sharedDocumentId_fkey" FOREIGN KEY ("sharedDocumentId") REFERENCES "shared_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_document_actions" ADD CONSTRAINT "shared_document_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_document_actions" ADD CONSTRAINT "shared_document_actions_copiedDocumentId_fkey" FOREIGN KEY ("copiedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
