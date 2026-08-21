import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import executeReadOnlyQuery from '@/features/settings/dal/databases/executeReadOnlyQuery';
import getUser from '@/features/settings/dal/shared/getUser';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number(),
  executionTime: z.number(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: 'User attempted to execute PostgreSQL query but lacked permissions',
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });
      throw Unauthorized('You do not have permission to execute database queries');
    }

    const currentUser = await getUser(ctx.userId);
    const queryPreview = input.query.length > 100
      ? `${input.query.substring(0, 100)}...`
      : input.query;

    try {
      const result = await executeReadOnlyQuery(input.query);

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} executed read-only PostgreSQL query: ${queryPreview}`,
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to execute PostgreSQL query: ${queryPreview} - ${(error as Error).message}`,
        event: AuditRecordEvent.ExecutePostgresqlQuery,
      });
      throw error;
    }
  });
