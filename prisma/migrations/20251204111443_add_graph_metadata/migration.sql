-- CreateTable
CREATE TABLE "graph_metadata" (
    "id" UUID NOT NULL,
    "graphId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "documentIds" UUID[],
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "buildProgress" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "graph_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graph_metadata_graphId_key" ON "graph_metadata"("graphId");

-- CreateIndex
CREATE INDEX "graph_metadata_userId_idx" ON "graph_metadata"("userId");

-- CreateIndex
CREATE INDEX "graph_metadata_status_idx" ON "graph_metadata"("status");

-- CreateIndex
CREATE INDEX "graph_metadata_expiresAt_idx" ON "graph_metadata"("expiresAt");

-- AddForeignKey
ALTER TABLE "graph_metadata" ADD CONSTRAINT "graph_metadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
