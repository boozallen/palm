import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getModel from '@/features/shared/dal/getModel';
import getOriginPrompt from '@/features/chat/dal/getOriginPrompt';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import createChat from '@/features/chat/dal/createChat';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';

const AGENT_PROVIDER_PREFIX = 'agent-provider::';

const inputSchema = z.object({
  modelId: z.string().nullish(),
  promptId: z.string().uuid().nullish(),
  summary: z.string().nullish(),
  systemMessage: z.string().nullish(),
  userGroupId: z.string().uuid().nullish(),
});

const outputSchema = z.object({
  chat: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    modelId: z.string().uuid().nullable(),
    promptId: z.string().uuid().nullable(),
    agentProviderId: z.string().uuid().nullable(),
    summary: z.string().nullable(),
    useCase: z.string().nullable(),
    externalSessionId: z.string().nullable(),
    userGroupId: z.string().uuid().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    // Detect agent-provider:: prefix — model selector sends this for agent options
    const isAgentProvider = typeof input.modelId === 'string' && input.modelId.startsWith(AGENT_PROVIDER_PREFIX);
    const agentProviderId = isAgentProvider
      ? input.modelId!.slice(AGENT_PROVIDER_PREFIX.length)
      : null;
    const resolvedModelId = isAgentProvider ? null : (input.modelId ?? null);

    // verify the model exists if modelId is provided (skip for agent providers)
    if (resolvedModelId) {
      await getModel(resolvedModelId);
    }

    const userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);

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
      modelId: resolvedModelId,
      promptId: input.promptId ?? null,
      agentProviderId,
      systemMessage: systemMessage ?? '',
      summary: input.summary ?? null,
      userGroupId,
    });

    return {
      chat: {
        id: chat.id,
        userId: chat.userId,
        modelId: chat.modelId,
        promptId: chat.promptId,
        agentProviderId: chat.agentProviderId,
        summary: chat.summary,
        useCase: chat.useCase,
        externalSessionId: chat.externalSessionId,
        userGroupId: chat.userGroupId,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    };
  });
