import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import deleteKbProvider from '@/features/settings/dal/deleteKbProvider';
import updateSystemConfigDocumentLibraryKbProvider from '@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { id } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await deleteKbProvider(id);

    await updateSystemConfigDocumentLibraryKbProvider(result.id);

    return {
      id: result.id,
    };
  });
