import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';
import getTemplates from '@/features/settings/dal/templates/getTemplates';

const inputSchema = z.object({});

const outputSchema = z.object({
  templates: z.array(z.object({
    id: z.string().uuid(),
    filename: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const lead = await getIsUserGroupLead(ctx.userId);
      if (!lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const templates = await getTemplates();
    return { templates };
  });
