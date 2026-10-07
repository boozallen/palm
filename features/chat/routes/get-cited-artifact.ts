import { z } from 'zod';

import getCitedArtifact from '@/features/chat/dal/getCitedArtifact';
import { NotFound } from '@/features/shared/errors/routeErrors';
import { procedure } from '@/server/trpc';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  fileExtension: z.string(),
  content: z.string(),
  sourceScript: z.string().nullable(),
  githubUrl: z.string().nullable(),
  githubPagesUrl: z.string().nullable(),
  createdAt: z.date(),
  chatMessageId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const artifact = await getCitedArtifact({
      userId: ctx.userId,
      artifactId: input.artifactId,
    });

    if (!artifact) {
      throw NotFound('Artifact not found');
    }

    return {
      id: artifact.id,
      label: artifact.label,
      fileExtension: artifact.fileExtension,
      content: artifact.content,
      sourceScript: artifact.sourceScript,
      githubUrl: artifact.githubUrl,
      githubPagesUrl: artifact.githubPagesUrl,
      createdAt: artifact.createdAt,
      chatMessageId: artifact.chatMessageId,
    };
  });
