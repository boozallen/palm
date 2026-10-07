-- CreateTable
CREATE TABLE "AgentPulseJob" (
    "id" UUID NOT NULL,
    "aiAgentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userGroupId" UUID,
    "status" TEXT NOT NULL,
    "surveyFilename" TEXT NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "persona" TEXT NOT NULL,
    "responseGuidelines" TEXT,
    "sheetName" TEXT NOT NULL,
    "headerRow" INTEGER NOT NULL,
    "inputColumns" TEXT[],
    "respondentIdColumn" TEXT,
    "summary" TEXT,
    "dashboardHtml" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentPulseJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPulseField" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "fieldName" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "allowedValues" TEXT[],
    "defaultValue" TEXT,
    "inputColumnRefs" TEXT[],
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentPulseField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPulseResult" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "respondentId" TEXT,
    "responseText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentPulseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPulseResultValue" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "wasDefaulted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AgentPulseResultValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPulseJob_userGroupId_idx" ON "AgentPulseJob"("userGroupId");

-- CreateIndex
CREATE INDEX "AgentPulseJob_aiAgentId_userId_createdAt_idx" ON "AgentPulseJob"("aiAgentId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentPulseField_jobId_idx" ON "AgentPulseField"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPulseResult_jobId_rowNumber_key" ON "AgentPulseResult"("jobId", "rowNumber");

-- CreateIndex
CREATE INDEX "AgentPulseResultValue_resultId_idx" ON "AgentPulseResultValue"("resultId");

-- AddForeignKey
ALTER TABLE "AgentPulseJob" ADD CONSTRAINT "AgentPulseJob_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPulseJob" ADD CONSTRAINT "AgentPulseJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPulseJob" ADD CONSTRAINT "AgentPulseJob_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPulseField" ADD CONSTRAINT "AgentPulseField_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentPulseJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPulseResult" ADD CONSTRAINT "AgentPulseResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentPulseJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPulseResultValue" ADD CONSTRAINT "AgentPulseResultValue_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AgentPulseResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
