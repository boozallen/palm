-- CreateTable
CREATE TABLE "GraphSearchResult" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphSearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraphSearchResult_chatMessageId_key" ON "GraphSearchResult"("chatMessageId");

-- AddForeignKey
ALTER TABLE "GraphSearchResult" ADD CONSTRAINT "GraphSearchResult_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
