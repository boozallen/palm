import db from '@/server/db';
import logger from '@/server/logger';

type UpdateGitHubProviderInput = {
  id: string;
  label: string;
  accessToken?: string;
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

export default async function updateGitHubProvider(
  input: UpdateGitHubProviderInput,
): Promise<GitHubProviderRecord> {
  try {
    const updateData: {
      label: string;
      apiBaseUrl: string;
      owner: string;
      repo: string;
      description: string;
      accessToken?: string;
      isSkillRepo?: boolean;
      skillRepoBranch?: string | null;
      skillRepoServiceUrl?: string | null;
    } = {
      label: input.label,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
    };

    if (input.accessToken) {
      updateData.accessToken = input.accessToken;
    }

    if (input.isSkillRepo !== undefined) {
      updateData.isSkillRepo = input.isSkillRepo;
      updateData.skillRepoBranch = input.skillRepoBranch;
      updateData.skillRepoServiceUrl = input.skillRepoServiceUrl;
    }

    const provider = await db.gitHubProvider.update({
      where: { id: input.id },
      data: updateData,
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
    logger.error('Error updating GitHub provider', { id: input.id, error });
    throw new Error('Error updating GitHub provider');
  }
}
