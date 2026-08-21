-- CreateTable
CREATE TABLE "workflow_artifacts" (
    "id" UUID NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workflowExecutionId" UUID NOT NULL,
    "primitiveId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_artifacts_workflowExecutionId_idx" ON "workflow_artifacts"("workflowExecutionId");

-- CreateIndex
CREATE INDEX "workflow_artifacts_primitiveId_idx" ON "workflow_artifacts"("primitiveId");

-- AddForeignKey
ALTER TABLE "workflow_artifacts" ADD CONSTRAINT "workflow_artifacts_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
