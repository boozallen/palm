import { AIFactory } from '@/features/ai-provider';
import getChat from '@/features/chat/dal/getChat';
import updateChatUseCase from '@/features/chat/dal/updateChatUseCase';
import { classifyChatUseCase } from '@/features/chat/system-ai/generateChatConversationSummary';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import logger from '@/server/logger';

type AssignChatUseCaseInput = {
  chatId: string;
  userMessage: string;
  assistantMessage: string;
};

// Decides what a chat was for, now that the assistant has answered it. Called from
// the workers where the reply is persisted, not from the route that titles a new
// chat — that route runs first, so all it could ever categorize is the request.
//
// Called on every completed turn and idempotent: an already-categorized chat costs
// one indexed read, and a chat whose first attempt failed gets another try. Fails
// soft, because the user's answer is already saved and on screen and an unset
// category is reported honestly as unattributed spend.
export default async function assignChatUseCase(input: AssignChatUseCaseInput): Promise<void> {
  try {
    // No reply means no conversation to judge, and judging the request alone is the
    // behaviour being fixed.
    if (input.assistantMessage.trim() === '') {
      return;
    }

    // Concurrent because neither read informs the other, and this runs after the
    // reply is already on screen — nothing is waiting on it, but a wasted round trip
    // on every completed turn is still a round trip.
    const [systemConfig, chat] = await Promise.all([
      getSystemConfig(),
      getChat(input.chatId),
    ]);

    if (!systemConfig.featureManagementChatSummarization) {
      return;
    }

    // Not what makes the write safe — updateChatUseCase's filter does that. This is
    // here to keep a long conversation from paying a model call per turn for a
    // category it already has.
    if (chat.useCase !== null) {
      return;
    }

    // Scoped to the chat's owner and group so the classification's spend attributes
    // where the conversation does. The generator's buildSystemSource marks it system
    // spend, which keeps the classifier out of the totals it populates.
    const ai = new AIFactory({
      userId: chat.userId,
      userGroupId: chat.userGroupId ?? undefined,
    });

    const useCase = await classifyChatUseCase(ai, input.userMessage, input.assistantMessage);

    // Left unset rather than defaulted: an unparseable answer is not evidence of a
    // category, and null already means nothing ever classified this chat.
    if (useCase === null) {
      return;
    }

    await updateChatUseCase({ id: input.chatId, useCase });
  } catch (error) {
    logger.error('Failed to assign a use case to a chat', { chatId: input.chatId, error });
  }
}
