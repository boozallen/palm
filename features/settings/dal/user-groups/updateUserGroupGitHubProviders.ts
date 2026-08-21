import db from '@/server/db';
import logger from '@/server/logger';

type UpdateUserGroupGitHubProvidersInput = {
  userGroupId: string;
  githubProviderId: string;
  enabled: boolean;
};

type GitHubProviderListItem = {
  id: string;
  label: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function updateUserGroupGitHubProviders(
  input: UpdateUserGroupGitHubProvidersInput,
): Promise<GitHubProviderListItem[]> {
  const { userGroupId, githubProviderId, enabled } = input;

  try {
    const updatedGroup = await db.userGroup.update({
      where: { id: userGroupId },
      data: {
        githubProviders: {
          [enabled ? 'connect' : 'disconnect']: { id: githubProviderId },
        },
      },
      include: {
        githubProviders: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return updatedGroup.githubProviders.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    logger.error('Error updating user group GitHub providers', error);
    throw new Error('Error updating user group GitHub providers');
  }
}
