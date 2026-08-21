import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { z } from 'zod';
import {
  auditRecordsQuery,
  AuditRecordEvent,
  AuditRecordOutcome,
  auditRecordMetadata,
} from '@/features/shared/types/audit-record';
import getAuditRecords from '@/features/settings/dal/audit-records/getAuditRecords';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string().uuid(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    event: z.nativeEnum(AuditRecordEvent),
    outcome: z.nativeEnum(AuditRecordOutcome),
    description: z.string(),
    referer: z.string().nullable(),
    timestamp: z.date(),
    metadata: auditRecordMetadata.nullable(),
  })),
  totalCount: z.number(),
});

export default procedure
  .input(auditRecordsQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await getAuditRecords(input);

    return {
      records: result.records,
      totalCount: result.totalCount,
    };
  });
