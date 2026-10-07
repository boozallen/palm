-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "documentIds" UUID[] DEFAULT ARRAY[]::UUID[];
