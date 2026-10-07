-- AlterTable
ALTER TABLE "GitHubProvider"
  ADD COLUMN IF NOT EXISTS "contentEngineRefreshMinutes" INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "contentEngineLastSyncAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "contentEngineLastSyncCommit" TEXT;

COMMENT ON COLUMN "GitHubProvider"."contentEngineRefreshMinutes" IS 'How often to refresh the content engine (in minutes)';
COMMENT ON COLUMN "GitHubProvider"."contentEngineLastSyncAt" IS 'Timestamp of the last successful sync';
COMMENT ON COLUMN "GitHubProvider"."contentEngineLastSyncCommit" IS 'Git commit hash from the last sync';
