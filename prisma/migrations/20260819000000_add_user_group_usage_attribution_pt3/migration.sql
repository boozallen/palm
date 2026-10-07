-- AlterTable
ALTER TABLE "Chat"
  ADD COLUMN "userGroupId" UUID;

-- AlterTable
ALTER TABLE "WorkflowExecution"
  ADD COLUMN "userGroupId" UUID;

-- AlterTable
ALTER TABLE "AgentPrismJob"
  ADD COLUMN "userGroupId" UUID;

-- AlterTable
ALTER TABLE "AgentOdramJob"
  ADD COLUMN "userGroupId" UUID;

-- AlterTable
ALTER TABLE "rate_cards"
  ADD COLUMN "userGroupId" UUID;

-- CreateIndex
CREATE INDEX "Chat_userGroupId_idx" ON "Chat"("userGroupId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_userGroupId_idx" ON "WorkflowExecution"("userGroupId");

-- CreateIndex
CREATE INDEX "AgentPrismJob_userGroupId_idx" ON "AgentPrismJob"("userGroupId");

-- CreateIndex
CREATE INDEX "AgentOdramJob_userGroupId_idx" ON "AgentOdramJob"("userGroupId");

-- CreateIndex
CREATE INDEX "rate_cards_userGroupId_idx" ON "rate_cards"("userGroupId");

-- AddForeignKey
ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution"
  ADD CONSTRAINT "WorkflowExecution_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrismJob"
  ADD CONSTRAINT "AgentPrismJob_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOdramJob"
  ADD CONSTRAINT "AgentOdramJob_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards"
  ADD CONSTRAINT "rate_cards_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
