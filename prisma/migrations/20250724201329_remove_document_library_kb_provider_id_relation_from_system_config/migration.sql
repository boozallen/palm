/*
  Warnings:

  - You are about to drop the column `documentLibraryKbProviderId` on the `SystemConfig` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SystemConfig" DROP CONSTRAINT "SystemConfig_documentLibraryKbProviderId_fkey";

-- DropIndex
DROP INDEX "SystemConfig_documentLibraryKbProviderId_key";

-- AlterTable
ALTER TABLE "SystemConfig" DROP COLUMN "documentLibraryKbProviderId";
