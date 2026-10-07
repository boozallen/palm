import { z } from 'zod';

import { procedure } from '@/server/trpc';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  auditRecordMetadata,
  buildClientAuditDescription,
} from '@/features/shared/types/audit-record';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  event: z.nativeEnum(AuditRecordEvent),
  label: z.string().max(200),
  href: z.string().max(500).optional(),
  // The page the user was on when the interaction occurred. Captured client-side
  // because the HTTP Referer header reflects the destination after navigation.
  referer: z.string().max(2000).optional(),
  outcome: z.nativeEnum(AuditRecordOutcome).default(AuditRecordOutcome.Info),
  // Strictly validated so the client can only supply well-formed identifiers,
  // not arbitrary JSON. Unknown keys are rejected rather than stored.
  metadata: auditRecordMetadata.strict().optional(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    const { event, label, href, referer, outcome, metadata } = input;

    // Build the description server-side. A null result means the event has no
    // client description builder, i.e. it is not client-recordable, so we reject
    // it to stop the client forging sensitive server-only events.
    const description = buildClientAuditDescription(event, { label, href });
    if (description === null) {
      throw Forbidden('This event cannot be recorded from the client.');
    }

    await ctx.auditor.createAuditRecord({
      event,
      outcome,
      description,
      referer,
      metadata,
    });

    return { success: true };
  });
