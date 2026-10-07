import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { BINARY_FILE_EXTENSIONS } from '@/features/shared/types/document';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import saveChatArtifactVersion from '@/features/chat/dal/saveChatArtifactVersion';

const inputSchema = z.object({
  artifactId: z.string().uuid(),
  chatMessageId: z.string().uuid(),
  content: z.string(),
});

const outputSchema = z.object({
  artifactId: z.string().uuid(),
  content: z.string(),
  versionNumber: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { artifactId, chatMessageId, content } = input;

    const message = await getMessage(chatMessageId);
    const chat = await getChat(message.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `User does not have permission to edit this artifact: userId: ${ctx.userId}, chatId: ${chat.id}`,
      );
      throw Forbidden('You do not have permission to edit this artifact');
    }

    const artifact = message.artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      throw NotFound('Artifact not found');
    }

    if (BINARY_FILE_EXTENSIONS.includes(artifact.fileExtension.toLowerCase())) {
      throw Forbidden('This artifact type cannot be edited');
    }

    const result = await saveChatArtifactVersion({
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
