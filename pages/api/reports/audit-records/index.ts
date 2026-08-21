import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import { z } from 'zod';
import { stringify } from 'csv';

import { authOptions } from '@/server/auth-adapter';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAuditRecords from '@/features/settings/dal/audit-records/getAuditRecords';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { summarizeAuditRecordMetadata } from '@/features/shared/utils/auditRecordMetadata';

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

  const session = await getServerSession(req, res, authOptions);
  const sessionUserId = session?.user.id;
  const userRole = session?.user.role ?? UserRole.User;

  if (userRole !== UserRole.Admin) {
    logger.error(`You do not have permission to download audit records: userId: ${sessionUserId}`);
    throw Forbidden('You do not have permission to access this resource');
  }

  const { event, outcome, search } = inputSchema.parse(req.body);

  const result = await getAuditRecords({
    event: event || undefined,
    outcome: outcome || undefined,
    search: search || undefined,
    page: 1,
    pageSize: 100000,
  });

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const filename = `palm-audit-records-${dateString}.csv`;

  const columns = ['timestamp', 'user_name', 'user_email', 'event', 'outcome', 'description', 'resource', 'referer'];

  const stream = stringify({ columns, header: true });

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
    logger.error('Failed to generate CSV', error);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
  stream.end();
  logger.info('Successfully exported audit records');
};

export default exportAuditRecords;
