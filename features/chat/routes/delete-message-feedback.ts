import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import deleteMessageFeedback from '@/features/chat/dal/deleteMessageFeedback';
import { MessageRole } from '@/features/chat/types/message';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
});

const outputSchema = z.object({
  chatMessageId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { messageId } = input;

    const message = await getMessage(messageId);
    const chat = await getChat(message.chatId);

    if (message.role !== MessageRole.Assistant) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.DeleteMessageFeedback,
        description: `User ${ctx.userId} attempted to clear feedback on non-assistant message ${messageId} in chat ${message.chatId}`,
      });
      throw Forbidden('You can only clear feedback on assistant messages');
    }

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.DeleteMessageFeedback,
        description: `User ${ctx.userId} attempted to clear feedback on message ${messageId} in chat ${message.chatId} without permission`,
      });
      throw Forbidden('You do not have permission to clear feedback for this message');
    }

    await deleteMessageFeedback(messageId);

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteMessageFeedback,
      description: `User ${ctx.userId} cleared their rating on message ${messageId} in chat ${message.chatId}`,
    });

    return {
      chatMessageId: messageId,
    };
  });
