-- CreateTable
CREATE TABLE "ErrorRecord" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "source" TEXT NOT NULL,
    "route" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorRecord_source_timestamp_idx" ON "ErrorRecord"("source", "timestamp");

-- CreateIndex
CREATE INDEX "ErrorRecord_code_timestamp_idx" ON "ErrorRecord"("code", "timestamp");

-- CreateIndex
CREATE INDEX "ErrorRecord_userId_timestamp_idx" ON "ErrorRecord"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "ErrorRecord" ADD CONSTRAINT "ErrorRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
