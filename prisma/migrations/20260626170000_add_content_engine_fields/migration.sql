-- AlterTable
ALTER TABLE "GitHubProvider" ADD COLUMN "isContentEngine" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GitHubProvider" ADD COLUMN "contentEngineBranch" TEXT;
ALTER TABLE "GitHubProvider" ADD COLUMN "contentEngineServiceUrl" TEXT;

COMMENT ON COLUMN "GitHubProvider"."isContentEngine" IS 'Whether this GitHub provider is a content engine (agent-accessible knowledge base with optional slash commands)';
COMMENT ON COLUMN "GitHubProvider"."contentEngineBranch" IS 'Branch to clone (defaults to main)';
COMMENT ON COLUMN "GitHubProvider"."contentEngineServiceUrl" IS 'URL of the content-engine-service container (defaults to http://content-engine-service:8002)';
