import { z } from 'zod';
import { v4 } from 'uuid';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { AiResponse, ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole } from '@/features/chat/types/message';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import createMessages, {
  CreateMessagesInput,
} from '@/features/chat/dal/createMessages';
import getContentFromKbs, {
  KbResults,
} from '@/features/chat/knowledge-bases/getContentFromKbs';
import addKbContentToMessage from '@/features/chat/knowledge-bases/addKbContentToMessage';
import { addArtifactInstructionsToMessage,
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifactHelperFunctions';

// This is the maximum number of messages that will be used to generate the completion
const maxExistingMessages = -24;

const inputSchema = z.object({
  chatId: z.string().uuid(),
  message: z.string(),
  knowledgeBaseIds: z.array(z.string().uuid()),
});

const outputSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.string(),
      content: z.string(),
      messagedAt: z.date(),
      citations: z.array(z.object({
        knowledgeBaseLabel: z.string(),
        citation: z.string(),
      })),
      artifacts: z.array(z.object({
        id: z.string().uuid(),
        chatMessageId: z.string().uuid(),
        label: z.string(),
        content: z.string(),
        fileExtension: z.string(),
        createdAt: z.date(),
      })),
    }),
  ),
  failedKbs: z.array(z.string()).optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const chat = await getChat(input.chatId);

    let responseError = false;

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`,
      );
      throw Forbidden('You do not have permission to use this chat');
    }

    // check if the modelId is set
    if (!chat.modelId) {
      ctx.logger.error(`Model for chat has not been set: ${chat.id}`);
      throw new Error('Model for chat has not been set');
    }

    // This will be used for the message from the user.
    const now = new Date();

    const msgs = await getMessages(chat.id);

    // trim the existing messages to the maximum number of messages and map them to the ChatCompletionMessage type
    // TODO: the max messages should be configurable
    const messages: ChatCompletionMessage[] = msgs
      .slice(maxExistingMessages)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        artifacts: msg.artifacts,
      }));

    let message = input.message;

    let kbResults: KbResults | undefined;

    const knowledgeBaseIds = input.knowledgeBaseIds;

    if (knowledgeBaseIds.length) {
      kbResults = await getContentFromKbs(ctx, { message, knowledgeBaseIds });
      message = addKbContentToMessage(message, kbResults.content);
    }

    messages.push(
      {
        role: MessageRole.User,
        content: message,
      });

    let assistantMessage: AiResponse = {
      text: '',
      inputTokensUsed: 0,
      outputTokensUsed: 0,
    };

    try {
      const ai = await ctx.ai.buildUserSource(chat.modelId);
      messages[0].content = addArtifactInstructionsToMessage(messages[0].content);

      assistantMessage = await ai.source.chatCompletion(messages, {
        model: ai.model.externalId,
        randomness: 0.2,
        repetitiveness: 0.5,
      });
    } catch (error) {
      ctx.logger.error('Error building user source:', error);
      responseError = true;
    }

    const { artifacts, cleanedText } = extractArtifactsFromMessage(assistantMessage.text);
    assistantMessage.text = cleanedText;

    const createMsgInput: CreateMessagesInput = {
      chatId: chat.id,
      messages: [
        {
          id: v4(),
          role: MessageRole.User,
          content: input.message,
          createdAt: now,
          citations: [], // No citations on user's messages
          artifacts: [], // No artifacts on user's messages
        },
      ],
    };

    if (!responseError) {
      const chatMsgId = v4();
      addChatMessageIdToArtifacts(artifacts, chatMsgId);

      createMsgInput.messages.push({
        id: chatMsgId,
        role: MessageRole.Assistant,
        content: assistantMessage.text,
        createdAt: new Date(),
        citations: kbResults?.citations ?? [],
        artifacts: artifacts,
      });
    }

    const createdMessages = await createMessages(createMsgInput);

    return {
      chatId: chat.id,
      messages: createdMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        messagedAt: message.createdAt,
        citations: message.citations,
        artifacts: message.artifacts,
      })),
      failedKbs: kbResults?.failedKbs,
    };
  });
