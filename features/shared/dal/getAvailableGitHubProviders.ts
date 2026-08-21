import db from '@/server/db';
import logger from '@/server/logger';

export type AvailableGitHubProvider = {
  id: string;
  label: string;
  description: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
};

export default async function getAvailableGitHubProviders(
  userId: string,
): Promise<AvailableGitHubProvider[]> {
  try {
    const providers = await db.gitHubProvider.findMany({
      where: {
        deletedAt: null,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: { userId },
            },
          },
        },
      },
      orderBy: { label: 'asc' },
    });

    return providers.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      apiBaseUrl: p.apiBaseUrl,
      owner: p.owner,
      repo: p.repo,
    }));
  } catch (error) {
    logger.error('Error fetching available GitHub providers', error);
    throw new Error('Error fetching available GitHub providers');
  }
}
