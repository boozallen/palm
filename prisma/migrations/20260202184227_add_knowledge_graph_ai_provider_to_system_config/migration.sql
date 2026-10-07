-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "knowledgeGraphAiProviderModelId" UUID;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_knowledgeGraphAiProviderModelId_fkey" FOREIGN KEY ("knowledgeGraphAiProviderModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
