import { z } from 'zod';

import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { procedure } from '@/server/trpc';
import getSystemAdmins from '@/features/settings/dal/admins/getSystemAdmins';

const outputSchema = z.object({
  admins: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email().nullable(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    throw Forbidden('You do not have permission to access this resource');
  }

  const admins = await getSystemAdmins();

  const output: z.infer<typeof outputSchema> = {
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    })),
  };

  return output;
});
