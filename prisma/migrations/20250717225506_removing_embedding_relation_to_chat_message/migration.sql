/*
  Warnings:

  - You are about to drop the `_ChatMessageToEmbedding` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ChatMessageToEmbedding" DROP CONSTRAINT "_ChatMessageToEmbedding_A_fkey";

-- DropForeignKey
ALTER TABLE "_ChatMessageToEmbedding" DROP CONSTRAINT "_ChatMessageToEmbedding_B_fkey";

-- DropTable
DROP TABLE "_ChatMessageToEmbedding";
