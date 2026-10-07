import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import { z } from 'zod';
import { stringify } from 'csv';

import { authOptions } from '@/server/auth-adapter';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';
import getUsageRecords from '@/features/context-studio/dal/getUsageRecords';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { resolveTimeRangeStart } from '@/features/context-studio/dal/timeRangeFilter';
import logger from '@/server/logger';
import { withErrorReporting } from '@/server/withErrorReporting';

const inputSchema = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid().or(z.literal('all')),
  model: z.string().uuid().or(z.literal('all')),
  timeRange: z.nativeEnum(TimeRange),
  userGroupId: z.string().uuid().or(z.literal('all')).default('all'),
  userId: z.string().uuid().or(z.literal('all')).default('all'),
});

const exportProviderUsageRecords: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  const sessionUserId = session?.user.id;

  if (!sessionUserId) {
    logger.error(`You do not have permission to download cost data: userId: ${sessionUserId}`);
    res.status(403).json({ error: 'You do not have permission to access this resource' });
    return;
  }

  const { initiatedBy, aiProvider, model, timeRange, userGroupId, userId: requestedUserId } = inputSchema.parse(req.body);

  // The download is reached from the Cost tab, so it applies the same Context
  // Studio grant and group/per-user Lead scoping the query does, rather than
  // the Admin role the Analytics page required. Logged here, unlike the tRPC
  // route, since a REST handler owns its own error handling.
  let userId: string;
  try {
    ({ restrictedUserId: userId } = await scopeStudioQuery(
      { userId: sessionUserId, userRole: session?.user.role ?? UserRole.User },
      userGroupId,
      requestedUserId,
    ));
  } catch (error) {
    logger.error(`You do not have permission to download cost data: userId: ${sessionUserId}`, error);
    res.status(500).json({ error: 'You do not have permission to access this resource' });
    return;
  }

  const result = await getUsageRecords(initiatedBy, aiProvider, model, timeRange, userGroupId, userId);

  const now = new Date();
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  // Derived from the shared window rather than a local switch, which threw on any
  // preset it did not enumerate. A null start means the range is unbounded.
  const windowStart = resolveTimeRangeStart(timeRange, now);
  const endDate = formatDate(now);
  const startDate = windowStart ? formatDate(windowStart) : 'all-time';
  const filename = `palm-analytics-${startDate}-${endDate}.csv`;

  const hasUserData = result.users && result.users.length > 0;

  const columns = hasUserData
    ? ['user', 'provider', 'provider_input_tokens', 'provider_output_tokens', 'provider_usage_cost', 'model', 'model_input_tokens', 'model_output_tokens', 'model_usage_cost']
    : ['provider', 'provider_input_cost_per_million_tokens', 'provider_output_cost_per_million_tokens', 'provider_input_tokens', 'provider_output_tokens', 'provider_usage_cost', 'model', 'model_input_tokens', 'model_output_tokens', 'model_usage_cost'];

  const stream = stringify({ columns, header: true });

  res.status(200)
    .setHeader('Content-Type', 'text/csv')
    .setHeader('Content-Disposition', `attachment; filename=${filename}`);

  stream.pipe(res);

  try {
    if (hasUserData) {
      result.users!.forEach(user => {
        user.providers.forEach(provider => {
          provider.models.forEach(model => {
            stream.write({
              user: user.name,
              provider: provider.label,
              provider_input_tokens: provider.inputTokens,
              provider_output_tokens: provider.outputTokens,
              provider_usage_cost: provider.cost,
              model: model.label,
              model_input_tokens: model.inputTokens,
              model_output_tokens: model.outputTokens,
              model_usage_cost: model.cost,
            });
          });
        });
      });
    } else {
      result.providers.forEach(provider => {
        provider.models.forEach(model => {
          stream.write({
            provider: provider.label,
            provider_input_cost_per_million_tokens: (provider.costPerInputToken * 1000000),
            provider_output_cost_per_million_tokens: (provider.costPerOutputToken * 1000000),
            provider_input_tokens: provider.inputTokens,
            provider_output_tokens: provider.outputTokens,
            provider_usage_cost: provider.cost,
            model: model.label,
            model_input_tokens: model.inputTokens,
            model_output_tokens: model.outputTokens,
            model_usage_cost: model.cost,
          });
        });
      });
    }
  } catch (error) {
    logger.error('Failed to generate CSV', error);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
  stream.end();
  logger.info(`Successfully exported analytics data for ${startDate} to ${endDate}`);
};

export default withErrorReporting(exportProviderUsageRecords);
