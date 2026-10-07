import db from '@/server/db';
import logger from '@/server/logger';
import { Chat } from '@/features/chat/types/chat';

type CreateChatInput = {
  userId: string;
  modelId: string | null;
  promptId: string | null;
  agentProviderId: string | null;
  systemMessage: string;
  summary: string | null;
  userGroupId: string | null;
};

export default async function createChat(
  input: CreateChatInput
): Promise<Chat> {
  try {
    const result = await db.chat.create({
      data: {
        summary: input.summary,
        userId: input.userId,
        modelId: input.modelId,
        promptId: input.promptId,
        agentProviderId: input.agentProviderId,
        userGroupId: input.userGroupId,
        messages: {
          create: {
            role: 'system',
            content: input.systemMessage,
          },
        },
      },
    });

    return {
      id: result.id,
      summary: result.summary,
      userId: result.userId,
      modelId: result.modelId,
      promptId: result.promptId,
      agentProviderId: result.agentProviderId,
      useCase: result.useCase,
      externalSessionId: result.externalSessionId,
      userGroupId: result.userGroupId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    logger.error(`Error creating chat: UserId: ${input.userId}`, error);
    throw new Error('Error creating chat');
  }
}
