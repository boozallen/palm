import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import getWorkflowArtifactVersions from '@/features/workflows/dal/getWorkflowArtifactVersions';

const outputSchema = z.object({
  versions: z.array(
    z.object({
      id: z.string().uuid(),
      versionNumber: z.number(),
      content: z.string(),
      editedByUserId: z.string().uuid().nullable(),
      createdAt: z.date(),
    })
  ),
});

export const getWorkflowArtifactVersionsRoute = procedure
  .input(
    z.object({
      artifactId: z.string().uuid(),
    })
  )
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    const artifact = await getWorkflowArtifact({ artifactId: input.artifactId });

    if (!artifact) {
      throw NotFound('Workflow artifact not found');
    }

    if (
      ctx.userRole !== UserRole.Admin &&
      artifact.workflowExecution.triggeredBy !== ctx.userId
    ) {
      throw Forbidden('You do not have permission to view this artifact version history');
    }

    const versions = await getWorkflowArtifactVersions(input.artifactId);

    return { versions };
  });
