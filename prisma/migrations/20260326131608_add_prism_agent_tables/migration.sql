-- CreateTable
CREATE TABLE "AgentPrismJob" (
    "id" UUID NOT NULL,
    "aiAgentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "requirementsFilename" TEXT NOT NULL,
    "proposalFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentPrismJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPrismResult" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "category" TEXT,
    "requirement" TEXT NOT NULL,
    "complianceStatus" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "citations" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentPrismResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentPrismJob" ADD CONSTRAINT "AgentPrismJob_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrismJob" ADD CONSTRAINT "AgentPrismJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrismResult" ADD CONSTRAINT "AgentPrismResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentPrismJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
