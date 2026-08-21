-- CreateTable
CREATE TABLE "document_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#228BE6',
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_collection_memberships" (
    "documentId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_collection_memberships_pkey" PRIMARY KEY ("documentId","collectionId")
);

-- CreateIndex
CREATE INDEX "document_collections_userId_idx" ON "document_collections"("userId");

-- CreateIndex
CREATE INDEX "document_collection_memberships_collectionId_idx" ON "document_collection_memberships"("collectionId");

-- CreateIndex
CREATE INDEX "document_collection_memberships_documentId_idx" ON "document_collection_memberships"("documentId");

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collection_memberships" ADD CONSTRAINT "document_collection_memberships_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collection_memberships" ADD CONSTRAINT "document_collection_memberships_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "document_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
