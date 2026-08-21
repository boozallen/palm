import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { ArtifactRecord, ChatSearchQuery, ChatSearchQueryResult } from '@/features/context-studio/types/chat-search';

export default async function searchChats(
  query: ChatSearchQuery,
): Promise<ChatSearchQueryResult> {
  try {
    const { search, startDate, endDate, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    const whereClause: Prisma.ChatWhereInput = {};

    if (timeRange && timeRange !== 'forever') {
      const now = new Date();
      const daysMap = { week: 7, month: 30, year: 365 };
      const daysAgo = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { ...(whereClause.createdAt as object), gte: daysAgo };
    }

    if (startDate) {
      whereClause.createdAt = { ...(whereClause.createdAt as object), gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      whereClause.createdAt = { ...(whereClause.createdAt as object), lt: end };
    }

    if (userId && userId !== 'all') {
      whereClause.userId = userId;
    } else if (userGroupId && userGroupId !== 'all') {
      whereClause.user = {
        ...whereClause.user as object,
        userGroupMemberhip: { some: { userGroupId } },
      };
    }

    if (excludeAdmins) {
      whereClause.user = { ...whereClause.user as object, role: { not: 'Admin' } };
    }

    if (search) {
      whereClause.messages = {
        some: {
          role: 'user',
          content: { contains: search, mode: 'insensitive' },
        },
      };
    }

    const [chats, totalCount] = await Promise.all([
      db.chat.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true, email: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, role: true, content: true, createdAt: true, documentIds: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.chat.count({ where: whereClause }),
    ]);

    const chatIds = chats.map((c) => c.id);

    const attachedDocumentIds = Array.from(
      new Set(chats.flatMap((chat) => chat.messages.flatMap((m) => m.documentIds))),
    );

    const assistantMessageIds = chats.flatMap((chat) =>
      chat.messages.filter((m) => m.role === 'assistant').map((m) => m.id),
    );

    const [citations, graphCitations, artifactLabels, attachedDocuments, usageRecords] = await Promise.all([
      db.chatMessageCitation.findMany({
        where: {
          message: { chatId: { in: chatIds } },
          documentId: { not: null },
        },
        select: {
          documentId: true,
          document: { select: { filename: true } },
          message: { select: { id: true, chatId: true } },
        },
      }),
      db.chatMessageCitation.findMany({
        where: {
          message: { chatId: { in: chatIds } },
          OR: [
            { graphEntityId: { not: null } },
            { graphConceptId: { not: null } },
          ],
        },
        select: {
          message: { select: { chatId: true } },
          graphEntity: { select: { document: { select: { filename: true } } } },
          graphConcept: { select: { document: { select: { filename: true } } } },
        },
      }),
      db.chatArtifact.findMany({
        where: { message: { chatId: { in: chatIds } } },
        select: {
          label: true,
          fileExtension: true,
          chatMessageId: true,
          message: { select: { chatId: true } },
        },
        // Creation order, so the artifact table pages the same way on every
        // load and the cumulative cost down a chat's artifacts only grows.
        orderBy: { createdAt: 'asc' },
      }),
      db.document.findMany({
        where: { id: { in: attachedDocumentIds } },
        select: { id: true, filename: true },
      }),
      assistantMessageIds.length > 0
        ? db.aiProviderUsage.findMany({
            // Both LLM and embedding rows, split apart below rather than filtered
            // out here. The two kinds feed different figures — LLM spend feeds the
            // per-message cost and $ Artifact, embedding spend feeds only the
            // cumulative total — and one query with an explicit partition cannot
            // drift the way two queries over the same message ids can.
            where: { chatMessageId: { in: assistantMessageIds } },
            select: {
              chatMessageId: true,
              stepLabel: true,
              embedding: true,
              inputTokensUsed: true,
              costPerInputToken: true,
              outputTokensUsed: true,
              costPerOutputToken: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const documentFilenameMap = new Map<string, string>();
    for (const doc of attachedDocuments) {
      documentFilenameMap.set(doc.id, doc.filename);
    }

    const citedDocumentIds = Array.from(
      new Set(citations.map((cit) => cit.documentId).filter((id): id is string => id !== null)),
    );

    // Ingestion cost per cited document, keyed by documentId — a document embeds
    // in many chunks, so this is the sum of every AiProviderUsage row tagged with
    // that document. Embedding rows do carry chatMessageId once a retrieval is
    // attributed, but never alongside documentId: ingestion tags the document it
    // embedded, retrieval tags the message that asked. That disjointness, plus
    // messageCostMap excluding embedding rows outright, is what keeps these two
    // totals from double counting the same spend.
    const documentUsageRecords = citedDocumentIds.length > 0
      ? await db.aiProviderUsage.findMany({
        where: { documentId: { in: citedDocumentIds } },
        select: {
          documentId: true,
          inputTokensUsed: true,
          costPerInputToken: true,
          outputTokensUsed: true,
          costPerOutputToken: true,
        },
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

    // Which documents each message cited, so the cumulative loop below can
    // charge a document's ingestion cost the first time it appears in the
    // conversation.
    const messageDocIds = new Map<string, Set<string>>();
    for (const cit of citations) {
      if (!cit.documentId) { continue; }
      const messageId = cit.message.id;
      if (!messageDocIds.has(messageId)) {
        messageDocIds.set(messageId, new Set());
      }
      messageDocIds.get(messageId)!.add(cit.documentId);
    }

    // Per-message step costs and totals, both derived from the usage rows so
    // there is a single source of truth for spend. A message with no usage rows
    // (agent-provider chats, or messages predating usage attribution) stays
    // absent from these maps and reads as unknown rather than as zero.
    //
    // Embedding rows are split off into their own map instead: they are the cost
    // of the retrieval that fetched this message's context, which belongs in the
    // cumulative total but not in the per-message figure or $ Artifact, both of
    // which are already on screen and must not move as attribution lands.
    const messageUsageMap = new Map<string, { stepLabel: string; cost: number; tokens: number }[]>();
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
      const steps = messageUsageMap.get(r.chatMessageId) ?? [];
      steps.push({ stepLabel: r.stepLabel ?? 'agent', cost: stepCost, tokens: stepTokens });
      messageUsageMap.set(r.chatMessageId, steps);
      messageCostMap.set(r.chatMessageId, (messageCostMap.get(r.chatMessageId) ?? 0) + stepCost);
      messageTokenMap.set(r.chatMessageId, (messageTokenMap.get(r.chatMessageId) ?? 0) + stepTokens);
    }

    const chatDocMap = new Map<string, Map<string, number>>();
    for (const cit of citations) {
      const chatId = cit.message.chatId;
      const filename = cit.document?.filename;
      if (!filename) { continue; }
      if (!chatDocMap.has(chatId)) {
        chatDocMap.set(chatId, new Map());
      }
      const docCounts = chatDocMap.get(chatId)!;
      docCounts.set(filename, (docCounts.get(filename) ?? 0) + 1);
    }

    const chatGraphDocMap = new Map<string, Map<string, number>>();
    for (const cit of graphCitations) {
      const chatId = cit.message.chatId;
      const filename = cit.graphEntity?.document?.filename ?? cit.graphConcept?.document?.filename;
      if (!filename) { continue; }
      if (!chatGraphDocMap.has(chatId)) {
        chatGraphDocMap.set(chatId, new Map());
      }
      const docCounts = chatGraphDocMap.get(chatId)!;
      docCounts.set(filename, (docCounts.get(filename) ?? 0) + 1);
    }

    const artifactsPerMessage = new Map<string, number>();
    for (const art of artifactLabels) {
      artifactsPerMessage.set(art.chatMessageId, (artifactsPerMessage.get(art.chatMessageId) ?? 0) + 1);
    }

    // Running spend through each message, in chat order. An artifact's true cost
    // to produce is not just the message that emitted it — it is the whole
    // conversation that got there, including the documents retrieval pulled in
    // along the way — so every message carries the chat's LLM spend plus the
    // ingestion cost of every document cited so far, up to and including itself.
    // A document is only charged once, the first time it is cited, even if later
    // messages cite it again. Messages after the artifact are excluded: they are
    // work the artifact did not need.
    //
    // A window with no usage rows at all stays absent and reads as unknown; a
    // window where only some messages have rows reports the spend that IS known,
    // which is a floor on the real figure rather than a silent zero.
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
        // Retrieval is spend in its own right, so it also marks the window as
        // known: a chat whose only recorded cost is its query embeddings should
        // report that figure rather than read as though nothing was tracked.
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

    // An artifact's own cost is its generating message's spend divided by the
    // number of artifacts that message produced. Its cumulative cost is not
    // divided — two artifacts from one message each required the full
    // conversation (and retrieval) that preceded them.
    const chatArtifactMap = new Map<string, ArtifactRecord[]>();
    for (const art of artifactLabels) {
      const chatId = art.message.chatId;
      if (!chatArtifactMap.has(chatId)) {
        chatArtifactMap.set(chatId, []);
      }
      const count = artifactsPerMessage.get(art.chatMessageId) ?? 1;
      const messageCost = messageCostMap.get(art.chatMessageId);
      const messageTokens = messageTokenMap.get(art.chatMessageId);
      const cumulativeCost = cumulativeCostMap.get(art.chatMessageId);
      const cumulativeTokens = cumulativeTokenMap.get(art.chatMessageId);
      chatArtifactMap.get(chatId)!.push({
        name: `${art.label}${art.fileExtension}`,
        cost: messageCost !== undefined ? messageCost / count : null,
        tokens: messageTokens !== undefined ? Math.round(messageTokens / count) : null,
        cumulativeCost: cumulativeCost ?? null,
        cumulativeTokens: cumulativeTokens ?? null,
      });
    }

    const records = chats.map((chat) => {
      const artifactDetails = chatArtifactMap.get(chat.id) ?? [];
      const documents = Array.from(chatDocMap.get(chat.id) ?? []).map(
        ([filename, citationCount]) => ({ filename, citationCount }),
      );
      const graphDocuments = Array.from(chatGraphDocMap.get(chat.id) ?? []).map(
        ([filename, citationCount]) => ({ filename, citationCount }),
      );
      const messages = chat.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        usageSteps: messageUsageMap.get(m.id) ?? [],
      }));
      const attachedDocuments = Array.from(
        new Set(
          chat.messages
            .flatMap((m) => m.documentIds)
            .map((id) => documentFilenameMap.get(id))
            .filter((filename): filename is string => filename !== undefined),
        ),
      );
      return {
        id: chat.id,
        userName: chat.user?.name ?? null,
        userEmail: chat.user?.email ?? null,
        summary: chat.summary,
        createdAt: chat.createdAt,
        documents,
        graphDocuments,
        attachedDocuments,
        artifacts: artifactDetails.map((a) => a.name),
        artifactDetails,
        messages,
        graphAnchorCitations: graphDocuments.reduce((sum, d) => sum + d.citationCount, 0),
      };
    });

    return { records, totalCount };
  } catch (error) {
    logger.error('Failed to search chats', error);
    throw new Error('Unable to search chats');
  }
}
