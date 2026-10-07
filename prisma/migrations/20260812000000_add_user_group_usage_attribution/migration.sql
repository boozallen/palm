-- AlterTable
ALTER TABLE "AiProviderUsage"
  ADD COLUMN "userGroupId" UUID;

-- CreateIndex
CREATE INDEX "AiProviderUsage_userGroupId_idx" ON "AiProviderUsage"("userGroupId");

-- AddForeignKey
ALTER TABLE "AiProviderUsage"
  ADD CONSTRAINT "AiProviderUsage_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
