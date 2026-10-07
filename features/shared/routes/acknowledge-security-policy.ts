import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  policyContent: z.string(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    await ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.AcknowledgeSecurityPolicy,
      outcome: AuditRecordOutcome.Success,
      description: `User acknowledged security policy: ${input.policyContent}`,
    });

    return { success: true };
  });
