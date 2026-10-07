import { RECENT_CONVERSATIONS_TOP_ENTITY_LIMIT } from '@/features/graph-database/config/conversation-graph.config';
import db from '@/server/db';
import logger from '@/server/logger';

type GetRecentConversationsInput = {
  userId: string;
  sinceDays: number;
  limit: number;
  offset?: number;
  excludeChatId?: string;
};

export type RecentConversation = {
  chatId: string;
  title: string | null;
  firstActivity: Date;
  lastActivity: Date;
  messageCount: number;
  documentIds: string[];
  artifacts: Array<{
    id: string;
    label: string;
    fileExtension: string;
    createdAt: Date;
  }>;
  topEntities: Array<{
    id: string;
    name: string;
    citationCount: number;
  }>;
  lastMessage: {
    messageId: string;
    role: string;
    text: string;
    createdAt: Date;
  };
};

type LastMessageRow = {
  id: string;
  chatId: string;
  role: string;
  content: string;
  createdAt: Date;
};

export default async function getRecentConversations({
  userId,
  sinceDays,
  limit,
  offset = 0,
  excludeChatId,
}: GetRecentConversationsInput): Promise<RecentConversation[]> {
  try {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const activityRows = await db.chatMessage.groupBy({
      by: ['chatId'],
      where: {
        chat: {
          userId,
          ...(excludeChatId ? { id: { not: excludeChatId } } : {}),
        },
      },
      having: {
        createdAt: {
          _max: { gte: since },
        },
      },
      orderBy: [
        { _max: { createdAt: 'desc' } },
        { chatId: 'asc' },
      ],
      take: limit,
      skip: offset,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    if (activityRows.length === 0) {
      return [];
    }

    const chats = await db.chat.findMany({
      where: {
        id: {
          in: activityRows.map(({ chatId }) => chatId),
          ...(excludeChatId ? { not: excludeChatId } : {}),
        },
        userId,
      },
      select: {
        id: true,
        summary: true,
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            role: true,
            createdAt: true,
            documentIds: true,
            chatArtifacts: {
              select: {
                id: true,
                label: true,
                fileExtension: true,
                createdAt: true,
              },
            },
            chatMessageCitations: {
              where: { graphEntityId: { not: null } },
              select: {
                graphEntityId: true,
                graphEntity: {
                  select: { entityName: true },
                },
              },
            },
          },
        },
      },
    });
    const chatsById = new Map(chats.map((chat) => [chat.id, chat]));
    const chatIds = chats.map((chat) => chat.id);
    const lastMessageRows = chatIds.length > 0
      ? await db.$queryRaw<LastMessageRow[]>`
          SELECT DISTINCT ON ("chatId")
            "id", "chatId", "role", "content", "createdAt"
          FROM "ChatMessage"
          WHERE "chatId" = ANY(${chatIds}::uuid[])
            AND btrim("content") <> ''
          ORDER BY "chatId", "createdAt" DESC, "id" DESC
        `
      : [];
    const lastMessageByChatId = new Map(
      lastMessageRows.map((message) => [message.chatId, message]),
    );

    return activityRows.flatMap((activity) => {
      const chat = chatsById.get(activity.chatId);
      const firstActivity = activity._min.createdAt;
      const lastActivity = activity._max.createdAt;
      const lastMessage = lastMessageByChatId.get(activity.chatId);
      if (
        !chat
        || !firstActivity
        || !lastActivity
        || !lastMessage
      ) {
        return [];
      }

      const documentIds = new Set<string>();
      const entityCounts = new Map<string, { name: string; citationCount: number }>();
      const artifacts = chat.messages.flatMap((message) => {
        message.documentIds.forEach((documentId) => documentIds.add(documentId));
        message.chatMessageCitations.forEach((citation) => {
          if (!citation.graphEntityId || !citation.graphEntity) {
            return;
          }
          const current = entityCounts.get(citation.graphEntityId);
          entityCounts.set(citation.graphEntityId, {
            name: citation.graphEntity.entityName,
            citationCount: (current?.citationCount ?? 0) + 1,
          });
        });
        return message.chatArtifacts;
      });
      const topEntities = Array.from(entityCounts, ([id, entity]) => ({ id, ...entity }))
        .sort((left, right) => (
          right.citationCount - left.citationCount || left.id.localeCompare(right.id)
        ))
        .slice(0, RECENT_CONVERSATIONS_TOP_ENTITY_LIMIT);

      return [{
        chatId: chat.id,
        title: chat.summary,
        firstActivity,
        lastActivity,
        messageCount: activity._count._all,
        documentIds: Array.from(documentIds),
        artifacts,
        topEntities,
        lastMessage: {
          messageId: lastMessage.id,
          role: lastMessage.role,
          text: lastMessage.content,
          createdAt: lastMessage.createdAt,
        },
      }];
    });
  } catch (error) {
    logger.error('Error getting recent conversations', { userId, error });
    throw new Error('Error getting recent conversations');
  }
}
