import { ChatTranscriptMessage } from '@/features/context-studio/types/use-case-detail';
import db from '@/server/db';
import logger from '@/server/logger';

// Fetches the full message history for a single chat, ordered by creation
// time, with each message's usage steps and costs.
export default async function getChatTranscript(
  chatId: string,
  userGroupId: string,
): Promise<ChatTranscriptMessage[]> {
  try {
    const messages = await db.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    const messageIds = messages.map((message) => message.id);

    // No group selected: drop unattributed steps, matching the chat list total this
    // transcript belongs to (queryUseCaseChats) and the scope gate (isChatInUseCaseScope).
    // A specific group: match only steps tagged with that group, same as those callers.
    const usageRecords = messageIds.length > 0
      ? await db.aiProviderUsage.findMany({
          where: {
            chatMessageId: { in: messageIds },
            embedding: false,
            ...(userGroupId === 'all' ? { userGroupId: { not: null } } : { userGroupId }),
          },
          select: {
            chatMessageId: true,
            stepLabel: true,
            inputTokensUsed: true,
            costPerInputToken: true,
            outputTokensUsed: true,
            costPerOutputToken: true,
          },
        })
      : [];

    const usageByMessageId = new Map<string, { stepLabel: string; cost: number; tokens: number }[]>();

    usageRecords.forEach((record) => {
      if (!record.chatMessageId) {
        return;
      }

      const cost = (record.inputTokensUsed * record.costPerInputToken) + (record.outputTokensUsed * record.costPerOutputToken);
      const tokens = record.inputTokensUsed + record.outputTokensUsed;
      const stepLabel = record.stepLabel ?? 'agent';

      const existing = usageByMessageId.get(record.chatMessageId) ?? [];
      existing.push({ stepLabel, cost, tokens });
      usageByMessageId.set(record.chatMessageId, existing);
    });

    return messages.map((message) => ({
      role: message.role ?? '',
      content: message.content ?? '',
      createdAt: message.createdAt,
      usageSteps: usageByMessageId.get(message.id) ?? [],
    }));
  } catch (error) {
    logger.error('Failed to load a chat transcript', { error });
    throw new Error('Failed to fetch chat transcript');
  }
}
