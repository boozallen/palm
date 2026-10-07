-- Mark a document collection as shared so it surfaces read-only to the
-- recipients of an admin data source (analogous to a `scope: 'shared'` tag).
-- Additive and backward-compatible: existing collections default to false.
ALTER TABLE "document_collections" ADD COLUMN "adminCreated" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "document_collections_adminCreated_idx" ON "document_collections"("adminCreated");
