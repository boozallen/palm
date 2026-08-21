-- DropIndex
DROP INDEX "AiAgent_name_key";

-- DropIndex
DROP INDEX "_AiAgentToUserGroup_AB_unique";

-- DropIndex
DROP INDEX "_AiProviderToUserGroup_AB_unique";

-- DropIndex
DROP INDEX "_ChatMessageToEmbedding_AB_unique";

-- DropIndex
DROP INDEX "_KbProviderToUserGroup_AB_unique";

-- DropIndex
DROP INDEX "_KnowledgeBaseToUser_AB_unique";

-- AlterTable
ALTER TABLE "AiAgent" ADD COLUMN     "agentType" INTEGER NOT NULL DEFAULT 1;
