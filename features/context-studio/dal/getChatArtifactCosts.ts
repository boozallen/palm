import logger from '@/server/logger';
import db from '@/server/db';

export type ChatArtifactCost = {
  artifactId: string;
  chatId: string;
  name: string;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

/**
 * Per-artifact cost for a set of chats, keyed by artifact id — the chat-artifact
 * analogue of getWorkflowArtifactCosts.
 *
 * Mirrors searchChats's cumulative-cost logic: an artifact's own cost is its
 * generating message's LLM spend divided by how many artifacts that message
 * produced; its cumulative cost is the chat's undivided LLM spend plus the
 * ingestion cost of every document cited so far, up to and including the
 * generating message. Both are null when spend is unknown, not free.
 */
export default async function getChatArtifactCosts(
  chatIds: string[],
  userGroupId?: string,
): Promise<Map<string, ChatArtifactCost>> {
  const result = new Map<string, ChatArtifactCost>();
  if (chatIds.length === 0) { return result; }

  // A chat/document is admitted into the id list by the owner's current group
  // membership elsewhere in the caller, which is not the same thing as which
  // group a usage row was tagged with at the time it ran. A specific group must
  // only count spend actually tagged with it; no group only has to drop untagged spend.
  const usageGroupFilter = userGroupId && userGroupId !== 'all'
    ? userGroupId
    : { not: null };

  try {
    const [chats, artifacts] = await Promise.all([
      db.chat.findMany({
        where: { id: { in: chatIds } },
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, role: true, createdAt: true },
          },
        },
      }),
      db.chatArtifact.findMany({
        where: { message: { chatId: { in: chatIds } } },
        select: {
          id: true,
          label: true,
          fileExtension: true,
          chatMessageId: true,
          message: { select: { chatId: true } },
        },
      }),
    ]);

    if (artifacts.length === 0) { return result; }

    const assistantMessageIds = chats.flatMap((chat) =>
      chat.messages.filter((m) => m.role === 'assistant').map((m) => m.id));

    const [citations, usageRecords] = await Promise.all([
      db.chatMessageCitation.findMany({
        where: { message: { chatId: { in: chatIds } }, documentId: { not: null } },
        select: { documentId: true, message: { select: { id: true } } },
      }),
      assistantMessageIds.length > 0
        ? db.aiProviderUsage.findMany({
            where: { chatMessageId: { in: assistantMessageIds }, userGroupId: usageGroupFilter },
            select: {
              chatMessageId: true,
              embedding: true,
              inputTokensUsed: true,
              costPerInputToken: true,
              outputTokensUsed: true,
              costPerOutputToken: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const citedDocumentIds = Array.from(
      new Set(citations.map((c) => c.documentId).filter((id): id is string => id !== null)),
    );

    const documentUsageRecords = citedDocumentIds.length > 0
      ? await db.aiProviderUsage.findMany({
        where: { documentId: { in: citedDocumentIds }, userGroupId: usageGroupFilter },
        select: { documentId: true, inputTokensUsed: true, costPerInputToken: true, outputTokensUsed: true, costPerOutputToken: true },
      })
      : [];

    const documentCostMap = new Map<string, { cost: number; tokens: number }>();
    for (const r of documentUsageRecords) {
      if (!r.documentId) { continue; }
      const existing = documentCostMap.get(r.documentId) ?? { cost: 0, tokens: 0 };
      existing.cost += r.inputTokensUsed * r.costPerInputToken + r.outputTokensUsed * r.costPerOutputToken;
      existing.tokens += r.inputTokensUsed + r.outputTokensUsed;
      documentCostMap.set(r.documentId, existing);
    }

    const messageDocIds = new Map<string, Set<string>>();
    for (const cit of citations) {
      if (!cit.documentId) { continue; }
      const messageId = cit.message.id;
      if (!messageDocIds.has(messageId)) { messageDocIds.set(messageId, new Set()); }
      messageDocIds.get(messageId)!.add(cit.documentId);
    }

    const messageCostMap = new Map<string, number>();
    const messageTokenMap = new Map<string, number>();
    const messageEmbeddingCostMap = new Map<string, { cost: number; tokens: number }>();
    for (const r of usageRecords) {
      if (!r.chatMessageId) { continue; }
      const stepCost = r.inputTokensUsed * r.costPerInputToken + r.outputTokensUsed * r.costPerOutputToken;
      const stepTokens = r.inputTokensUsed + r.outputTokensUsed;
      if (r.embedding) {
        const existing = messageEmbeddingCostMap.get(r.chatMessageId) ?? { cost: 0, tokens: 0 };
        existing.cost += stepCost;
        existing.tokens += stepTokens;
        messageEmbeddingCostMap.set(r.chatMessageId, existing);
        continue;
      }
      messageCostMap.set(r.chatMessageId, (messageCostMap.get(r.chatMessageId) ?? 0) + stepCost);
      messageTokenMap.set(r.chatMessageId, (messageTokenMap.get(r.chatMessageId) ?? 0) + stepTokens);
    }

    const cumulativeCostMap = new Map<string, number>();
    const cumulativeTokenMap = new Map<string, number>();
    for (const chat of chats) {
      let runningCost = 0;
      let runningTokens = 0;
      let sawUsage = false;
      const citedDocIds = new Set<string>();
      for (const message of chat.messages) {
        const messageCost = messageCostMap.get(message.id);
        if (messageCost !== undefined) {
          sawUsage = true;
          runningCost += messageCost;
          runningTokens += messageTokenMap.get(message.id) ?? 0;
        }
        const embeddingCost = messageEmbeddingCostMap.get(message.id);
        if (embeddingCost) {
          sawUsage = true;
          runningCost += embeddingCost.cost;
          runningTokens += embeddingCost.tokens;
        }
        for (const documentId of messageDocIds.get(message.id) ?? []) {
          if (citedDocIds.has(documentId)) { continue; }
          citedDocIds.add(documentId);
          const docCost = documentCostMap.get(documentId);
          if (docCost) {
            sawUsage = true;
            runningCost += docCost.cost;
            runningTokens += docCost.tokens;
          }
        }
        if (sawUsage) {
          cumulativeCostMap.set(message.id, runningCost);
          cumulativeTokenMap.set(message.id, runningTokens);
        }
      }
    }

    const artifactsPerMessage = new Map<string, number>();
    for (const art of artifacts) {
      artifactsPerMessage.set(art.chatMessageId, (artifactsPerMessage.get(art.chatMessageId) ?? 0) + 1);
    }

    for (const art of artifacts) {
      const count = artifactsPerMessage.get(art.chatMessageId) ?? 1;
      const messageCost = messageCostMap.get(art.chatMessageId);
      const messageTokens = messageTokenMap.get(art.chatMessageId);
      result.set(art.id, {
        artifactId: art.id,
        chatId: art.message.chatId,
        name: `${art.label}${art.fileExtension}`,
        cost: messageCost !== undefined ? messageCost / count : null,
        tokens: messageTokens !== undefined ? Math.round(messageTokens / count) : null,
        cumulativeCost: cumulativeCostMap.get(art.chatMessageId) ?? null,
        cumulativeTokens: cumulativeTokenMap.get(art.chatMessageId) ?? null,
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to fetch chat artifact costs', error);
    throw new Error('Unable to fetch chat artifact costs');
  }
}
