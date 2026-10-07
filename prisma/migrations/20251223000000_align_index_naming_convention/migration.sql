-- Align index naming with Prisma conventions
-- The original migration used custom names (idx_...), this aligns to Prisma's standard naming

-- AlterTable: Remove DB-level default (Prisma handles UUID generation client-side)
ALTER TABLE "graph_build_runs" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex: DocumentResolutionPair indexes
ALTER INDEX "idx_document_resolution_pairs_doc1" RENAME TO "document_resolution_pairs_document1Id_idx";
ALTER INDEX "idx_document_resolution_pairs_doc2" RENAME TO "document_resolution_pairs_document2Id_idx";
ALTER INDEX "idx_document_resolution_pairs_user" RENAME TO "document_resolution_pairs_userId_idx";

-- RenameIndex: GraphBuildRun indexes
ALTER INDEX "idx_graph_build_runs_graph" RENAME TO "graph_build_runs_graphId_idx";
ALTER INDEX "idx_graph_build_runs_started" RENAME TO "graph_build_runs_startedAt_idx";
ALTER INDEX "idx_graph_build_runs_type" RENAME TO "graph_build_runs_runType_idx";
ALTER INDEX "idx_graph_build_runs_user" RENAME TO "graph_build_runs_userId_idx";
