import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import upsertMessageFeedback from '@/features/chat/dal/upsertMessageFeedback';
import { MessageFeedbackIssueType, MessageFeedbackRating, MessageRole } from '@/features/chat/types/message';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: z.nativeEnum(MessageFeedbackRating),
  comment: z.string().max(2000).optional(),
  issueType: z.nativeEnum(MessageFeedbackIssueType).optional(),
});

const outputSchema = z.object({
  chatMessageId: z.string().uuid(),
  rating: z.nativeEnum(MessageFeedbackRating),
  comment: z.string().nullable(),
  issueType: z.nativeEnum(MessageFeedbackIssueType).nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { messageId, rating, comment, issueType } = input;

    const message = await getMessage(messageId);
    const chat = await getChat(message.chatId);

    if (message.role !== MessageRole.Assistant) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.RateMessage,
        description: `User ${ctx.userId} attempted to rate non-assistant message ${messageId} in chat ${message.chatId}`,
      });
      throw Forbidden('You can only rate assistant messages');
    }

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.RateMessage,
        description: `User ${ctx.userId} attempted to rate message ${messageId} in chat ${message.chatId} without permission`,
      });
      throw Forbidden('You do not have permission to rate this message');
    }

    await upsertMessageFeedback({
      messageId,
      userId: ctx.userId,
      rating,
      comment,
      issueType,
    });

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.RateMessage,
      description: `User ${ctx.userId} rated message ${messageId} in chat ${message.chatId} as ${rating}`,
    });

    return {
      chatMessageId: messageId,
      rating,
      comment: comment ?? null,
      issueType: issueType ?? null,
    };
  });
