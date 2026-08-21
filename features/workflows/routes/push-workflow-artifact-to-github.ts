import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import pushArtifactToGitHub from '@/features/shared/services/pushArtifactToGitHub';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import updateWorkflowArtifactGithubPagesUrl from '@/features/workflows/dal/updateWorkflowArtifactGithubPagesUrl';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
  githubProviderId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  action: z.enum(['created', 'updated']),
  url: z.string(),
  commitSha: z.string(),
  pagesUrl: z.string().nullable(),
});

export const pushWorkflowArtifactToGithubRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { artifactId, githubProviderId } = input;

    const artifact = await getWorkflowArtifact({ artifactId });

    if (!artifact) {
      throw NotFound('Workflow artifact not found');
    }

    if (
      ctx.userRole !== UserRole.Admin &&
      artifact.workflowExecution.triggeredBy !== ctx.userId
    ) {
      throw Forbidden('You do not have permission to push this artifact');
    }

    try {
      const result = await pushArtifactToGitHub({
        userId: ctx.userId,
        githubProviderId,
        content: artifact.content,
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        scopeId: artifact.workflowExecution.id,
      });

      if (result.pagesUrl) {
        await updateWorkflowArtifactGithubPagesUrl(artifactId, result.pagesUrl);
      }

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} published workflow artifact ${artifactId} to GitHub: ${result.url}`,
        event: AuditRecordEvent.PublishWorkflowArtifactToGithub,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to publish workflow artifact ${artifactId} to GitHub: ${(error as Error).message}`,
        event: AuditRecordEvent.PublishWorkflowArtifactToGithub,
      });
      throw error;
    }
  });
