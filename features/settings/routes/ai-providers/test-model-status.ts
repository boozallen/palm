import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { MessageRole } from '@/features/chat/types/message';

const testMessage = 'I am sending a test message.';

const inputSchema = z.object({
  modelId: z.string().uuid(),
});

const outputSchema = z.object({
  aiResponse: z.string(),
  isValid: z.boolean(),
  errorMessage: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const message = {
      role: MessageRole.User,
      content: testMessage,
    };

    // This tests a chat completion, which an embedding model cannot serve. The
    // model row hides its Test Model button for that reason, so no embeddings-only
    // model reaches this route.
    try {
      let ai = await ctx.ai.buildSystemSource(input.modelId);

      const result = await ai.source.chatCompletion([message], {
        model: ai.model.externalId,
        temperature: 0.2,
        topP: 0.5,
      });

      return {
        aiResponse: result.text,
        isValid: true,
      };
    } catch (error: any) {
      const errorMessage = error.message;

      return {
        aiResponse: '',
        isValid: false,
        errorMessage: errorMessage,
      };
    }
  });
