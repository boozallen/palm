-- CreateTable
CREATE TABLE "AgentSwearChecklistItem" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "aiAgentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AgentSwearChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSwearChecklistItem_aiAgentId_category_item_key" ON "AgentSwearChecklistItem"("aiAgentId", "category", "item");

-- AddForeignKey
ALTER TABLE "AgentSwearChecklistItem" ADD CONSTRAINT "AgentSwearChecklistItem_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
