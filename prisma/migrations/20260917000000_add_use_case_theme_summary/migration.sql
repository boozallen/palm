-- CreateTable
CREATE TABLE "UseCaseThemeSummary" (
    "id" UUID NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "chatCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseThemeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UseCaseThemeSummary_cacheKey_key" ON "UseCaseThemeSummary"("cacheKey");

-- CreateIndex
CREATE INDEX "UseCaseThemeSummary_useCase_idx" ON "UseCaseThemeSummary"("useCase");
