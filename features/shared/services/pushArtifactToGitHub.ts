import crypto from 'crypto';

import logger from '@/server/logger';
import { GitHubFactory } from '@/features/github-provider/factory';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import { getGitHubPagesUrl } from '@/features/shared/utils/githubHelpers';

type PushArtifactToGitHubInput = {
  userId: string;
  githubProviderId?: string;
  content: string;
  label: string;
  fileExtension: string;
  // Used to build the directory prefix hash (chat.id or workflowExecution.id)
  scopeId: string;
};

export type PushArtifactToGitHubResult = {
  success: boolean;
  action: 'created' | 'updated';
  url: string;
  commitSha: string;
  pagesUrl: string | null;
};

export default async function pushArtifactToGitHub(
  input: PushArtifactToGitHubInput,
): Promise<PushArtifactToGitHubResult> {
  const { userId, githubProviderId, content, label, fileExtension, scopeId } = input;

  const availableProviders = await getAvailableGitHubProviders(userId);

  if (availableProviders.length === 0) {
    logger.error(`User does not have access to any GitHub providers: userId: ${userId}`);
    throw new Error(
      'You do not have access to any GitHub providers. Please contact your administrator.',
    );
  }

  const selectedProvider = githubProviderId
    ? availableProviders.find((p) => p.id === githubProviderId)
    : availableProviders[0];

  if (githubProviderId && !selectedProvider) {
    logger.error(
      `User does not have access to GitHub provider: userId: ${userId}, providerId: ${githubProviderId}`,
    );
    throw new Error('You do not have access to this GitHub provider');
  }

  if (fileExtension !== '.html') {
    throw new Error('Only HTML artifacts can be pushed to GitHub.');
  }

  const { id: providerId, owner, repo, apiBaseUrl } = selectedProvider!;

  const sanitizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const scopeIdHash = crypto.createHash('sha256').update(scopeId).digest('hex').substring(0, 12);
  const filePath = `artifacts/${scopeIdHash}/${sanitizedLabel}${fileExtension}`;

  try {
    const factory = new GitHubFactory({ userId });
    const { source } = await factory.buildSource(providerId);
    const result = await source.pushFile({
      owner,
      repo,
      content,
      filePath,
      commitMessage: `Add artifact: ${label}`,
    });

    logger.info(`Successfully pushed artifact to GitHub: ${result.url}`);

    const pagesUrl = getGitHubPagesUrl(apiBaseUrl, owner, repo, filePath);

    return {
      success: result.success,
      action: result.action,
      url: result.url,
      commitSha: result.commit.sha,
      pagesUrl,
    };
  } catch (error) {
    logger.error(`Failed to push artifact to GitHub: ${error}`);
    throw new Error('Failed to push artifact to GitHub. Please try again.');
  }
}
