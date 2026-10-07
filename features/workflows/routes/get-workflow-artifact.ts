import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import { WorkflowArtifact } from '@/features/workflows/types/primitive';

export const getWorkflowArtifactRoute = procedure
  .input(
    z.object({
      artifactId: z.string().uuid(),
    })
  )
  .query(async ({ ctx, input }) => {
    const artifact = await getWorkflowArtifact({ artifactId: input.artifactId });

    if (!artifact) {
      throw NotFound('Workflow artifact not found');
    }

    // Permission check: user must be the one who triggered the execution
    if (artifact.workflowExecution.triggeredBy !== ctx.userId) {
      throw Forbidden('You do not have permission to access this artifact');
    }

    const workflowArtifact: WorkflowArtifact = {
      id: artifact.id,
      fileExtension: artifact.fileExtension,
      label: artifact.label,
      content: artifact.content,
      githubPagesUrl: artifact.githubPagesUrl ?? null,
      workflowExecutionId: artifact.workflowExecutionId,
      primitiveId: artifact.primitiveId,
      createdAt: artifact.createdAt,
    };

    return workflowArtifact;
  });
