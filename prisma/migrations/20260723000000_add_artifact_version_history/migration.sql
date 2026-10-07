-- CreateTable
CREATE TABLE "ChatArtifactVersion" (
    "id" UUID NOT NULL,
    "chatArtifactId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "editedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatArtifactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_artifact_versions" (
    "id" UUID NOT NULL,
    "workflowArtifactId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "editedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_artifact_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatArtifactVersion_chatArtifactId_idx" ON "ChatArtifactVersion"("chatArtifactId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatArtifactVersion_chatArtifactId_versionNumber_key" ON "ChatArtifactVersion"("chatArtifactId", "versionNumber");

-- CreateIndex
CREATE INDEX "workflow_artifact_versions_workflowArtifactId_idx" ON "workflow_artifact_versions"("workflowArtifactId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_artifact_versions_workflowArtifactId_versionNumber_key" ON "workflow_artifact_versions"("workflowArtifactId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ChatArtifactVersion" ADD CONSTRAINT "ChatArtifactVersion_chatArtifactId_fkey" FOREIGN KEY ("chatArtifactId") REFERENCES "ChatArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_artifact_versions" ADD CONSTRAINT "workflow_artifact_versions_workflowArtifactId_fkey" FOREIGN KEY ("workflowArtifactId") REFERENCES "workflow_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
