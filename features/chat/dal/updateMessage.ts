import db from '@/server/db';
import logger from '@/server/logger';
import { Artifact } from '@/features/chat/types/message';

type UpdateMessageInput = {
  messageId: string;
  content: string;
  artifacts?: Artifact[];
  followUpQuestions?: string[];
  deepResearchJobId?: string | null;
  deepResearchStatus?: string | null;
};

export default async function updateMessage(input: UpdateMessageInput): Promise<void> {
  try {
    await db.$transaction(async (prisma) => {
      // Update message content and deep research fields
      const updateData: any = { content: input.content };
      
      if (input.deepResearchJobId !== undefined) {
        updateData.deepResearchJobId = input.deepResearchJobId;
      }
      
      if (input.deepResearchStatus !== undefined) {
        updateData.deepResearchStatus = input.deepResearchStatus;
      }
      
      await prisma.chatMessage.update({
        where: { id: input.messageId },
        data: updateData,
      });

      // Update artifacts if provided
      if (input.artifacts) {
        // Delete existing artifacts
        await prisma.chatArtifact.deleteMany({
          where: { chatMessageId: input.messageId },
        });

        // Create new artifacts
        if (input.artifacts.length > 0) {
          await prisma.chatArtifact.createMany({
            data: input.artifacts.map((artifact) => ({
              id: artifact.id,
              fileExtension: artifact.fileExtension,
              label: artifact.label,
              content: artifact.content,
              chatMessageId: input.messageId,
              createdAt: artifact.createdAt,
            })),
          });
        }
      }

      // Update follow-up questions if provided
      if (input.followUpQuestions) {
        // Delete existing follow-ups
        await prisma.chatMessageFollowUp.deleteMany({
          where: { chatMessageId: input.messageId },
        });

        // Create new follow-ups
        if (input.followUpQuestions.length > 0) {
          await prisma.chatMessageFollowUp.createMany({
            data: input.followUpQuestions.map((question) => ({
              content: question,
              chatMessageId: input.messageId,
            })),
          });
        }
      }
    });
  } catch (error) {
    logger.error(`Error updating message: MessageId: ${input.messageId}`, error);
    throw new Error('Error updating message');
  }
}
