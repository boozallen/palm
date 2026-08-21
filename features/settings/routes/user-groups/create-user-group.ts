import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import createUserGroup from '@/features/settings/dal/user-groups/createUserGroup';
import getUser from '@/features/settings/dal/shared/getUser';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  label: z.string(),
});

const outputSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  graphDatabaseEnabled: z.boolean(),
  workflowsEnabled: z.boolean(),
  agenticChatEnabled: z.boolean(),
  contextStudioEnabled: z.boolean(),
  memberCount: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const currentUser = await getUser(ctx.userId);

    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${currentUser?.name} attempted to create a user group with label ${input.label} but lacked permissions`,
        event: AuditRecordEvent.CreateUserGroup,
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
        graphDatabaseEnabled: result.graphDatabaseEnabled,
        workflowsEnabled: result.workflowsEnabled,
        agenticChatEnabled: result.agenticChatEnabled,
        contextStudioEnabled: result.contextStudioEnabled,
        memberCount: result.memberCount,
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} created a user group with label ${input.label}`,
        event: AuditRecordEvent.CreateUserGroup,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to create a user group with label ${input.label}: ${(error as Error).message}`,
        event: AuditRecordEvent.CreateUserGroup,
      });

      if ((error as any).message === 'A user group with that name already exists') {
        throw new Error('A user group with that name already exists');
      }

      throw new Error('Error creating user group');
    }

  });
