-- AlterTable
ALTER TABLE "AgentProvider" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "activityDashboardEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "_AgentProviderToUserGroup" ADD CONSTRAINT "_AgentProviderToUserGroup_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AgentProviderToUserGroup_AB_unique";
