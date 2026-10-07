import db from '@/server/db';
import logger from '@/server/logger';

type GitHubProviderRecord = {
  id: string;
  label: string;
  accessToken: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getGitHubProvider(
  id: string,
): Promise<GitHubProviderRecord | null> {
  try {
    const provider = await db.gitHubProvider.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!provider) {
      return null;
    }

    return {
      id: provider.id,
      label: provider.label,
      accessToken: provider.accessToken,
      apiBaseUrl: provider.apiBaseUrl,
      owner: provider.owner,
      repo: provider.repo,
      description: provider.description,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  } catch (error) {
    logger.error('Error fetching GitHub provider', { id, error });
    throw new Error('Error fetching GitHub provider');
  }
}
