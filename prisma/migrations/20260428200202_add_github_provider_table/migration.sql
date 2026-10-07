-- CreateTable
CREATE TABLE "GitHubProvider" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.github.com',
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "GitHubProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GitHubProviderToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_GitHubProviderToUserGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GitHubProviderToUserGroup_B_index" ON "_GitHubProviderToUserGroup"("B");

-- AddForeignKey
ALTER TABLE "_GitHubProviderToUserGroup" ADD CONSTRAINT "_GitHubProviderToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "GitHubProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GitHubProviderToUserGroup" ADD CONSTRAINT "_GitHubProviderToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ChatArtifact" ADD COLUMN "githubPagesUrl" TEXT;

-- AlterTable
ALTER TABLE "workflow_artifacts" ADD COLUMN "githubPagesUrl" TEXT;
