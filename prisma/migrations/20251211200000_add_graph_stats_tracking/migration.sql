-- Add stats column to GraphMetadata
ALTER TABLE "graph_metadata" ADD COLUMN "stats" JSONB;

-- Create DocumentResolutionPair table
CREATE TABLE "document_resolution_pairs" (
    "document1Id" UUID NOT NULL,
    "document2Id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "resolvedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidatesGenerated" INTEGER NOT NULL DEFAULT 0,
    "identityEdgesCreated" INTEGER NOT NULL DEFAULT 0,
    "similarEdgesCreated" INTEGER NOT NULL DEFAULT 0,
    "relatedEdgesCreated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_resolution_pairs_pkey" PRIMARY KEY ("document1Id","document2Id")
);

-- Create GraphBuildRun table
CREATE TABLE "graph_build_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graphId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "runType" TEXT NOT NULL,
    "documentIds" UUID[] NOT NULL,
    "isIncremental" BOOLEAN NOT NULL DEFAULT false,
    "newDocumentIds" UUID[] NOT NULL,
    "existingDocumentIds" UUID[] NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "durationMs" INTEGER,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorMessage" TEXT,

    CONSTRAINT "graph_build_runs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for DocumentResolutionPair
ALTER TABLE "document_resolution_pairs" ADD CONSTRAINT "document_resolution_pairs_document1Id_fkey" FOREIGN KEY ("document1Id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_resolution_pairs" ADD CONSTRAINT "document_resolution_pairs_document2Id_fkey" FOREIGN KEY ("document2Id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_resolution_pairs" ADD CONSTRAINT "document_resolution_pairs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint for GraphBuildRun
ALTER TABLE "graph_build_runs" ADD CONSTRAINT "graph_build_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for DocumentResolutionPair
CREATE INDEX "idx_document_resolution_pairs_user" ON "document_resolution_pairs"("userId");
CREATE INDEX "idx_document_resolution_pairs_doc1" ON "document_resolution_pairs"("document1Id");
CREATE INDEX "idx_document_resolution_pairs_doc2" ON "document_resolution_pairs"("document2Id");

-- Create indexes for GraphBuildRun
CREATE INDEX "idx_graph_build_runs_graph" ON "graph_build_runs"("graphId");
CREATE INDEX "idx_graph_build_runs_user" ON "graph_build_runs"("userId");
CREATE INDEX "idx_graph_build_runs_started" ON "graph_build_runs"("startedAt" DESC);
CREATE INDEX "idx_graph_build_runs_type" ON "graph_build_runs"("runType");
