import db from '@/server/db';
import logger from '@/server/logger';
import { MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';

type UpsertMessageFeedbackInput = {
  messageId: string;
  userId: string;
  rating: MessageFeedbackRating;
  comment?: string;
  issueType?: MessageFeedbackIssueType;
};

export default async function upsertMessageFeedback(input: UpsertMessageFeedbackInput): Promise<void> {
  try {
    await db.assistantChatMessageFeedback.upsert({
      where: { chatMessageId: input.messageId },
      create: {
        chatMessageId: input.messageId,
        userId: input.userId,
        rating: input.rating,
        comment: input.comment,
        issueType: input.issueType,
      },
      update: {
        rating: input.rating,
        comment: input.comment ?? null,
        issueType: input.issueType ?? null,
      },
    });
  } catch (error) {
    logger.error(`Error saving message feedback: MessageId: ${input.messageId}`, error);
    throw new Error('Error saving message feedback');
  }
}
