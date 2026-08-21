-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "adminCreated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_document_groups" (
    "documentId" UUID NOT NULL,
    "userGroupId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_document_groups_pkey" PRIMARY KEY ("documentId","userGroupId")
);

-- CreateTable
CREATE TABLE "_AdminDocumentAccess" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AdminDocumentAccess_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "admin_document_groups_userGroupId_idx" ON "admin_document_groups"("userGroupId");

-- CreateIndex
CREATE INDEX "_AdminDocumentAccess_B_index" ON "_AdminDocumentAccess"("B");

-- AddForeignKey
ALTER TABLE "admin_document_groups" ADD CONSTRAINT "admin_document_groups_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_document_groups" ADD CONSTRAINT "admin_document_groups_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminDocumentAccess" ADD CONSTRAINT "_AdminDocumentAccess_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminDocumentAccess" ADD CONSTRAINT "_AdminDocumentAccess_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
