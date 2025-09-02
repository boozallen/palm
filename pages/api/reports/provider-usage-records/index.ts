import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import { z } from 'zod';
import { stringify } from 'csv';

import { authOptions } from '@/server/auth-adapter';
import { InitiatedBy, TimeRange } from '@/features/settings/types/analytics';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUsageRecords from '@/features/settings/dal/analytics/getUsageRecords';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';

const inputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid().or(z.literal('all')),
  model: z.string().uuid().or(z.literal('all')),
  timeRange: z.nativeEnum(TimeRange),
});

const exportProviderUsageRecords: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user.id;
  const userRole = session?.user.role ?? UserRole.User;

  if (userRole !== UserRole.Admin) {
    logger.error(`You do not have permission to download analytics data: userId: ${userId}`);
    throw Forbidden('You do not have permission to access this resource');
  }

  const { initiatedBy, aiProvider, model, timeRange } = inputSchema.parse(req.body);

  const result = await getUsageRecords(initiatedBy, aiProvider, model, timeRange);

  let daysToSubtract: number;
  switch (timeRange) {
    case TimeRange.Day:
      daysToSubtract = 1;
      break;
    case TimeRange.Week:
      daysToSubtract = 6;
      break;
    case TimeRange.Month:
      daysToSubtract = 29;
      break;
    case TimeRange.Year:
      daysToSubtract = 364;
      break;
    default:
      logger.error('Unable to determine time range for exportProviderUsageRecords');
      throw new Error('Unable to determine time range for exportProviderUsageRecords');
  }

  const now = new Date();
  const endDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  now.setDate(now.getDate() - daysToSubtract);
  const startDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const filename = `palm-analytics-${startDate}-${endDate}.csv`;

  const stream = stringify({
    columns: [
      'provider',
      'provider_input_cost_per_million_tokens',
      'provider_output_cost_per_million_tokens',
      'provider_usage_cost',
      'model',
      'model_usage_cost',
    ],
    header: true,
  });

  res.status(200)
    .setHeader('Content-Type', 'text/csv')
    .setHeader('Content-Disposition', `attachment; filename=${filename}`);

  stream.pipe(res);

  try {
    result.providers.forEach(provider => {
      provider.models.forEach(model => {
        stream.write({
          provider: provider.label,
          provider_input_cost_per_million_tokens: (provider.costPerInputToken * 1000000),
          provider_output_cost_per_million_tokens: (provider.costPerOutputToken * 1000000),
          provider_usage_cost: provider.cost,
          model: model.label,
          model_usage_cost: model.cost,
        });
      });
    });
  } catch (error) {
    logger.error('Failed to generate CSV', error);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
  stream.end();
  logger.info(`Successfully exported analytics data for ${startDate} to ${endDate}`);
};

export default exportProviderUsageRecords;
