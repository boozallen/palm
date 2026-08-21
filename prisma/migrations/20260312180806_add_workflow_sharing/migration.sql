-- CreateTable
CREATE TABLE "shared_workflows" (
    "id" UUID NOT NULL,
    "sourceWorkflowId" UUID NOT NULL,
    "sourceUserId" UUID NOT NULL,
    "sharedWithUserGroupIds" UUID[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "shared_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_workflow_actions" (
    "id" UUID NOT NULL,
    "sharedWorkflowId" UUID NOT NULL,
    "copiedWorkflowId" UUID,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_workflows_sourceUserId_idx" ON "shared_workflows"("sourceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_workflow_actions_copiedWorkflowId_key" ON "shared_workflow_actions"("copiedWorkflowId");

-- CreateIndex
CREATE INDEX "shared_workflow_actions_userId_status_idx" ON "shared_workflow_actions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shared_workflow_actions_sharedWorkflowId_userId_key" ON "shared_workflow_actions"("sharedWorkflowId", "userId");

-- AddForeignKey
ALTER TABLE "shared_workflows" ADD CONSTRAINT "shared_workflows_sourceWorkflowId_fkey" FOREIGN KEY ("sourceWorkflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workflows" ADD CONSTRAINT "shared_workflows_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workflow_actions" ADD CONSTRAINT "shared_workflow_actions_sharedWorkflowId_fkey" FOREIGN KEY ("sharedWorkflowId") REFERENCES "shared_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workflow_actions" ADD CONSTRAINT "shared_workflow_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_workflow_actions" ADD CONSTRAINT "shared_workflow_actions_copiedWorkflowId_fkey" FOREIGN KEY ("copiedWorkflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
