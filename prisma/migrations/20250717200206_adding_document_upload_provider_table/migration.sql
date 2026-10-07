/*
  Warnings:

  - Added the required column `documentUploadProviderId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentUploadProviderId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "DocumentUploadProvider" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "DocumentUploadProvider_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentUploadProviderId_fkey" FOREIGN KEY ("documentUploadProviderId") REFERENCES "DocumentUploadProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
