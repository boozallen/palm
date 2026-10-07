import db from '@/server/db';
import logger from '@/server/logger';

type GitHubProviderListItem = {
  id: string;
  label: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getUserGroupGitHubProviders(
  userGroupId: string,
): Promise<GitHubProviderListItem[]> {
  try {
    const userGroup = await db.userGroup.findUnique({
      where: { id: userGroupId, deletedAt: null },
      include: {
        githubProviders: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!userGroup) {
      throw new Error('User group not found');
    }

    return userGroup.githubProviders.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    logger.error('Error fetching user group GitHub providers', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error fetching user group GitHub providers');
  }
}
