/*
  Warnings:

  - A unique constraint covering the columns `[documentLibraryDocumentUploadProviderId]` on the table `SystemConfig` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "documentLibraryDocumentUploadProviderId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_documentLibraryDocumentUploadProviderId_key" ON "SystemConfig"("documentLibraryDocumentUploadProviderId");

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_documentLibraryDocumentUploadProviderId_fkey" FOREIGN KEY ("documentLibraryDocumentUploadProviderId") REFERENCES "DocumentUploadProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
