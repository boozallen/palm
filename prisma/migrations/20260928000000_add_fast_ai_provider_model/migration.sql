-- AlterTable
ALTER TABLE "SystemConfig"
  ADD COLUMN "fastAiProviderModelId" UUID;

-- AddForeignKey
ALTER TABLE "SystemConfig"
  ADD CONSTRAINT "SystemConfig_fastAiProviderModelId_fkey"
  FOREIGN KEY ("fastAiProviderModelId") REFERENCES "Model"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
