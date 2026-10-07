-- AlterTable
ALTER TABLE "AgentPulseJob" ADD COLUMN     "blankRowCount" INTEGER,
ADD COLUMN     "completedAt" TIMESTAMPTZ(6),
ADD COLUMN     "executiveSummaryPdf" BYTEA,
ADD COLUMN     "failedRowCount" INTEGER,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "outputErrors" JSONB,
ADD COLUMN     "resultsDashboardHtml" TEXT,
ADD COLUMN     "resultsFocus" TEXT,
ADD COLUMN     "resultsNarrative" JSONB,
ADD COLUMN     "resultsProfile" JSONB,
ADD COLUMN     "slidesHtml" TEXT;
