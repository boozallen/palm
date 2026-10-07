-- AlterTable
ALTER TABLE "Workflow"
  ADD COLUMN "pinnedUserGroupId" UUID;

-- CreateIndex
CREATE INDEX "Workflow_pinnedUserGroupId_idx" ON "Workflow"("pinnedUserGroupId");

-- AddForeignKey
ALTER TABLE "Workflow"
  ADD CONSTRAINT "Workflow_pinnedUserGroupId_fkey"
  FOREIGN KEY ("pinnedUserGroupId") REFERENCES "UserGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
