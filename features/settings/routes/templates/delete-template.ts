import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteTemplate from '@/features/settings/dal/templates/deleteTemplate';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  templateId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to delete artifact template ${input.templateId} but lacked permissions`,
        event: AuditRecordEvent.DeleteArtifactTemplate,
      });
      throw Forbidden('You do not have permission to access this resource');
    }

    try {
      const result = await deleteTemplate(input.templateId);

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} deleted artifact template ${input.templateId}`,
        event: AuditRecordEvent.DeleteArtifactTemplate,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to delete artifact template ${input.templateId}: ${(error as Error).message}`,
        event: AuditRecordEvent.DeleteArtifactTemplate,
      });
      throw error;
    }
  });
