import db from '@/server/db';
import logger from '@/server/logger';

type CreateGitHubProviderInput = {
  label: string;
  accessToken: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  isSkillRepo?: boolean;
  skillRepoBranch?: string | null;
  skillRepoServiceUrl?: string | null;
};

type GitHubProviderRecord = {
  id: string;
  label: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function createGitHubProvider(
  input: CreateGitHubProviderInput,
): Promise<GitHubProviderRecord> {
  try {
    const provider = await db.gitHubProvider.create({
      data: {
        label: input.label,
        accessToken: input.accessToken,
        apiBaseUrl: input.apiBaseUrl,
        owner: input.owner,
        repo: input.repo,
        description: input.description,
        isSkillRepo: input.isSkillRepo ?? false,
        skillRepoBranch: input.skillRepoBranch ?? null,
        skillRepoServiceUrl: input.skillRepoServiceUrl ?? null,
      },
    });

    return {
      id: provider.id,
      label: provider.label,
      apiBaseUrl: provider.apiBaseUrl,
      owner: provider.owner,
      repo: provider.repo,
      description: provider.description,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  } catch (error) {
    logger.error('Error creating GitHub provider', { label: input.label, error });
    throw new Error('Error creating GitHub provider');
  }
}
