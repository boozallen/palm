/*
  Warnings:

  - You are about to drop the column `writeAccess` on the `KbProvider` table. All the data in the column will be lost.
  - You are about to drop the column `dataSourceId` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `s3BucketUri` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `writeAccess` on the `KnowledgeBase` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "KbProvider" DROP COLUMN "writeAccess";

-- AlterTable
ALTER TABLE "KnowledgeBase" DROP COLUMN "dataSourceId",
DROP COLUMN "s3BucketUri",
DROP COLUMN "writeAccess";
