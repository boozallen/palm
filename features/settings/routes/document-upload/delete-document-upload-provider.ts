import { z } from 'zod';

import { procedure } from '@/server/trpc';
import deleteDocumentUploadProvider from '@/features/settings/dal/document-upload/deleteDocumentUploadProvider';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  providerId: z.string().uuid(),
});

const outputSchema = z.object({
  providerId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const provider = await deleteDocumentUploadProvider(input.providerId);

    return { providerId: provider.id };
  });
