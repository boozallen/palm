-- CreateTable
CREATE TABLE "GraphSnapshot" (
    "id" UUID NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "nodeIds" TEXT[],
    "documentIds" TEXT[],
    "positions" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraphSnapshot_chatMessageId_key" ON "GraphSnapshot"("chatMessageId");

-- AddForeignKey
ALTER TABLE "GraphSnapshot" ADD CONSTRAINT "GraphSnapshot_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
