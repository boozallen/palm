-- AlterTable
ALTER TABLE "Embedding" ADD COLUMN     "pageEnd" INTEGER,
ADD COLUMN     "pageStart" INTEGER,
ADD COLUMN     "sectionPath" TEXT[] DEFAULT ARRAY[]::TEXT[];

