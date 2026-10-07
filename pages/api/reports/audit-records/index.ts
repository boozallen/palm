import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import { z } from 'zod';
import { stringify } from 'csv';

import { authOptions } from '@/server/auth-adapter';
import getAuditRecords from '@/features/settings/dal/audit-records/getAuditRecords';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { summarizeAuditRecordMetadata } from '@/features/shared/utils/auditRecordMetadata';
import { withErrorReporting } from '@/server/withErrorReporting';

const inputSchema = z.object({
  event: z.string().optional(),
  outcome: z.string().optional(),
  search: z.string().optional(),
});

const exportAuditRecords: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  const sessionUserId = session?.user.id;
  const userRole = session?.user.role ?? UserRole.User;

  if (userRole !== UserRole.Admin) {
    logger.error(`You do not have permission to download audit records: userId: ${sessionUserId}`);
    res.status(403).json({ error: 'You do not have permission to access this resource' });
    return;
  }

  let event: string | undefined;
  let outcome: string | undefined;
  let search: string | undefined;
  try {
    ({ event, outcome, search } = inputSchema.parse(req.body));
  } catch (error) {
    logger.error('Invalid audit records export request', error);
    res.status(400).json({ error: 'Invalid request parameters' });
    return;
  }

  let result: Awaited<ReturnType<typeof getAuditRecords>>;
  try {
    result = await getAuditRecords({
      event: event || undefined,
      outcome: outcome || undefined,
      search: search || undefined,
      page: 1,
      pageSize: 100000,
    });
  } catch (error) {
    logger.error('Failed to fetch audit records for export', error);
    res.status(500).json({ error: 'Unable to retrieve audit records' });
    return;
  }

  const filename = `palm-audit-records-${new Date().toISOString().slice(0, 10)}.csv`;

  const columns = ['timestamp', 'user_name', 'user_email', 'event', 'outcome', 'description', 'resource', 'referer'];

  const stream = stringify({ columns, header: true });

  const handleStreamFailure = (error: unknown) => {
    logger.error('Failed to generate CSV', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CSV' });
    } else {
      res.end();
    }
  };

  stream.on('error', handleStreamFailure);
  res.on('error', (error) => logger.error('Audit records export response stream failed', error));

  res.status(200)
    .setHeader('Content-Type', 'text/csv')
    .setHeader('Content-Disposition', `attachment; filename=${filename}`);

  stream.pipe(res);

  try {
    result.records.forEach(record => {
      stream.write({
        timestamp: new Date(record.timestamp).toISOString(),
        user_name: record.userName ?? '',
        user_email: record.userEmail ?? '',
        event: record.event,
        outcome: record.outcome,
        description: record.description,
        resource: summarizeAuditRecordMetadata(record.metadata),
        referer: record.referer ?? '',
      });
    });
  } catch (error) {
    handleStreamFailure(error);
  }
  stream.end();
  logger.info('Successfully exported audit records');
};

export default withErrorReporting(exportAuditRecords);
