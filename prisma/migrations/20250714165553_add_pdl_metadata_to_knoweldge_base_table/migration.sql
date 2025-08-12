-- AlterTable
ALTER TABLE "KnowledgeBase" ADD COLUMN     "dataSourceId" TEXT,
ADD COLUMN     "s3BucketUri" TEXT,
ADD COLUMN     "writeAccess" BOOLEAN NOT NULL DEFAULT false;
