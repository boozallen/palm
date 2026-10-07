-- CreateTable
CREATE TABLE "AgentOdramJob" (
    "id" UUID NOT NULL,
    "aiAgentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "odramFilename" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentOdramJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentOdramResult" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "questionId" INTEGER NOT NULL,
    "questionName" TEXT NOT NULL,
    "teamRating" TEXT NOT NULL,
    "independentRating" TEXT NOT NULL,
    "overallAssessment" TEXT NOT NULL,
    "keyFeedback" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentOdramResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentOdramJob" ADD CONSTRAINT "AgentOdramJob_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOdramJob" ADD CONSTRAINT "AgentOdramJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOdramResult" ADD CONSTRAINT "AgentOdramResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentOdramJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
