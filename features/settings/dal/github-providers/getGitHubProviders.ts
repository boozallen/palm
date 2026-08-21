import db from '@/server/db';
import logger from '@/server/logger';

type GitHubProviderListItem = {
  id: string;
  label: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  isSkillRepo: boolean;
  skillRepoBranch: string | null;
  skillRepoServiceUrl: string | null;
  skillRepoLastSyncAt: Date | null;
  skillRepoLastSyncCommit: string | null;
};

export default async function getGitHubProviders(): Promise<GitHubProviderListItem[]> {
  try {
    const providers = await db.gitHubProvider.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return providers.map((p) => ({
      id: p.id,
      label: p.label,
      apiBaseUrl: p.apiBaseUrl,
      owner: p.owner,
      repo: p.repo,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isSkillRepo: p.isSkillRepo,
      skillRepoBranch: p.skillRepoBranch,
      skillRepoServiceUrl: p.skillRepoServiceUrl,
      skillRepoLastSyncAt: p.skillRepoLastSyncAt,
      skillRepoLastSyncCommit: p.skillRepoLastSyncCommit,
    }));
  } catch (error) {
    logger.error('Error fetching GitHub providers', error);
    throw new Error('Error fetching GitHub providers');
  }
}
