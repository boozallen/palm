import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { z } from 'zod';
import { errorRecordsQuery } from '@/features/shared/types/error-record';
import getErrorRecords from '@/features/settings/dal/error-records/getErrorRecords';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string().uuid(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    source: z.string(),
    route: z.string().nullable(),
    code: z.string(),
    message: z.string(),
    stack: z.string().nullable(),
    timestamp: z.date(),
    metadata: z.record(z.unknown()).nullable(),
  })),
  totalCount: z.number(),
});

export default procedure
  .input(errorRecordsQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await getErrorRecords(input);

    return {
      records: result.records,
      totalCount: result.totalCount,
    };
  });
