import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getModel from '@/features/shared/dal/getModel';
import getOriginPrompt from '@/features/chat/dal/getOriginPrompt';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import createChat from '@/features/chat/dal/createChat';

const inputSchema = z.object({
  modelId: z.string().uuid(),
  promptId: z.string().uuid().nullish(),
  summary: z.string().nullish(),
  systemMessage: z.string().nullish(),
});

const outputSchema = z.object({
  chat: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    modelId: z.string().uuid().nullable(),
    promptId: z.string().uuid().nullable(),
    summary: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    // verify the model exists; this will throw an error if it doesn't
    await getModel(input.modelId);

    // the chat will be created with a system message that is either the system message from the 
    // system config, the prompt, or a customized message
    let systemMessage: string | undefined;

    if (input.systemMessage) {
      systemMessage = input.systemMessage;
    } else if (input.promptId) {
      // if the promptId is provided, verify the prompt exists
      const prompt = await getOriginPrompt(input.promptId);

      // use the prompt for the chats system message
      systemMessage = prompt.instructions;
    } else {
      // if no custom system message or prompt is provided, use the system message from the system config
      ({ systemMessage } = await getSystemConfig());
    }

    const chat = await createChat({
      userId: ctx.userId,
      modelId: input.modelId,
      promptId: input.promptId ?? null,
      systemMessage: systemMessage ?? '',
      summary: input.summary ?? null,
    });

    // do not return chat directly
    // the output of the createChat function is the same as the output of this procedure TODAY
    // we need to allow them to change independently in the future
    return {
      chat: {
        id: chat.id,
        userId: chat.userId,
        modelId: chat.modelId,
        promptId: chat.promptId,
        summary: chat.summary,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    };
  });
