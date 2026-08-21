-- CreateTable
-- Pure derived index over ChatMessage: no text copy. The sync job writes the
-- word list (to_tsvector) and the embedding together from the same message
-- content; search joins back to ChatMessage for the text itself.
CREATE TABLE "chat_message_search" (
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "textSearch" tsvector,
    "embedding" vector(1536),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_search_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE INDEX "chat_message_search_userId_idx" ON "chat_message_search"("userId");

CREATE INDEX IF NOT EXISTS "chat_message_search_textSearch_idx"
  ON "chat_message_search" USING GIN ("textSearch");

CREATE INDEX IF NOT EXISTS "chat_message_search_embedding_hnsw_idx"
  ON "chat_message_search" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "chat_message_search" ADD CONSTRAINT "chat_message_search_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_search" ADD CONSTRAINT "chat_message_search_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
