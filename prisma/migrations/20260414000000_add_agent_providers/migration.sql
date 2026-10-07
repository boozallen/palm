-- CreateTable
CREATE TABLE "AgentProvider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "endpoint" TEXT NOT NULL,
    "apiKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "AgentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable (implicit M:M join table)
CREATE TABLE "_AgentProviderToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "_AgentProviderToUserGroup_AB_unique" ON "_AgentProviderToUserGroup"("A", "B");

-- CreateIndex
CREATE INDEX "_AgentProviderToUserGroup_B_index" ON "_AgentProviderToUserGroup"("B");

-- AlterTable: add agentProviderId to Chat
ALTER TABLE "Chat" ADD COLUMN "agentProviderId" UUID;

-- CreateIndex
CREATE INDEX "Chat_agentProviderId_idx" ON "Chat"("agentProviderId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_agentProviderId_fkey" FOREIGN KEY ("agentProviderId") REFERENCES "AgentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentProviderToUserGroup" ADD CONSTRAINT "_AgentProviderToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "AgentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentProviderToUserGroup" ADD CONSTRAINT "_AgentProviderToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
