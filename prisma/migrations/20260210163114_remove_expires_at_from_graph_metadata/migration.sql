/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `graph_metadata` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "graph_metadata_expiresAt_idx";

-- AlterTable
ALTER TABLE "graph_metadata" DROP COLUMN "expiresAt";
