import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { BINARY_FILE_EXTENSIONS } from '@/features/shared/types/document';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import saveWorkflowArtifactVersion from '@/features/workflows/dal/saveWorkflowArtifactVersion';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
  content: z.string(),
});

const outputSchema = z.object({
  artifactId: z.string().uuid(),
  content: z.string(),
  versionNumber: z.number(),
});

export const saveWorkflowArtifactVersionRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { artifactId, content } = input;

    const artifact = await getWorkflowArtifact({ artifactId });

    if (!artifact) {
      throw NotFound('Workflow artifact not found');
    }

    if (
      ctx.userRole !== UserRole.Admin &&
      artifact.workflowExecution.triggeredBy !== ctx.userId
    ) {
      throw Forbidden('You do not have permission to edit this artifact');
    }

    if (BINARY_FILE_EXTENSIONS.includes(artifact.fileExtension.toLowerCase())) {
      throw Forbidden('This artifact type cannot be edited');
    }

    const result = await saveWorkflowArtifactVersion({
      artifactId,
      content,
      editedByUserId: ctx.userId,
    });

    return {
      artifactId,
      content: result.content,
      versionNumber: result.versionNumber,
    };
  });
