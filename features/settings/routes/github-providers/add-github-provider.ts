import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import createGitHubProvider from '@/features/settings/dal/github-providers/createGitHubProvider';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  label: z.string().min(1, 'A label is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  apiBaseUrl: z.string().url('Must be a valid URL').default('https://api.github.com'),
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository is required'),
  description: z.string().default(''),
  isSkillRepo: z.boolean().default(false),
  skillRepoBranch: z.string().nullable().optional(),
  skillRepoServiceUrl: z.string().url('Must be a valid URL').nullable().optional(),
});

const outputSchema = z.object({
  githubProvider: z.object({
    id: z.string().uuid(),
    label: z.string(),
    apiBaseUrl: z.string(),
    owner: z.string(),
    repo: z.string(),
    description: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to add a GitHub provider');
    }

    const provider = await createGitHubProvider({
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
      isSkillRepo: input.isSkillRepo,
      skillRepoBranch: input.skillRepoBranch || null,
      skillRepoServiceUrl: input.skillRepoServiceUrl || null,
    });

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.ConfigureGithubProvider,
      description: `GitHub provider "${input.label}" was created (skill repo: ${input.isSkillRepo})`,
    });

    return {
      githubProvider: {
        id: provider.id,
        label: provider.label,
        apiBaseUrl: provider.apiBaseUrl,
        owner: provider.owner,
        repo: provider.repo,
        description: provider.description,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
    };
  });
