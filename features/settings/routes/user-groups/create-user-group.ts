import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import createUserGroup from '@/features/settings/dal/user-groups/createUserGroup';
import getUser from '@/features/settings/dal/shared/getUser';

const inputSchema = z.object({
  label: z.string(),
});

const outputSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  memberCount: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const currentUser = await getUser(ctx.userId);

    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: 'WARN',
        description: `User ${currentUser?.name} attempted to create a user group with label ${input.label} but lacked permissions`,
        event: 'CREATE_USER_GROUP',
      });

      throw Unauthorized('You do not have permission to create a user group');
    }

    try {
      const result = await createUserGroup({
        label: input.label,
      });

      const output: z.infer<typeof outputSchema> = {
        id: result.id,
        label: result.label,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        memberCount: result.memberCount,
      };

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User ${currentUser?.name} created a user group with label ${input.label}`,
        event: 'CREATE_USER_GROUP',
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name} failed to create a user group with label ${input.label}: ${(error as Error).message}`,
        event: 'CREATE_USER_GROUP',
      });

      if ((error as any).message === 'A user group with that name already exists') {
        throw new Error('A user group with that name already exists');
      }

      throw new Error('Error creating user group');
    }

  });
