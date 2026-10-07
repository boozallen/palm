-- AlterTable
ALTER TABLE "AiProviderUsage"
  ADD COLUMN "chatMessageId"       UUID,
  ADD COLUMN "workflowExecutionId" UUID,
  ADD COLUMN "primitiveId"         TEXT,
  ADD COLUMN "stepLabel"           TEXT;

-- CreateIndex
CREATE INDEX "AiProviderUsage_chatMessageId_idx" ON "AiProviderUsage"("chatMessageId");

-- CreateIndex
CREATE INDEX "AiProviderUsage_workflowExecutionId_idx" ON "AiProviderUsage"("workflowExecutionId");

-- AddForeignKey
ALTER TABLE "AiProviderUsage"
  ADD CONSTRAINT "AiProviderUsage_workflowExecutionId_fkey"
  FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
