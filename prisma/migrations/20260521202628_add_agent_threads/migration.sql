-- CreateTable
CREATE TABLE "agent_threads" (
    "id" UUID NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "graphType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "interruptPayload" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "agent_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_threads_threadId_key" ON "agent_threads"("threadId");

-- CreateIndex
CREATE INDEX "agent_threads_userId_idx" ON "agent_threads"("userId");

-- CreateIndex
CREATE INDEX "agent_threads_status_idx" ON "agent_threads"("status");

-- AddForeignKey
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
