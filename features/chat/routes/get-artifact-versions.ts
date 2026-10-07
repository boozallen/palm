import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import getChatArtifactVersions from '@/features/chat/dal/getChatArtifactVersions';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
  chatMessageId: z.string().uuid(),
});

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

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { artifactId, chatMessageId } = input;

    const message = await getMessage(chatMessageId);
    const chat = await getChat(message.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `User does not have permission to view this artifact's history: userId: ${ctx.userId}, chatId: ${chat.id}`,
      );
      throw Forbidden('You do not have permission to view this artifact version history');
    }

    const artifact = message.artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      throw NotFound('Artifact not found');
    }

    const versions = await getChatArtifactVersions(artifactId);

    return { versions };
  });
