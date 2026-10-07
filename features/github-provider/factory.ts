import logger from '@/server/logger';
import { GitHubSource, GitHubProviderConfig } from './sources/github';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';
import { GitHubProvider } from '@/features/shared/types/github-provider';

type BuildResult = {
  source: GitHubSource;
  provider: GitHubProvider;
};

export interface GitHubFactoryConfig {
  userId: string;
}

export class GitHubFactory {
  constructor(protected config: GitHubFactoryConfig) {
    if (!this.config.userId) {
      logger.error('Missing required configuration properties: config.userId');
      throw new Error('Missing required configuration properties');
    }
  }

  async buildSource(providerId: string): Promise<BuildResult> {
    try {
      const providerRecord = await getGitHubProvider(providerId);

      if (!providerRecord) {
        throw new Error(`GitHub provider with ID ${providerId} not found`);
      }

      const source = this.buildClient(providerRecord);

      const provider: GitHubProvider = {
        ...providerRecord,
        deletedAt: null,
      };

      return {
        source,
        provider,
      };
    } catch (cause) {
      const msg = `Error building GitHub source for id ${providerId}`;
      logger.error(msg, cause);
      throw new Error(msg, { cause });
    }
  }

  private buildClient(provider: Omit<GitHubProvider, 'deletedAt'>): GitHubSource {
    const config: GitHubProviderConfig = {
      accessToken: provider.accessToken,
      apiBaseUrl: provider.apiBaseUrl,
    };

    return new GitHubSource(config);
  }
}
