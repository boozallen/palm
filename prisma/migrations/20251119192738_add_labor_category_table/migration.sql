-- CreateTable
CREATE TABLE "LaborCategory" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "socCode" TEXT,
    "lcatCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "geography" TEXT,
    "percentile_10" DOUBLE PRECISION,
    "percentile_25" DOUBLE PRECISION,
    "percentile_50" DOUBLE PRECISION,
    "percentile_75" DOUBLE PRECISION,
    "percentile_90" DOUBLE PRECISION,
    "sourceName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LaborCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaborCategory_agentId_idx" ON "LaborCategory"("agentId");

-- CreateIndex
CREATE INDEX "LaborCategory_socCode_idx" ON "LaborCategory"("socCode");

-- CreateIndex
CREATE INDEX "LaborCategory_lcatCode_idx" ON "LaborCategory"("lcatCode");

-- CreateIndex
CREATE INDEX "LaborCategory_geography_idx" ON "LaborCategory"("geography");

-- CreateIndex
CREATE INDEX "LaborCategory_sourceName_idx" ON "LaborCategory"("sourceName");

-- CreateIndex
CREATE UNIQUE INDEX "LaborCategory_agentId_socCode_key" ON "LaborCategory"("agentId", "socCode");

-- CreateIndex
CREATE UNIQUE INDEX "LaborCategory_agentId_lcatCode_key" ON "LaborCategory"("agentId", "lcatCode");

-- AddForeignKey
ALTER TABLE "LaborCategory" ADD CONSTRAINT "LaborCategory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
