-- DropForeignKey
ALTER TABLE "AgentCertaPolicy" DROP CONSTRAINT "AgentCertaPolicy_aiAgentId_fkey";

-- AddForeignKey
ALTER TABLE "AgentCertaPolicy" ADD CONSTRAINT "AgentCertaPolicy_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
