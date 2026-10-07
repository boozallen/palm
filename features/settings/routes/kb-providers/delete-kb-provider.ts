import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import deleteKbProvider from '@/features/settings/dal/kb-providers/deleteKbProvider';
import getKbProvider from '@/features/settings/dal/kb-providers/getKbProvider';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

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

    const provider = await getKbProvider(id);
    const result = await deleteKbProvider(id);

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteKbProvider,
      description: `Knowledge base provider "${provider.label}" was deleted`,
    });

    return {
      id: result.id,
    };
  });
