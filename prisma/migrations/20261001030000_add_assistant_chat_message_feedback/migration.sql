-- CreateTable
CREATE TABLE "AssistantChatMessageFeedback" (
    "id" UUID NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "userId" UUID,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "issueType" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AssistantChatMessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantChatMessageFeedback_chatMessageId_key" ON "AssistantChatMessageFeedback"("chatMessageId");

-- AddForeignKey
ALTER TABLE "AssistantChatMessageFeedback" ADD CONSTRAINT "AssistantChatMessageFeedback_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantChatMessageFeedback" ADD CONSTRAINT "AssistantChatMessageFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
