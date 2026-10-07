-- CreateTable
CREATE TABLE "margin_analyses" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "flaggedJobs" JSONB NOT NULL,
    "tmProfitRanking" JSONB NOT NULL,
    "analysisAsOf" TIMESTAMPTZ NOT NULL,
    "totalJobsAnalyzed" INTEGER NOT NULL,
    "totalFlaggedJobs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "margin_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "margin_analyses_agentId_idx" ON "margin_analyses"("agentId");

-- CreateIndex
CREATE INDEX "margin_analyses_userId_idx" ON "margin_analyses"("userId");

-- AddForeignKey
ALTER TABLE "margin_analyses" ADD CONSTRAINT "margin_analyses_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "margin_analyses" ADD CONSTRAINT "margin_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
