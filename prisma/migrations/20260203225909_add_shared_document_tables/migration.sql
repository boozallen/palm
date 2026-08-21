-- CreateTable
CREATE TABLE "shared_documents" (
    "id" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "sourceUserId" UUID NOT NULL,
    "sharedWithUserGroupIds" UUID[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_document_recipients" (
    "id" UUID NOT NULL,
    "sharedDocumentId" UUID NOT NULL,
    "copiedDocumentId" UUID,
    "recipientUserId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_document_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_documents_sourceDocumentId_key" ON "shared_documents"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "shared_documents_sourceUserId_idx" ON "shared_documents"("sourceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_document_recipients_copiedDocumentId_key" ON "shared_document_recipients"("copiedDocumentId");

-- CreateIndex
CREATE INDEX "shared_document_recipients_recipientUserId_status_idx" ON "shared_document_recipients"("recipientUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shared_document_recipients_sharedDocumentId_recipientUserId_key" ON "shared_document_recipients"("sharedDocumentId", "recipientUserId");

-- AddForeignKey
ALTER TABLE "shared_documents" ADD CONSTRAINT "shared_documents_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_documents" ADD CONSTRAINT "shared_documents_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_document_recipients" ADD CONSTRAINT "shared_document_recipients_sharedDocumentId_fkey" FOREIGN KEY ("sharedDocumentId") REFERENCES "shared_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_document_recipients" ADD CONSTRAINT "shared_document_recipients_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_document_recipients" ADD CONSTRAINT "shared_document_recipients_copiedDocumentId_fkey" FOREIGN KEY ("copiedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
