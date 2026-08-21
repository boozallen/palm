import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getGitHubProviders from '@/features/settings/dal/github-providers/getGitHubProviders';

const outputSchema = z.object({
  githubProviders: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      apiBaseUrl: z.string(),
      owner: z.string(),
      repo: z.string(),
      description: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
      isSkillRepo: z.boolean(),
      skillRepoBranch: z.string().nullable(),
      skillRepoServiceUrl: z.string().nullable(),
      skillRepoLastSyncAt: z.date().nullable(),
      skillRepoLastSyncCommit: z.string().nullable(),
    })
  ),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to view GitHub providers');
    }

    const providers = await getGitHubProviders();

    return {
      githubProviders: providers.map((p) => ({
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
      })),
    };
  });
