import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import updateChatArtifactGithubPagesUrl from '@/features/chat/dal/updateChatArtifactGithubPagesUrl';
import pushArtifactToGitHub from '@/features/shared/services/pushArtifactToGitHub';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
} from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
  chatMessageId: z.string().uuid(),
  githubProviderId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  action: z.enum(['created', 'updated']),
  url: z.string(),
  commitSha: z.string(),
  pagesUrl: z.string().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { artifactId, chatMessageId, githubProviderId } = input;

    const message = await getMessage(chatMessageId);
    const chat = await getChat(message.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(
        `User does not have permission to push artifact: userId: ${ctx.userId}, chatId: ${chat.id}`,
      );
      throw new Error('You do not have permission to push this artifact');
    }

    const artifact = message.artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      logger.error(`Artifact not found: artifactId: ${artifactId}`);
      throw new Error('Artifact not found');
    }

    try {
      const result = await pushArtifactToGitHub({
        userId: ctx.userId,
        githubProviderId,
        content: artifact.content,
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        scopeId: chat.id,
      });

      if (result.pagesUrl) {
        await updateChatArtifactGithubPagesUrl(artifactId, result.pagesUrl);
      }

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} published artifact ${artifactId} to GitHub: ${result.url}`,
        event: AuditRecordEvent.PublishArtifactToGithub,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to publish artifact ${artifactId} to GitHub: ${(error as Error).message}`,
        event: AuditRecordEvent.PublishArtifactToGithub,
      });
      throw error;
    }
  });
