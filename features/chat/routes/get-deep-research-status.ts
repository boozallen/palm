import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { DeepResearchStatus } from '@/features/chat/types/message';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getChat from '@/features/chat/dal/getChat';
import db from '@/server/db';

const inputSchema = z.object({
  chatId: z.string().uuid(),
  jobId: z.string(),
  messageId: z.string().uuid(),
});

const outputSchema = z.object({
  status: z.nativeEnum(DeepResearchStatus),
  error: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { chatId, jobId } = input;

    const chat = await getChat(chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      throw Forbidden('You do not have permission to access this chat');
    }

    // Get status from database - try by jobId first, then by messageId
    let message;
    
    try {
      // First try to find by jobId (if it still exists)
      message = await db.chatMessage.findFirst({
        where: { deepResearchJobId: jobId },
      });
      
      // If not found by jobId, try by messageId
      if (!message) {
        message = await db.chatMessage.findUnique({
          where: { id: input.messageId },
        });
      }
    } catch (error) {
      // If query fails, return pending
    }
    
    if (!message) {
      return {
        status: DeepResearchStatus.PENDING,
      };
    }

    const status = (message.deepResearchStatus as DeepResearchStatus) || DeepResearchStatus.PENDING;

    return {
      status,
    };
  });
