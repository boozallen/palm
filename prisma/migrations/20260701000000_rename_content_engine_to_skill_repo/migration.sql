-- Rename content engine columns to skill repo
ALTER TABLE "GitHubProvider" RENAME COLUMN "isContentEngine" TO "isSkillRepo";
ALTER TABLE "GitHubProvider" RENAME COLUMN "contentEngineBranch" TO "skillRepoBranch";
ALTER TABLE "GitHubProvider" RENAME COLUMN "contentEngineServiceUrl" TO "skillRepoServiceUrl";
ALTER TABLE "GitHubProvider" RENAME COLUMN "contentEngineRefreshMinutes" TO "skillRepoRefreshMinutes";
ALTER TABLE "GitHubProvider" RENAME COLUMN "contentEngineLastSyncAt" TO "skillRepoLastSyncAt";
ALTER TABLE "GitHubProvider" RENAME COLUMN "contentEngineLastSyncCommit" TO "skillRepoLastSyncCommit";
